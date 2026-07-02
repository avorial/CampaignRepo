import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import nodePath from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign, getDb } from "@/lib/db";
import { createRepo, GitHubError, isGitHubAppConnection, putFile } from "@/lib/github";
import { parseRepoInput } from "@/lib/repo";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["create", "connect"]).default("create"),
  repo: z.string().min(1),
  owner: z.string().optional(),
  branch: z.string().default("main"),
  private: z.boolean().default(true)
});

/** Recursively list all files under `dir`, returning paths relative to `base`. */
async function walkFiles(dir: string, base: string): Promise<string[]> {
  const result: string[] = [];
  let entries: Dirent<string>[];
  try { entries = await fs.readdir(dir, { withFileTypes: true, encoding: "utf-8" }); }
  catch { return result; }
  for (const entry of entries) {
    const name = String(entry.name);
    const fullPath = nodePath.join(dir, name);
    const relPath = nodePath.posix.join(base, name);
    if (entry.isDirectory()) {
      result.push(...await walkFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      result.push(relPath);
    }
  }
  return result;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (campaign.storageBackend !== "local") return NextResponse.json({ error: "Campaign is already on GitHub." }, { status: 400 });
  if (!campaign.localPath) return NextResponse.json({ error: "No local path found." }, { status: 400 });
  if (!user.githubToken) return NextResponse.json({ error: "Connect GitHub first." }, { status: 400 });

  const input = bodySchema.parse(await req.json());

  if (input.mode === "create" && isGitHubAppConnection(user.githubToken)) {
    return NextResponse.json({ error: "GitHub App access cannot create new repos. Use a manual token, or connect an existing repo." }, { status: 400 });
  }

  let { owner, repo } = parseRepoInput(input.owner || "", input.repo);
  let branch = input.branch;

  try {
    if (input.mode === "create") {
      const created = await createRepo(user.githubToken, input.repo, input.private);
      owner = created.owner.login;
      repo = created.name;
      branch = created.default_branch || "main";
    }
    if (!owner || !repo) return NextResponse.json({ error: "Owner and repo are required." }, { status: 400 });
  } catch (error) {
    const msg = error instanceof GitHubError ? `GitHub error ${error.status}: ${error.message}` : String(error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const githubCampaign = { ...campaign, owner, repo, branch, storageBackend: "github" as const };

  // Walk all files under wiki/
  const wikiDir = nodePath.join(campaign.localPath, "wiki");
  const allFiles = await walkFiles(wikiDir, "wiki");

  const MAX_FILE_BYTES = 90 * 1024 * 1024; // 90MB safety limit
  const BINARY_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".mp3", ".ogg", ".wav", ".mp4", ".ico"]);

  let pushed = 0, skipped = 0;
  const errors: string[] = [];

  for (const relPath of allFiles) {
    const fullPath = nodePath.join(campaign.localPath, relPath);
    const ext = nodePath.extname(relPath).toLowerCase();
    const isBinary = BINARY_EXTENSIONS.has(ext);
    try {
      const bytes = await fs.readFile(fullPath);
      if (bytes.length > MAX_FILE_BYTES) { skipped++; continue; }
      const content = isBinary ? bytes.toString("base64") : bytes.toString("utf-8");
      const posixPath = relPath.replace(/\\/g, "/");

      if (isBinary) {
        await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(posixPath)}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${user.githubToken.replace(/^github-app:/, "")}`,
            "Content-Type": "application/json",
            "User-Agent": "CampaignRepo"
          },
          body: JSON.stringify({ message: "CampaignRepo: migrate to GitHub", content, branch })
        });
      } else {
        await putFile(user.githubToken, githubCampaign, posixPath, content, "CampaignRepo: migrate to GitHub");
      }
      pushed++;
    } catch {
      errors.push(relPath);
      skipped++;
    }
  }

  // Update campaign record to GitHub storage
  const db = getDb();
  db.prepare("UPDATE campaigns SET storageBackend = 'github', owner = ?, repo = ?, branch = ?, localPath = NULL WHERE id = ?")
    .run(owner, repo, branch, campaign.id);

  return NextResponse.json({ ok: true, owner, repo, branch, pushed, skipped, errors: errors.slice(0, 10) });
}

import fs from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, listCampaigns, removeCampaign } from "@/lib/db";
import { createRepo, GitHubError, initializeRepo, isGitHubAppConnection } from "@/lib/github";
import { parseRepoInput } from "@/lib/repo";
import { gameTypes } from "@/lib/templates";
import { getStorageAdapter } from "@/lib/storage";
import type { Campaign } from "@/lib/types";

export const dynamic = "force-dynamic";

const createSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    name: z.string().min(1),
    repo: z.string().optional(),
    private: z.boolean().default(true),
    branch: z.string().default("main"),
    gameType: z.enum(gameTypes as [string, ...string[]])
  }),
  z.object({
    mode: z.literal("connect"),
    name: z.string().min(1),
    owner: z.string().optional(),
    repo: z.string().optional(),
    branch: z.string().default("main"),
    gameType: z.enum(gameTypes as [string, ...string[]])
  }),
  z.object({
    mode: z.literal("local"),
    name: z.string().min(1),
    localPath: z.string().optional(),
    gameType: z.enum(gameTypes as [string, ...string[]])
  })
]);

const deleteSchema = z.object({ id: z.number().int().positive() });

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({ campaigns: listCampaigns(user.id) });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  const { id } = deleteSchema.parse(await req.json());
  try {
    removeCampaign(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove campaign." }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  const input = createSchema.parse(await req.json());

  if (input.mode === "local") {
    const safeName = input.name.replace(/[<>:"/\\|?*]/g, "-").trim() || "campaign";
    const defaultPath = nodePath.join(os.homedir(), "Campaigns", safeName);
    const absPath = nodePath.resolve(input.localPath || defaultPath);
    await fs.mkdir(absPath, { recursive: true });
    const basename = nodePath.basename(absPath);
    const db = getDb();
    let result;
    try {
      result = db
        .prepare("INSERT INTO campaigns (userId, name, owner, repo, branch, gameType, storageBackend, localPath) VALUES (?, ?, 'local', ?, 'local', ?, 'local', ?)")
        .run(user.id, input.name, basename, input.gameType, absPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("UNIQUE")) return NextResponse.json({ error: `A local campaign already exists for "${basename}".` }, { status: 409 });
      throw error;
    }
    db.prepare("INSERT OR IGNORE INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, 'owner')").run(result.lastInsertRowid, user.id);
    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(result.lastInsertRowid) as Campaign;
    const storage = getStorageAdapter(campaign);
    if (storage) await storage.initializeRepo(campaign);
    return NextResponse.json({ campaign });
  }

  if (!user.githubToken) return NextResponse.json({ error: "Connect GitHub first." }, { status: 400 });
  let { owner, repo } = parseRepoInput((input as any).owner || "", (input as any).repo || "");
  let branch = (input as any).branch || "main";
  try {
    if (input.mode === "create") {
      if (isGitHubAppConnection(user.githubToken)) {
        return NextResponse.json({ error: "GitHub App access can connect existing repos. To create repos from CampaignRepo, connect a manual GitHub token fallback." }, { status: 400 });
      }
      const created = await createRepo(user.githubToken, (input as any).repo || input.name, (input as any).private ?? true);
      owner = created.owner.login;
      repo = created.name;
      branch = created.default_branch || "main";
    }
    if (!owner || !repo) return NextResponse.json({ error: "Owner and repo are required." }, { status: 400 });
    const db = getDb();
    const result = db
      .prepare("INSERT INTO campaigns (userId, name, owner, repo, branch, gameType, storageBackend) VALUES (?, ?, ?, ?, ?, ?, 'github')")
      .run(user.id, input.name, owner, repo, branch, input.gameType);
    db.prepare("INSERT OR IGNORE INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, 'owner')").run(result.lastInsertRowid, user.id);
    const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(result.lastInsertRowid) as Campaign;
    await initializeRepo(user.githubToken, campaign);
    return NextResponse.json({ campaign });
  } catch (error) {
    const message =
      error instanceof GitHubError
        ? `GitHub error${error.status ? ` ${error.status}` : ""}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Could not build repo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

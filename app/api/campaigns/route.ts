import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb, listCampaigns, removeCampaign } from "@/lib/db";
import { createRepo, GitHubError, initializeRepo, isGitHubAppConnection } from "@/lib/github";
import { parseRepoInput } from "@/lib/repo";
import { gameTypes } from "@/lib/templates";

const createSchema = z.object({
  mode: z.enum(["create", "connect"]),
  name: z.string().min(1),
  owner: z.string().optional(),
  repo: z.string().optional(),
  private: z.boolean().default(true),
  branch: z.string().default("main"),
  gameType: z.enum(gameTypes as [string, ...string[]])
});

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
  if (!user.githubToken) return NextResponse.json({ error: "Connect GitHub first." }, { status: 400 });
  const input = createSchema.parse(await req.json());
  let { owner, repo } = parseRepoInput(input.owner || "", input.repo || "");
  let branch = input.branch || "main";
  try {
    if (input.mode === "create") {
      if (isGitHubAppConnection(user.githubToken)) {
        return NextResponse.json({ error: "GitHub App access can connect existing repos. To create repos from CampaignRepo, connect a manual GitHub token fallback." }, { status: 400 });
      }
      const created = await createRepo(user.githubToken, input.repo || input.name, input.private);
      owner = created.owner.login;
      repo = created.name;
      branch = created.default_branch || "main";
    }
    if (!owner || !repo) return NextResponse.json({ error: "Owner and repo are required." }, { status: 400 });
    const result = getDb()
      .prepare("INSERT INTO campaigns (userId, name, owner, repo, branch, gameType) VALUES (?, ?, ?, ?, ?, ?)")
      .run(user.id, input.name, owner, repo, branch, input.gameType);
    getDb().prepare("INSERT OR IGNORE INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, 'owner')").run(result.lastInsertRowid, user.id);
    const campaign = getDb().prepare("SELECT * FROM campaigns WHERE id = ?").get(result.lastInsertRowid) as any;
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

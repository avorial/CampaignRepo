import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getContent, GitHubError, initializeRepo } from "@/lib/github";

const expectedPaths = [
  { path: "README.md", type: "file", label: "Campaign README" },
  { path: "wiki/campaign.yaml", type: "file", label: "Campaign config" },
  { path: "wiki/pages", type: "dir", label: "Markdown pages folder" },
  { path: "wiki/media", type: "dir", label: "Media folder" },
  { path: "wiki/media/media.json", type: "file", label: "Media metadata manifest" },
  { path: "wiki/templates", type: "dir", label: "Templates folder" },
  { path: "wiki/templates/{gameType}", type: "dir", label: "Selected game template folder" },
  { path: "wiki/imports/characters", type: "dir", label: "Character import source folder" },
  { path: "wiki/search/index.json", type: "file", label: "Portable search snapshot" }
];

async function validate(token: string, campaign: NonNullable<ReturnType<typeof getCampaign>>) {
  const checks = await Promise.all(
    expectedPaths.map(async (item) => {
      const path = item.path.replace("{gameType}", campaign.gameType);
      try {
        const content = await getContent(token, campaign, path);
        const ok = content.type === item.type;
        return {
          ...item,
          path,
          ok,
          actualType: content.type,
          status: ok ? "ok" : "wrong-type"
        };
      } catch (error) {
        if (error instanceof GitHubError && error.status === 404) {
          return { ...item, path, ok: false, status: "missing" };
        }
        return { ...item, path, ok: false, status: "error", error: error instanceof Error ? error.message : "Unknown error" };
      }
    })
  );
  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await validate(user.githubToken, campaign));
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await initializeRepo(user.githubToken, campaign);
  return NextResponse.json(await validate(user.githubToken, campaign));
}

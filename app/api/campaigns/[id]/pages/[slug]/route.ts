import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getTextFile, GitHubError, putFile } from "@/lib/github";
import { parsePage, serializePage, stripGmBlocks } from "@/lib/markdown";
import { rebuildSearchIndex } from "@/lib/search";

export const dynamic = "force-dynamic";

const schema = z.object({
  frontmatter: z.any(),
  content: z.string(),
  sha: z.string().optional(),
  ai: z.boolean().default(false)
});

function sanitizePlayerPage<T extends ReturnType<typeof parsePage>>(page: T): T {
  return {
    ...page,
    content: stripGmBlocks(page.content),
    raw: stripGmBlocks(page.raw),
    frontmatter: {
      ...page.frontmatter,
      sourceImport: undefined
    }
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = await getTextFile(user.githubToken, campaign, `wiki/pages/${slug}.md`);
  const page = parsePage(slug, file.text, file.sha);
  const mode = new URL(req.url).searchParams.get("mode");
  const playerSafeMode = campaign.role === "player" || mode === "player";
  if (playerSafeMode && (page.frontmatter.visibility !== "players" || page.frontmatter.approvalStatus !== "approved")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ page: playerSafeMode ? sanitizePlayerPage(page) : page });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = schema.parse(await req.json());
  const frontmatter = {
    ...input.frontmatter,
    approvalStatus: input.ai ? "unapproved" : input.frontmatter.approvalStatus,
    lastEditedBy: input.ai ? "AI via CampaignRepo" : user.name
  };
  const raw = serializePage(frontmatter, input.content);
  const current = input.sha ? { sha: input.sha } : await getTextFile(user.githubToken, campaign, `wiki/pages/${slug}.md`);
  try {
    const saved = (await putFile(user.githubToken, campaign, `wiki/pages/${slug}.md`, raw, `CampaignRepo: update ${frontmatter.name || slug}`, current.sha)) as { content?: { sha?: string } };
    await rebuildSearchIndex(user.githubToken, campaign);
    return NextResponse.json({ ok: true, sha: saved.content?.sha });
  } catch (error) {
    if (error instanceof GitHubError && error.status === 409) {
      const latest = await getTextFile(user.githubToken, campaign, `wiki/pages/${slug}.md`);
      return NextResponse.json(
        {
          error: "This page changed on GitHub after you opened it. Reload the latest version before saving.",
          conflict: true,
          latest: parsePage(slug, latest.text, latest.sha)
        },
        { status: 409 }
      );
    }
    const message =
      error instanceof GitHubError
        ? `GitHub error${error.status ? ` ${error.status}` : ""}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

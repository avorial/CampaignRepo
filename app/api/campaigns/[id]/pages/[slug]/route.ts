import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, createNotifications, getCampaign, getCampaignGmUserIds } from "@/lib/db";
import { getStorageAdapter, isConflictError, isNotFoundError } from "@/lib/storage";
import { parsePage, serializePage, stripGmBlocks } from "@/lib/markdown";
import { scheduleSearchIndexRebuild } from "@/lib/search";
import { readPageCache, refreshPageCache } from "@/lib/page-cache";

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
    frontmatter: { ...page.frontmatter, sourceImport: undefined }
  };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let page = readPageCache(campaign.id).pages.find((candidate) => candidate.slug === slug);
  if (!page) {
    try {
      page = (await refreshPageCache(storage, campaign)).pages.find((candidate) => candidate.slug === slug);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not refresh campaign pages." },
        { status: 503 }
      );
    }
  }
  if (!page) return NextResponse.json({ error: "Page not found.", missing: true }, { status: 404 });
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
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = schema.parse(await req.json());
  const frontmatter = {
    ...input.frontmatter,
    approvalStatus: input.ai ? "unapproved" : input.frontmatter.approvalStatus,
    lastEditedBy: input.ai ? "AI via CampaignRepo" : user.name
  };
  const raw = serializePage(frontmatter, input.content);
  let sha = input.sha;
  if (!sha) {
    const current = await storage.getTextFile(`wiki/pages/${slug}.md`);
    sha = current.sha;
  }
  try {
    const saved = await storage.putFile(`wiki/pages/${slug}.md`, raw, `CampaignRepo: update ${frontmatter.name || slug}`, sha);
    scheduleSearchIndexRebuild(campaign);

    // Notify GMs when a player-visible page is submitted for review
    if (frontmatter.approvalStatus === "unapproved" && frontmatter.visibility === "players") {
      const gmIds = getCampaignGmUserIds(campaign.id).filter((uid) => uid !== user.id);
      if (gmIds.length > 0) {
        createNotifications(
          gmIds,
          campaign.id,
          "review_request",
          `Review requested: ${frontmatter.name || slug}`,
          `${user.name} submitted "${frontmatter.name || slug}" for review in ${campaign.name}.`,
          `/campaigns/${campaign.id}/pages/${slug}`
        );
      }
    }

    return NextResponse.json({ ok: true, sha: saved.sha });
  } catch (error) {
    if (isConflictError(error)) {
      const latest = await storage.getTextFile(`wiki/pages/${slug}.md`);
      return NextResponse.json(
        {
          error: "This page changed after you opened it. Reload the latest version before saving.",
          conflict: true,
          latest: parsePage(slug, latest.text, latest.sha)
        },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Save failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const path = `wiki/pages/${slug}.md`;
  try {
    const file = await storage.getTextFile(path);
    await storage.deleteFile(path, `CampaignRepo: delete ${slug}`, file.sha);
    scheduleSearchIndexRebuild(campaign);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) return NextResponse.json({ ok: true, alreadyMissing: true });
    const message = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

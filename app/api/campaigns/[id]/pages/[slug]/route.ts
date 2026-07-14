import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, createNotifications, getCampaign, getCampaignGmUserIds, getCampaignMemberUsers, getMemberGroups, getPageWatcherUserIds, getUserIdByEmail } from "@/lib/db";
import { getStorageAdapter, isConflictError, isNotFoundError } from "@/lib/storage";
import { parsePage, serializePage, stripGmBlocks } from "@/lib/markdown";
import { removePageFromSearchIndex, scheduleSearchIndexRebuild } from "@/lib/search";
import { readPageCache, refreshPageCache, removePageFromCache, upsertPageInCache } from "@/lib/page-cache";
import { findRepositoryManifestPage, removePageFromRepositoryManifest } from "@/lib/repository-manifest";

export const dynamic = "force-dynamic";

const schema = z.object({
  frontmatter: z.any(),
  content: z.string(),
  sha: z.string().optional(),
  ai: z.boolean().default(false)
});

function sanitizePlayerPage<T extends ReturnType<typeof parsePage>>(page: T, visibleGroups?: Set<string>): T {
  return {
    ...page,
    content: stripGmBlocks(page.content, visibleGroups),
    raw: stripGmBlocks(page.raw, visibleGroups),
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
  const refreshMode = new URL(req.url).searchParams.get("refresh");
  let page = refreshMode === "wait"
    ? (await refreshPageCache(storage, campaign)).pages.find((candidate) => candidate.slug === slug)
    : readPageCache(campaign.id).pages.find((candidate) => candidate.slug === slug);
  if (!page) {
    const manifestPage = await findRepositoryManifestPage(storage, slug);
    const candidatePaths = [
      manifestPage?.path,
      `wiki/pages/${slug}.md`
    ].filter(Boolean) as string[];
    try {
      for (const path of candidatePaths) {
        try {
          const file = await storage.getTextFile(path);
          page = parsePage(slug, file.text, file.sha);
          break;
        } catch {
          // Try the next known path before falling back to an index refresh.
        }
      }
      if (!page) {
        page = (await refreshPageCache(storage, campaign)).pages.find((candidate) => candidate.slug === slug);
      }
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
  if (playerSafeMode) {
    const groups = getMemberGroups(campaign.id, user.id);
    const visibleGroups = groups.length ? new Set(groups) : undefined;
    return NextResponse.json({ page: sanitizePlayerPage(page, visibleGroups) });
  }
  return NextResponse.json({ page });
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
    upsertPageInCache(campaign.id, parsePage(slug, raw, saved.sha));
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

    // Notify assigned user when a page is assigned to them
    if (frontmatter.assignee) {
      const assigneeId = getUserIdByEmail(frontmatter.assignee);
      if (assigneeId && assigneeId !== user.id) {
        createNotifications(
          [assigneeId],
          campaign.id,
          "assignment",
          `Assigned: ${frontmatter.name || slug}`,
          `${user.name} assigned you to "${frontmatter.name || slug}" in ${campaign.name}.`,
          `/campaigns/${campaign.id}/pages/${slug}`
        );
      }
    }

    // Notify page watchers of the change
    const watcherIds = getPageWatcherUserIds(campaign.id, slug).filter((uid) => uid !== user.id);
    if (watcherIds.length > 0) {
      createNotifications(
        watcherIds,
        campaign.id,
        "page_changed",
        `Page updated: ${frontmatter.name || slug}`,
        `${user.name} updated "${frontmatter.name || slug}" in ${campaign.name}.`,
        `/campaigns/${campaign.id}/pages/${slug}`
      );
    }

    // Detect @mentions and notify matching campaign members
    const mentionMatches = [...input.content.matchAll(/@([A-Za-z0-9][A-Za-z0-9._-]*)/g)];
    if (mentionMatches.length > 0) {
      const members = getCampaignMemberUsers(campaign.id);
      const notified = new Set<number>();
      for (const [, handle] of mentionMatches) {
        const lc = handle.toLowerCase();
        const match = members.find((m) =>
          m.email.split("@")[0].toLowerCase() === lc ||
          m.name.toLowerCase().replace(/\s+/g, "") === lc.replace(/_/g, "") ||
          m.name.split(" ")[0].toLowerCase() === lc
        );
        if (match && match.id !== user.id && !notified.has(match.id)) {
          notified.add(match.id);
        }
      }
      if (notified.size > 0) {
        createNotifications(
          [...notified],
          campaign.id,
          "mention",
          `Mentioned in: ${frontmatter.name || slug}`,
          `${user.name} mentioned you in "${frontmatter.name || slug}" in ${campaign.name}.`,
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
    removePageFromCache(campaign.id, slug);
    await removePageFromSearchIndex(storage, campaign, slug);
    await removePageFromRepositoryManifest(storage, slug);
    scheduleSearchIndexRebuild(campaign);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      removePageFromCache(campaign.id, slug);
      await removePageFromSearchIndex(storage, campaign, slug);
      await removePageFromRepositoryManifest(storage, slug);
      scheduleSearchIndexRebuild(campaign);
      return NextResponse.json({ ok: true, alreadyMissing: true });
    }
    const message = error instanceof Error ? error.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

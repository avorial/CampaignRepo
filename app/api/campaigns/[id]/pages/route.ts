import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign, getMemberGroups } from "@/lib/db";
import { getStorageAdapter, isConflictError } from "@/lib/storage";
import { parsePage, serializePage } from "@/lib/markdown";
import { sanitizePlayerPage } from "@/lib/public-site";
import { defaultFrontmatter, starterBody } from "@/lib/templates";
import { slugify } from "@/lib/slug";
import { scheduleSearchIndexRebuild } from "@/lib/search";
import {
  isRemoteCheckFresh,
  readManifestPageSnapshot,
  readPageCache,
  readRemoteCheckState,
  readSearchIndexPageSnapshot,
  refreshPageCache,
  refreshPageCacheInBackground,
  stampRemoteCheck,
  upsertPageInCache,
  type PageCacheSnapshot
} from "@/lib/page-cache";
import {
  manifestPageFromWikiPage,
  readRepositoryManifestText,
  repositoryManifestPath,
  serializeRepositoryManifest,
  upsertManifestPage
} from "@/lib/repository-manifest";

export const dynamic = "force-dynamic";

/**
 * Local-first page lists: serve the SQLite cache with zero remote calls while
 * the last remote check is fresh (5 minutes). Once stale, one cheap HEAD
 * lookup decides everything — unchanged HEAD re-arms the window; a changed
 * HEAD serves the remote index and refreshes the cache in the background, so
 * edits made outside CampaignRepo appear within the window. Remote outages
 * degrade to the local copy instead of failing the list.
 */
async function listSnapshotLocalFirst(storage: import("@/lib/storage").StorageAdapter, campaign: NonNullable<ReturnType<typeof getCampaign>>): Promise<PageCacheSnapshot> {
  const local = readPageCache(campaign.id);
  if (storage.isLocal) {
    // Local folders have no remote latency to hide; keep the index-first path.
    return (await readManifestPageSnapshot(storage)) || (await readSearchIndexPageSnapshot(storage)) || local;
  }
  if (local.pages.length && isRemoteCheckFresh(campaign.id)) return local;
  if (local.pages.length) {
    try {
      const head = (await storage.listRecentCommits(1))[0]?.sha || "";
      const known = readRemoteCheckState(campaign.id).remoteHeadSha;
      stampRemoteCheck(campaign.id, head);
      if (head && head === known) return local;
      refreshPageCacheInBackground(storage, campaign);
      return (await readManifestPageSnapshot(storage)) || (await readSearchIndexPageSnapshot(storage)) || local;
    } catch {
      return local;
    }
  }
  const snapshot = (await readManifestPageSnapshot(storage)) || (await readSearchIndexPageSnapshot(storage));
  if (snapshot) {
    // Warm the local cache so the local-first window can take over.
    refreshPageCacheInBackground(storage, campaign);
    return snapshot;
  }
  return local;
}

const schema = z.object({
  name: z.string().min(1),
  category: z.string().min(1).max(40).regex(/^[a-z0-9_/-]+$/),
  visibility: z.enum(["gm", "players"]).default("gm"),
  templatePath: z.string().optional(),
  content: z.string().max(100_000).optional()
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const includeBodies = url.searchParams.get("body") === "1" || url.searchParams.get("full") === "1";
  const cached = includeBodies ? readPageCache(campaign.id) : await listSnapshotLocalFirst(storage, campaign);
  const waitForRefresh = cached.pages.length === 0 || url.searchParams.get("refresh") === "wait";
  let snapshot;
  try {
    snapshot = waitForRefresh ? await refreshPageCache(storage, campaign) : cached;
  } catch (error) {
    return NextResponse.json(
      { pages: cached.pages, error: error instanceof Error ? error.message : "Could not refresh campaign pages." },
      { status: cached.pages.length ? 200 : 503 }
    );
  }
  if (includeBodies && !waitForRefresh) refreshPageCacheInBackground(storage, campaign);
  const pages = snapshot.pages;
  const mode = url.searchParams.get("mode");
  const isPlayerMode = campaign.role === "player" || mode === "player";
  const visiblePages = isPlayerMode
    ? (() => {
        const groups = getMemberGroups(campaign.id, user.id);
        const visibleGroups = groups.length ? new Set(groups) : undefined;
        return pages
          .filter((page) => page.frontmatter.visibility === "players" && page.frontmatter.approvalStatus === "approved")
          .map((page) => sanitizePlayerPage(page, visibleGroups));
      })()
    : pages;
  return NextResponse.json({
    pages: visiblePages,
    cache: {
      cached: !waitForRefresh,
      source: snapshot.source,
      refreshedAt: snapshot.refreshedAt,
      refreshError: snapshot.refreshError
    }
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const input = schema.parse(await req.json());
    const slug = slugify(input.name);
    const pagePath = `wiki/pages/${slug}.md`;
    try {
      await storage.getTextFile(pagePath);
      return NextResponse.json(
        { error: `An entry named "${input.name}" already exists. Open the existing entry or choose a different name.`, slug },
        { status: 409 }
      );
    } catch (error) {
      if (!isConflictError(error) && (error as any)?.status !== 404) throw error;
    }
    let frontmatter = defaultFrontmatter(input.name, input.category, input.visibility);
    let content = input.content?.trim() ? input.content : starterBody(input.name, input.category, campaign.gameType as any);
    if (input.templatePath?.startsWith("wiki/templates/") && input.templatePath.endsWith(".md")) {
      const template = await storage.getTextFile(input.templatePath);
      const parsedTemplate = parsePage(slug, template.text, template.sha);
      frontmatter = {
        ...parsedTemplate.frontmatter,
        name: input.name,
        category: input.category,
        type: input.category,
        visibility: input.visibility,
        approvalStatus: "approved",
        knownToPlayers: input.visibility === "players",
        sourceImport: undefined,
        lastEditedBy: user.name
      };
      content = parsedTemplate.content.replace(/^# .*/m, `# ${input.name}`);
    }
    const pageText = serializePage(frontmatter, content);
    const parsedPage = parsePage(slug, pageText);
    let manifest = null;
    try {
      const existingManifest = await storage.getTextFile(repositoryManifestPath);
      manifest = readRepositoryManifestText(existingManifest.text);
    } catch {
      manifest = null;
    }
    const nextManifest = upsertManifestPage(manifest, manifestPageFromWikiPage(slug, pagePath, parsedPage));
    await storage.commitFiles(
      [
        { path: pagePath, content: pageText },
        { path: repositoryManifestPath, content: serializeRepositoryManifest(nextManifest) }
      ],
      `CampaignRepo: create ${input.name}`
    );
    upsertPageInCache(campaign.id, parsedPage);
    scheduleSearchIndexRebuild(campaign);
    return NextResponse.json({ slug });
  } catch (error) {
    if (isConflictError(error)) {
      return NextResponse.json(
        { error: "An entry with that name was created before this request completed. Open the existing entry or choose a different name." },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Could not create page.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

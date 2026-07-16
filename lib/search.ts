import { stripGmBlocks } from "@/lib/markdown";
import { aliasMapFromPages, resolveTarget } from "@/lib/links";
import type { Campaign, SearchDocument, WikiPage } from "@/lib/types";
import { deleteSearchDocument, getDb, upsertSearchDocuments } from "@/lib/db";
import { getStorageAdapter, type StorageAdapter } from "@/lib/storage";
import { refreshPageCache } from "@/lib/page-cache";
import { buildRepositoryManifestFromSearchDocuments, repositoryManifestPath, serializeRepositoryManifest } from "@/lib/repository-manifest";

type MediaMetadata = {
  alt?: string;
  caption?: string;
  tags?: string[];
};

function withBacklinks(pages: WikiPage[]) {
  const aliases = aliasMapFromPages(pages);
  const backlinks = new Map<string, string[]>();
  for (const page of pages) {
    for (const link of page.outgoingLinks) {
      const target = resolveTarget(aliases, link.target);
      backlinks.set(target, [...(backlinks.get(target) || []), page.slug]);
    }
  }
  return pages.map((page) => ({ ...page, backlinks: backlinks.get(page.slug) || [] }));
}

async function buildMediaSearchDocuments(storage: StorageAdapter, campaign: Campaign): Promise<SearchDocument[]> {
  const [entries, metadata] = await Promise.all([
    storage.listDirectory("wiki/media"),
    (async () => {
      try {
        const file = await storage.getTextFile("wiki/media/media.json");
        return JSON.parse(file.text || "{}") as Record<string, MediaMetadata>;
      } catch {
        return {} as Record<string, MediaMetadata>;
      }
    })()
  ]);

  return entries
    .filter((entry) => entry.type === "file" && entry.name !== ".gitkeep" && entry.path !== "wiki/media/media.json")
    .map((entry) => {
      const item = metadata[entry.path] || {};
      const tags = item.tags || [];
      const title = item.alt || entry.name;
      const text = [entry.name, entry.path, item.alt, item.caption, ...tags].filter(Boolean).join("\n");
      return {
        id: `${campaign.id}:media:${entry.path}`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        slug: `media/${entry.name}`,
        title,
        category: "media",
        summary: item.caption || entry.path,
        tags,
        aliases: [entry.name],
        visibility: "gm" as const,
        approvalStatus: "approved" as const,
        text,
        playerText: "",
        links: [],
        backlinks: [],
        keyLinks: []
      };
    });
}

export async function buildSearchDocuments(storage: StorageAdapter, campaign: Campaign): Promise<SearchDocument[]> {
  const pages = (await refreshPageCache(storage, campaign)).pages;
  const pageDocs = withBacklinks(pages).map((page) => ({
    id: `${campaign.id}:${page.slug}`,
    campaignId: campaign.id,
    campaignName: campaign.name,
    slug: page.slug,
    title: page.frontmatter.name,
    category: page.frontmatter.category,
    summary: page.frontmatter.summary,
    tags: page.frontmatter.tags,
    aliases: page.frontmatter.aliases,
    visibility: page.frontmatter.visibility,
    approvalStatus: page.frontmatter.approvalStatus,
    text: page.content,
    playerText: stripGmBlocks(page.content),
    links: page.outgoingLinks.map((link) => link.target),
    backlinks: page.backlinks,
    keyLinks: page.frontmatter.keyLinks,
    parent: page.frontmatter.parent
  }));
  const mediaDocs = await buildMediaSearchDocuments(storage, campaign);
  return [...pageDocs, ...mediaDocs];
}

const SNAPSHOT_EXCERPT_LENGTH = 300;

/**
 * The committed snapshot is a navigation/search index, not a content store.
 * Full page bodies live in the Markdown files (canonical) and the SQLite FTS
 * table (live search); committing them here doubled every page body into a
 * multi-megabyte JSON blob that was rewritten wholesale on every rebuild,
 * bloating repo history and blowing past GitHub's 1 MB contents responses.
 * A short player-safe excerpt is kept for review lists and previews.
 */
export function leanSnapshotDocs(docs: SearchDocument[]): SearchDocument[] {
  return docs.map((doc) => ({
    ...doc,
    excerpt: (doc.playerText || "").replace(/\s+/g, " ").trim().slice(0, SNAPSHOT_EXCERPT_LENGTH),
    text: "",
    playerText: ""
  }));
}

export async function rebuildSearchIndex(storage: StorageAdapter, campaign: Campaign) {
  const docs = await buildSearchDocuments(storage, campaign);
  // SQLite keeps the full bodies for live full-text search; the repo gets the
  // lean, portable form.
  upsertSearchDocuments(campaign.id, docs);
  const manifest = buildRepositoryManifestFromSearchDocuments(docs);
  await storage.commitFiles(
    [
      { path: "wiki/search/index.json", content: JSON.stringify(leanSnapshotDocs(docs), null, 2) + "\n" },
      { path: repositoryManifestPath, content: serializeRepositoryManifest(manifest) }
    ],
    "CampaignRepo: update repository index"
  );
  return docs;
}

export async function removePageFromSearchIndex(storage: StorageAdapter, campaign: Campaign, slug: string) {
  deleteSearchDocument(campaign.id, slug);
  try {
    const existing = await storage.getTextFile("wiki/search/index.json");
    const docs = JSON.parse(existing.text) as SearchDocument[];
    const next = docs.filter((doc) => doc.slug !== slug || doc.category === "media");
    if (next.length === docs.length) return;
    await storage.putFile(
      "wiki/search/index.json",
      JSON.stringify(next, null, 2) + "\n",
      `CampaignRepo: remove ${slug} from search snapshot`,
      existing.sha
    );
  } catch (error) {
    console.error(`Could not remove ${slug} from search snapshot for campaign ${campaign.id}.`, error);
  }
}

const scheduledRebuilds = new Map<number, ReturnType<typeof setTimeout>>();

export function scheduleSearchIndexRebuild(campaign: Campaign, delayMs = 15_000) {
  const existing = scheduledRebuilds.get(campaign.id);
  if (existing) clearTimeout(existing);
  // Shadow the timer durably so a restart-dropped rebuild is recovered by the
  // pending-jobs sweep instead of vanishing.
  getDb().prepare(
    "INSERT INTO pending_jobs (campaignId, kind, dueAt) VALUES (?, 'rebuild', ?) ON CONFLICT(campaignId, kind) DO UPDATE SET dueAt = excluded.dueAt"
  ).run(campaign.id, Date.now() + delayMs);
  const timer = setTimeout(() => {
    scheduledRebuilds.delete(campaign.id);
    getDb().prepare("DELETE FROM pending_jobs WHERE campaignId = ? AND kind = 'rebuild'").run(campaign.id);
    const storage = getStorageAdapter(campaign);
    if (!storage) return;
    void rebuildSearchIndex(storage, campaign).catch((error) => {
      console.error(`Background search rebuild failed for campaign ${campaign.id}.`, error);
    });
  }, delayMs);
  scheduledRebuilds.set(campaign.id, timer);
}

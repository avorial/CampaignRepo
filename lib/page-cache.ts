import type { Campaign, WikiPage } from "@/lib/types";
import { getDb } from "@/lib/db";
import type { StorageAdapter } from "@/lib/storage";
import { normalizeFrontmatter, parsePage } from "@/lib/markdown";
import { readRepositoryManifestSnapshot } from "@/lib/repository-manifest";

type CacheRow = {
  slug: string;
  sha: string;
  pageJson: string;
};

export type PageCacheSnapshot = {
  pages: WikiPage[];
  refreshedAt: string | null;
  refreshError: string | null;
  source?: "cache" | "manifest" | "search-index" | "full-refresh";
};

const refreshes = new Map<number, Promise<PageCacheSnapshot>>();

export function readPageCache(campaignId: number): PageCacheSnapshot {
  const db = getDb();
  const rows = db
    .prepare("SELECT slug, sha, pageJson FROM campaign_page_cache WHERE campaignId = ? ORDER BY slug")
    .all(campaignId) as CacheRow[];
  const state = db
    .prepare("SELECT refreshedAt, refreshError FROM campaign_page_cache_state WHERE campaignId = ?")
    .get(campaignId) as { refreshedAt?: string | null; refreshError?: string | null } | undefined;
  const pages = rows.flatMap((row) => {
    try {
      return [{ ...(JSON.parse(row.pageJson) as WikiPage), sha: row.sha }];
    } catch {
      return [];
    }
  });
  return {
    pages,
    refreshedAt: state?.refreshedAt || null,
    refreshError: state?.refreshError || null,
    source: "cache"
  };
}

export function removePageFromCache(campaignId: number, slug: string) {
  const db = getDb();
  db.prepare("DELETE FROM campaign_page_cache WHERE campaignId = ? AND slug = ?").run(campaignId, slug);
}

/** How long a remote-head check stays fresh: local reads are served with zero
 * remote calls inside this window, so external edits appear within it. */
export const REMOTE_FRESH_WINDOW_MS = 5 * 60 * 1000;

export type RemoteCheckState = { remoteCheckedAt: string | null; remoteHeadSha: string | null; remoteManifestPages: number | null };

export function readRemoteCheckState(campaignId: number): RemoteCheckState {
  const row = getDb()
    .prepare("SELECT remoteCheckedAt, remoteHeadSha, remoteManifestPages FROM campaign_page_cache_state WHERE campaignId = ?")
    .get(campaignId) as { remoteCheckedAt?: string | null; remoteHeadSha?: string | null; remoteManifestPages?: number | null } | undefined;
  return {
    remoteCheckedAt: row?.remoteCheckedAt || null,
    remoteHeadSha: row?.remoteHeadSha || null,
    remoteManifestPages: row?.remoteManifestPages ?? null
  };
}

/** Record a remote check; when the remote index was read, also record how many pages it lists. */
export function stampRemoteCheck(campaignId: number, headSha: string, manifestPages?: number) {
  getDb().prepare(`
    INSERT INTO campaign_page_cache_state (campaignId, remoteCheckedAt, remoteHeadSha, remoteManifestPages)
    VALUES (?, CURRENT_TIMESTAMP, ?, ?)
    ON CONFLICT(campaignId) DO UPDATE SET
      remoteCheckedAt = CURRENT_TIMESTAMP,
      remoteHeadSha = excluded.remoteHeadSha,
      remoteManifestPages = COALESCE(excluded.remoteManifestPages, campaign_page_cache_state.remoteManifestPages)
  `).run(campaignId, headSha, manifestPages ?? null);
}

/** Record how many pages the remote index lists, without touching the freshness clock. */
export function stampRemoteManifestPages(campaignId: number, manifestPages: number) {
  getDb().prepare(`
    INSERT INTO campaign_page_cache_state (campaignId, remoteManifestPages)
    VALUES (?, ?)
    ON CONFLICT(campaignId) DO UPDATE SET remoteManifestPages = excluded.remoteManifestPages
  `).run(campaignId, manifestPages);
}

export function isRemoteCheckFresh(campaignId: number, windowMs = REMOTE_FRESH_WINDOW_MS): boolean {
  const state = readRemoteCheckState(campaignId);
  if (!state.remoteCheckedAt) return false;
  // SQLite CURRENT_TIMESTAMP is UTC without a zone suffix.
  const checked = Date.parse(`${state.remoteCheckedAt.replace(" ", "T")}Z`);
  return Number.isFinite(checked) && Date.now() - checked < windowMs;
}

/**
 * Write a just-saved page straight into the cache so single-page reads return
 * the new body immediately. Without this, a saved page's stale cache row is
 * served until the next full refresh — the scheduled search rebuild does not
 * touch this table.
 */
export function upsertPageInCache(campaignId: number, page: WikiPage) {
  const db = getDb();
  db.prepare(`
    INSERT INTO campaign_page_cache (campaignId, slug, sha, pageJson, updatedAt)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(campaignId, slug) DO UPDATE SET
      sha = excluded.sha,
      pageJson = excluded.pageJson,
      updatedAt = CURRENT_TIMESTAMP
  `).run(campaignId, page.slug, page.sha || "", JSON.stringify(page));
}

type SearchIndexDocument = {
  sha?: string;
  slug: string;
  title?: string;
  category?: string;
  summary?: string;
  tags?: string[];
  aliases?: string[];
  visibility?: "gm" | "players";
  approvalStatus?: "approved" | "unapproved" | "rejected";
  links?: string[];
  backlinks?: string[];
  keyLinks?: string[];
  parent?: string;
};

function pageFromSearchDocument(doc: SearchIndexDocument): WikiPage {
  const name = doc.title || doc.slug.replace(/-/g, " ");
  const frontmatter = normalizeFrontmatter({
    name,
    title: name,
    category: doc.category || "npc",
    type: doc.category || "npc",
    summary: doc.summary || "",
    tags: doc.tags || [],
    aliases: doc.aliases || [],
    visibility: doc.visibility || "gm",
    approvalStatus: doc.approvalStatus || "approved",
    knownToPlayers: doc.visibility === "players",
    keyLinks: doc.keyLinks || [],
    parent: doc.parent
  }, name);
  return {
    slug: doc.slug,
    sha: doc.sha,
    frontmatter,
    content: "",
    raw: "",
    outgoingLinks: (doc.links || []).map((target) => ({ target, label: target })),
    backlinks: doc.backlinks || []
  };
}

export async function readSearchIndexPageSnapshot(storage: StorageAdapter): Promise<PageCacheSnapshot | null> {
  try {
    const file = await storage.getTextFile("wiki/search/index.json");
    const docs = JSON.parse(file.text) as Array<SearchIndexDocument & { category?: string }>;
    const pages = docs
      .filter((doc) => doc?.slug && doc.category !== "media" && !doc.slug.startsWith("media/"))
      .map(pageFromSearchDocument)
      .sort((a, b) => a.slug.localeCompare(b.slug));
    if (!pages.length) return null;
    return {
      pages,
      refreshedAt: null,
      refreshError: null,
      source: "search-index"
    };
  } catch {
    return null;
  }
}

export async function readManifestPageSnapshot(storage: StorageAdapter): Promise<PageCacheSnapshot | null> {
  try {
    const snapshot = await readRepositoryManifestSnapshot(storage);
    if (!snapshot.pages.length) return null;
    return {
      pages: snapshot.pages,
      refreshedAt: null,
      refreshError: null,
      source: "manifest"
    };
  } catch {
    return null;
  }
}

async function refresh(storage: StorageAdapter, campaign: Campaign): Promise<PageCacheSnapshot> {
  const db = getDb();
  try {
    const entries = await storage.listDirectoryTextFiles("wiki/pages");
    const cached = new Map(
      (db.prepare("SELECT slug, sha, pageJson, dirty FROM campaign_page_cache WHERE campaignId = ?").all(campaign.id) as Array<CacheRow & { dirty?: number }>).map(
        (row) => [row.slug, row]
      )
    );
    const dirtySlugs = new Set([...cached.values()].filter((row) => row.dirty).map((row) => row.slug));
    // Guardrail: a repository listing that suddenly shrinks by more than half
    // is far more likely a broken tree, truncated listing, or transient fault
    // than a real mass deletion. Refusing the sweep keeps the cache serving
    // good content; Repair indexes clears rows first and remains the override.
    if (cached.size >= 10 && entries.length * 2 < cached.size) {
      throw new Error(
        `Refusing to shrink the page cache from ${cached.size} to ${entries.length} pages — the repository listing looks incomplete. Run Repair indexes to rebuild from source if this is intentional.`
      );
    }
    const pages = await Promise.all(
      entries.map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, "");
        const existing = cached.get(slug);
        // A dirty row is an unsynced local edit — it outranks the remote copy
        // until the sync queue flushes or a conflict is resolved.
        if (existing?.dirty) {
          try {
            return { ...(JSON.parse(existing.pageJson) as WikiPage), sha: existing.sha };
          } catch {
            // Corrupt dirty row — fall through to source.
          }
        }
        if (existing?.sha === entry.sha) {
          try {
            return { ...(JSON.parse(existing.pageJson) as WikiPage), sha: existing.sha };
          } catch {
            // Corrupt row — re-parse below.
          }
        }
        if (entry.text !== null) return parsePage(slug, entry.text, entry.sha);
        const file = await storage.getTextFile(entry.path);
        return parsePage(slug, file.text, file.sha);
      })
    );
    const replace = db.transaction((nextPages: WikiPage[]) => {
      const slugs = new Set(nextPages.map((page) => page.slug));
      const deleteRow = db.prepare("DELETE FROM campaign_page_cache WHERE campaignId = ? AND slug = ? AND dirty = 0");
      for (const slug of cached.keys()) if (!slugs.has(slug)) deleteRow.run(campaign.id, slug);
      const upsert = db.prepare(`
        INSERT INTO campaign_page_cache (campaignId, slug, sha, pageJson, updatedAt)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(campaignId, slug) DO UPDATE SET
          sha = excluded.sha,
          pageJson = excluded.pageJson,
          updatedAt = CURRENT_TIMESTAMP
      `);
      for (const page of nextPages) upsert.run(campaign.id, page.slug, page.sha || "", JSON.stringify(page));
      db.prepare(`
        INSERT INTO campaign_page_cache_state (campaignId, refreshedAt, refreshError)
        VALUES (?, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(campaignId) DO UPDATE SET refreshedAt = CURRENT_TIMESTAMP, refreshError = NULL
      `).run(campaign.id);
    });
    replace(pages);
    const snapshot = readPageCache(campaign.id);
    return { ...snapshot, source: "full-refresh" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Page refresh failed.";
    db.prepare(`
      INSERT INTO campaign_page_cache_state (campaignId, refreshedAt, refreshError)
      VALUES (?, NULL, ?)
      ON CONFLICT(campaignId) DO UPDATE SET refreshError = excluded.refreshError
    `).run(campaign.id, message);
    throw error;
  }
}

export function refreshPageCache(storage: StorageAdapter, campaign: Campaign) {
  const active = refreshes.get(campaign.id);
  if (active) return active;
  const task = refresh(storage, campaign).finally(() => refreshes.delete(campaign.id));
  refreshes.set(campaign.id, task);
  return task;
}

export function refreshPageCacheInBackground(storage: StorageAdapter, campaign: Campaign) {
  void refreshPageCache(storage, campaign).catch((error) => {
    console.error(`Could not refresh page cache for campaign ${campaign.id}.`, error);
  });
}

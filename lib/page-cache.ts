import type { Campaign, WikiPage } from "@/lib/types";
import { getDb } from "@/lib/db";
import type { StorageAdapter } from "@/lib/storage";
import { normalizeFrontmatter, parsePage } from "@/lib/markdown";

type CacheRow = {
  slug: string;
  sha: string;
  pageJson: string;
};

export type PageCacheSnapshot = {
  pages: WikiPage[];
  refreshedAt: string | null;
  refreshError: string | null;
  source?: "cache" | "search-index" | "full-refresh";
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
    keyLinks: doc.keyLinks || []
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

async function refresh(storage: StorageAdapter, campaign: Campaign): Promise<PageCacheSnapshot> {
  const db = getDb();
  try {
    const entries = await storage.listDirectoryTextFiles("wiki/pages");
    const cached = new Map(
      (db.prepare("SELECT slug, sha, pageJson FROM campaign_page_cache WHERE campaignId = ?").all(campaign.id) as CacheRow[]).map(
        (row) => [row.slug, row]
      )
    );
    const pages = await Promise.all(
      entries.map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, "");
        const existing = cached.get(slug);
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
      const deleteRow = db.prepare("DELETE FROM campaign_page_cache WHERE campaignId = ? AND slug = ?");
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

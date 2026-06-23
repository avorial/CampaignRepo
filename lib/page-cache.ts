import type { Campaign, WikiPage } from "@/lib/types";
import { getDb } from "@/lib/db";
import { getTextFile, listDirectoryTextFiles } from "@/lib/github";
import { parsePage } from "@/lib/markdown";

type CacheRow = {
  slug: string;
  sha: string;
  pageJson: string;
};

export type PageCacheSnapshot = {
  pages: WikiPage[];
  refreshedAt: string | null;
  refreshError: string | null;
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
    refreshError: state?.refreshError || null
  };
}

async function refresh(token: string, campaign: Campaign): Promise<PageCacheSnapshot> {
  const db = getDb();
  try {
    const entries = await listDirectoryTextFiles(token, campaign, "wiki/pages");
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
            // A corrupt local row is repaired by fetching the source file below.
          }
        }
        if (entry.text !== null) return parsePage(slug, entry.text, entry.sha);
        // GraphQL omits blob text above its text-size limit. Fall back only
        // for that exceptional file instead of issuing a request per page.
        const file = await getTextFile(token, campaign, entry.path);
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
    return readPageCache(campaign.id);
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

export function refreshPageCache(token: string, campaign: Campaign) {
  const active = refreshes.get(campaign.id);
  if (active) return active;
  const task = refresh(token, campaign).finally(() => refreshes.delete(campaign.id));
  refreshes.set(campaign.id, task);
  return task;
}

export function refreshPageCacheInBackground(token: string, campaign: Campaign) {
  void refreshPageCache(token, campaign).catch((error) => {
    console.error(`Could not refresh page cache for campaign ${campaign.id}.`, error);
  });
}

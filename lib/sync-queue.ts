import type { Campaign, WikiPage } from "@/lib/types";
import type { StorageAdapter } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";
import { parsePage } from "@/lib/markdown";
import { scheduleSearchIndexRebuild } from "@/lib/search";
import { refreshPageCacheInBackground } from "@/lib/page-cache";

export type PageConflict = {
  id: number;
  campaignId: number;
  slug: string;
  baseSha: string | null;
  localRaw: string;
  remoteText: string;
  remoteSha: string;
  createdAt: string;
};

export type SyncResult = {
  ok: boolean;
  committed: number;
  conflicts: string[];
  error?: string;
};

/**
 * Record an unsynced local edit. The row is the working copy: reads serve it,
 * refresh and repair preserve it, and the sync queue flushes it to Git.
 * `baseSha` is the file sha the edit was made against, used for conflict
 * detection at flush time.
 */
export function markPageDirty(campaignId: number, page: WikiPage, baseSha?: string) {
  getDb().prepare(`
    INSERT INTO campaign_page_cache (campaignId, slug, sha, pageJson, updatedAt, dirty, lastSyncedSha, lastSyncError)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1, ?, NULL)
    ON CONFLICT(campaignId, slug) DO UPDATE SET
      sha = excluded.sha,
      pageJson = excluded.pageJson,
      updatedAt = CURRENT_TIMESTAMP,
      dirty = 1,
      lastSyncedSha = excluded.lastSyncedSha,
      lastSyncError = NULL
  `).run(campaignId, page.slug, baseSha || page.sha || "", JSON.stringify(page), baseSha || page.sha || null);
}

export function listDirtyPages(campaignId: number): Array<{ page: WikiPage; baseSha: string | null }> {
  const rows = getDb()
    .prepare("SELECT slug, pageJson, lastSyncedSha FROM campaign_page_cache WHERE campaignId = ? AND dirty = 1 ORDER BY slug")
    .all(campaignId) as Array<{ slug: string; pageJson: string; lastSyncedSha: string | null }>;
  return rows.flatMap((row) => {
    try {
      return [{ page: JSON.parse(row.pageJson) as WikiPage, baseSha: row.lastSyncedSha }];
    } catch {
      return [];
    }
  });
}

export function countDirtyPages(campaignId: number): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM campaign_page_cache WHERE campaignId = ? AND dirty = 1").get(campaignId) as { n: number };
  return row.n;
}

export function listPageConflicts(campaignId: number): PageConflict[] {
  return getDb().prepare("SELECT * FROM page_conflicts WHERE campaignId = ? ORDER BY slug").all(campaignId) as PageConflict[];
}

function recordConflict(campaignId: number, slug: string, baseSha: string | null, localRaw: string, remoteText: string, remoteSha: string) {
  getDb().prepare(`
    INSERT INTO page_conflicts (campaignId, slug, baseSha, localRaw, remoteText, remoteSha)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(campaignId, slug) DO UPDATE SET
      baseSha = excluded.baseSha,
      localRaw = excluded.localRaw,
      remoteText = excluded.remoteText,
      remoteSha = excluded.remoteSha,
      createdAt = CURRENT_TIMESTAMP
  `).run(campaignId, slug, baseSha, localRaw, remoteText, remoteSha);
}

function clearDirty(campaignId: number, slugs: string[]) {
  const db = getDb();
  const stmt = db.prepare("UPDATE campaign_page_cache SET dirty = 0, lastSyncError = NULL WHERE campaignId = ? AND slug = ?");
  const tx = db.transaction(() => {
    for (const slug of slugs) stmt.run(campaignId, slug);
  });
  tx();
}

function setSyncError(campaignId: number, slugs: string[], message: string) {
  const db = getDb();
  const stmt = db.prepare("UPDATE campaign_page_cache SET lastSyncError = ? WHERE campaignId = ? AND slug = ?");
  const tx = db.transaction(() => {
    for (const slug of slugs) stmt.run(message, campaignId, slug);
  });
  tx();
}

/**
 * Flush every dirty page in one commit.
 *
 * Before writing, each dirty page is compared against its remote copy: if the
 * remote moved past the edit's base sha with different content, the page is
 * excluded from the flush and recorded as a conflict — local content is never
 * silently overwritten in either direction. A missing remote file is treated
 * as a create. Commit failure keeps every dirty flag and records the error.
 */
export async function flushCampaignSync(storage: StorageAdapter, campaign: Campaign): Promise<SyncResult> {
  const dirty = listDirtyPages(campaign.id);
  if (!dirty.length) return { ok: true, committed: 0, conflicts: [] };

  const toCommit: Array<{ slug: string; raw: string }> = [];
  const conflicts: string[] = [];
  for (const { page, baseSha } of dirty) {
    try {
      const remote = await storage.getTextFile(`wiki/pages/${page.slug}.md`);
      const remoteMoved = Boolean(baseSha) && remote.sha !== baseSha;
      if (remoteMoved && remote.text !== page.raw) {
        recordConflict(campaign.id, page.slug, baseSha, page.raw, remote.text, remote.sha);
        conflicts.push(page.slug);
        continue;
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        setSyncError(campaign.id, [page.slug], error instanceof Error ? error.message : "Remote check failed.");
        return { ok: false, committed: 0, conflicts, error: error instanceof Error ? error.message : "Remote check failed." };
      }
      // 404: the page does not exist remotely yet — the flush creates it.
    }
    toCommit.push({ slug: page.slug, raw: page.raw });
  }

  if (toCommit.length) {
    try {
      await storage.commitFiles(
        toCommit.map((item) => ({ path: `wiki/pages/${item.slug}.md`, content: item.raw })),
        `CampaignRepo: sync ${toCommit.length} page${toCommit.length === 1 ? "" : "s"}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Git sync failed.";
      setSyncError(campaign.id, toCommit.map((item) => item.slug), message);
      return { ok: false, committed: 0, conflicts, error: message };
    }
    clearDirty(campaign.id, toCommit.map((item) => item.slug));
    scheduleSearchIndexRebuild(campaign);
    refreshPageCacheInBackground(storage, campaign);
  }

  return { ok: conflicts.length === 0, committed: toCommit.length, conflicts };
}

export type ConflictResolution = "local" | "remote";

/**
 * Resolve a recorded conflict. "local" pushes the local working copy over the
 * remote version (an explicit user choice, written against the remote sha);
 * "remote" adopts the remote version into the working copy and discards the
 * local edit.
 */
export async function resolvePageConflict(storage: StorageAdapter, campaign: Campaign, slug: string, resolution: ConflictResolution): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const conflict = db.prepare("SELECT * FROM page_conflicts WHERE campaignId = ? AND slug = ?").get(campaign.id, slug) as PageConflict | undefined;
  if (!conflict) return { ok: false, error: "No such conflict." };

  if (resolution === "remote") {
    const page = parsePage(slug, conflict.remoteText, conflict.remoteSha);
    db.prepare(`
      INSERT INTO campaign_page_cache (campaignId, slug, sha, pageJson, updatedAt, dirty, lastSyncedSha, lastSyncError)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 0, ?, NULL)
      ON CONFLICT(campaignId, slug) DO UPDATE SET
        sha = excluded.sha, pageJson = excluded.pageJson, updatedAt = CURRENT_TIMESTAMP,
        dirty = 0, lastSyncedSha = excluded.lastSyncedSha, lastSyncError = NULL
    `).run(campaign.id, slug, conflict.remoteSha, JSON.stringify(page), conflict.remoteSha);
    db.prepare("DELETE FROM page_conflicts WHERE campaignId = ? AND slug = ?").run(campaign.id, slug);
    return { ok: true };
  }

  try {
    const saved = await storage.putFile(`wiki/pages/${slug}.md`, conflict.localRaw, `CampaignRepo: resolve conflict on ${slug} (keep local)`, conflict.remoteSha);
    const page = parsePage(slug, conflict.localRaw, saved.sha);
    db.prepare(`
      UPDATE campaign_page_cache SET sha = ?, pageJson = ?, updatedAt = CURRENT_TIMESTAMP, dirty = 0, lastSyncedSha = ?, lastSyncError = NULL
      WHERE campaignId = ? AND slug = ?
    `).run(saved.sha || "", JSON.stringify(page), saved.sha || null, campaign.id, slug);
    db.prepare("DELETE FROM page_conflicts WHERE campaignId = ? AND slug = ?").run(campaign.id, slug);
    scheduleSearchIndexRebuild(campaign);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not write the local version." };
  }
}

const scheduledSyncs = new Map<number, ReturnType<typeof setTimeout>>();

/** Debounced background flush — the retry path for locally-saved edits. */
export function scheduleCampaignSync(campaign: Campaign, delayMs = 60_000) {
  const existing = scheduledSyncs.get(campaign.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    scheduledSyncs.delete(campaign.id);
    const storage = getStorageAdapter(campaign);
    if (!storage) return;
    void flushCampaignSync(storage, campaign).catch((error) => {
      console.error(`Background sync failed for campaign ${campaign.id}.`, error);
    });
  }, delayMs);
  scheduledSyncs.set(campaign.id, timer);
}

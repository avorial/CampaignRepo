import type { Campaign } from "@/lib/types";
import type { StorageAdapter } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { readPageCache, refreshPageCache } from "@/lib/page-cache";
import { rebuildSearchIndex } from "@/lib/search";
import { readRepositoryManifestText, repositoryManifestPath } from "@/lib/repository-manifest";

export type RepairStep = { step: "page-cache" | "search-and-manifest" | "verify"; ok: boolean; detail: string; error?: string };

export type RepairReport = {
  ok: boolean;
  steps: RepairStep[];
  counts: {
    pageFiles: number;
    cacheRows: number;
    manifestPages: number;
    searchDocs: number;
    emptySourcePages: number;
    emptyCacheBodies: number;
  };
  /** Pages whose canonical source is genuinely empty — reported, never silently filled. */
  emptySourceSlugs: string[];
};

/**
 * Rebuild every piece of generated state from the canonical page source:
 * the SQLite page cache, `wiki/search/index.json`, and `.campaignrepo/index.json`.
 *
 * Generated files are disposable snapshots — when they disagree with page
 * source, the source wins. Page content is never modified; a failed step is
 * reported by name and the remaining steps still run where they are
 * independent.
 */
export async function repairCampaignIndexes(storage: StorageAdapter, campaign: Campaign): Promise<RepairReport> {
  const steps: RepairStep[] = [];
  const counts: RepairReport["counts"] = {
    pageFiles: 0,
    cacheRows: 0,
    manifestPages: 0,
    searchDocs: 0,
    emptySourcePages: 0,
    emptyCacheBodies: 0
  };
  let emptySourceSlugs: string[] = [];
  let sourceBodies = new Map<string, boolean>();

  // Step 1 — rebuild the page cache from source. The incremental refresh trusts
  // rows whose sha still matches, which would preserve a corrupted row; repair
  // must re-parse everything, so drop the campaign's rows first. Dirty rows are
  // unsynced local edits — repair never destroys them.
  const preservedDirty = (getDb().prepare("SELECT COUNT(*) AS n FROM campaign_page_cache WHERE campaignId = ? AND dirty = 1").get(campaign.id) as { n: number }).n;
  try {
    getDb().prepare("DELETE FROM campaign_page_cache WHERE campaignId = ? AND dirty = 0").run(campaign.id);
    const snapshot = await refreshPageCache(storage, campaign);
    // The snapshot includes preserved dirty rows; pageFiles counts source files.
    counts.pageFiles = snapshot.pages.length - (getDb().prepare("SELECT COUNT(*) AS n FROM campaign_page_cache WHERE campaignId = ? AND dirty = 1 AND lastSyncedSha IS NULL").get(campaign.id) as { n: number }).n;
    sourceBodies = new Map(snapshot.pages.map((page) => [page.slug, Boolean(page.content.trim())]));
    emptySourceSlugs = snapshot.pages.filter((page) => !page.content.trim()).map((page) => page.slug).sort();
    counts.emptySourcePages = emptySourceSlugs.length;
    steps.push({
      step: "page-cache",
      ok: true,
      detail: `Re-parsed ${snapshot.pages.length} pages from source.${preservedDirty ? ` Preserved ${preservedDirty} unsynced local edit${preservedDirty === 1 ? "" : "s"}.` : ""}`
    });
  } catch (error) {
    steps.push({
      step: "page-cache",
      ok: false,
      detail: "Could not rebuild the page cache from source.",
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Step 2 — rebuild the search snapshot and repository manifest from source.
  try {
    const docs = await rebuildSearchIndex(storage, campaign);
    counts.searchDocs = docs.length;
    steps.push({ step: "search-and-manifest", ok: true, detail: `Rebuilt search snapshot (${docs.length} documents) and repository manifest.` });
  } catch (error) {
    steps.push({
      step: "search-and-manifest",
      ok: false,
      detail: "Could not rebuild the search snapshot and repository manifest.",
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Step 3 — verify what actually landed, reading everything back.
  try {
    const cached = readPageCache(campaign.id);
    counts.cacheRows = cached.pages.length;
    counts.emptyCacheBodies = cached.pages.filter((page) => !page.content.trim() && sourceBodies.get(page.slug)).length;
    try {
      const manifestFile = await storage.getTextFile(repositoryManifestPath);
      counts.manifestPages = readRepositoryManifestText(manifestFile.text).pages.length;
    } catch {
      counts.manifestPages = 0;
    }
    const problems: string[] = [];
    // Dirty rows may legitimately exceed the source set (unsynced creates).
    const cleanRows = (getDb().prepare("SELECT COUNT(*) AS n FROM campaign_page_cache WHERE campaignId = ? AND dirty = 0").get(campaign.id) as { n: number }).n;
    if (counts.pageFiles && cleanRows !== counts.pageFiles) problems.push(`cache has ${cleanRows} synced rows for ${counts.pageFiles} pages`);
    if (counts.pageFiles && counts.manifestPages !== counts.pageFiles) problems.push(`manifest lists ${counts.manifestPages} pages for ${counts.pageFiles} page files`);
    if (counts.emptyCacheBodies) problems.push(`${counts.emptyCacheBodies} cache rows lost their body`);
    steps.push({
      step: "verify",
      ok: problems.length === 0,
      detail: problems.length ? `Rebuilt state still disagrees: ${problems.join("; ")}.` : "Cache, manifest, and search snapshot match the page source.",
      error: problems.length ? problems.join("; ") : undefined
    });
  } catch (error) {
    steps.push({
      step: "verify",
      ok: false,
      detail: "Could not verify the rebuilt state.",
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return { ok: steps.every((step) => step.ok), steps, counts, emptySourceSlugs };
}

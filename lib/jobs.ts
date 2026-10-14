import { getCampaignRowById } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { rebuildSearchIndex } from "@/lib/search";
import { flushCampaignSync } from "@/lib/sync-queue";

import { clearPendingJob, executePendingJob, listOverduePendingJobs, type PendingJob } from "@/lib/pending-jobs";
export { clearPendingJob, persistPendingJob, listOverduePendingJobs } from "@/lib/pending-jobs";
export type { PendingJob, PendingJobKind } from "@/lib/pending-jobs";

let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

/** Run one overdue job. Exported for tests; the sweep calls it per row. */
export async function runPendingJob(job: PendingJob): Promise<boolean> {
  const campaign = getCampaignRowById(job.campaignId);
  if (!campaign) {
    clearPendingJob(job.campaignId, job.kind);
    return false;
  }
  return executePendingJob(job, async () => {
    const storage = getStorageAdapter(campaign);
    if (!storage) throw new Error("Campaign storage is unavailable.");
    if (job.kind === "rebuild") await rebuildSearchIndex(storage, campaign);
    else {
      const result = await flushCampaignSync(storage, campaign);
      if (result.error) throw new Error(result.error);
      // Conflicts require an explicit choice; retrying them cannot resolve them.
    }
  });
}

/**
 * Throttled recovery sweep, called from hot request paths. Runs at most once
 * a minute per process and never blocks the caller.
 */
export function sweepPendingJobs() {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  void (async () => {
    for (const job of listOverduePendingJobs(now)) {
      try {
        await runPendingJob(job);
      } catch (error) {
        console.error(`Pending ${job.kind} for campaign ${job.campaignId} failed; will retry on a later sweep.`, error);
      }
    }
  })();
}

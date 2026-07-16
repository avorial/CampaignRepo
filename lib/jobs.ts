import { getCampaignRowById, getDb } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { rebuildSearchIndex } from "@/lib/search";
import { flushCampaignSync } from "@/lib/sync-queue";

export type PendingJobKind = "rebuild" | "sync";
export type PendingJob = { campaignId: number; kind: PendingJobKind; dueAt: number };

/**
 * Durable shadow of the in-process schedule timers. The rebuild debounce and
 * sync retry live in `setTimeout`s that a container restart silently drops —
 * and this app redeploys on every push. Each schedule call writes a row here;
 * the timer deletes its row when it fires; the sweep executes whatever is
 * overdue, which after a restart is exactly the work the dropped timers owed.
 */
export function persistPendingJob(campaignId: number, kind: PendingJobKind, dueAt: number) {
  getDb().prepare(`
    INSERT INTO pending_jobs (campaignId, kind, dueAt)
    VALUES (?, ?, ?)
    ON CONFLICT(campaignId, kind) DO UPDATE SET dueAt = excluded.dueAt
  `).run(campaignId, kind, dueAt);
}

export function clearPendingJob(campaignId: number, kind: PendingJobKind) {
  getDb().prepare("DELETE FROM pending_jobs WHERE campaignId = ? AND kind = ?").run(campaignId, kind);
}

export function listOverduePendingJobs(now = Date.now()): PendingJob[] {
  return getDb().prepare("SELECT campaignId, kind, dueAt FROM pending_jobs WHERE dueAt <= ? ORDER BY dueAt").all(now) as PendingJob[];
}

let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

/** Run one overdue job. Exported for tests; the sweep calls it per row. */
export async function runPendingJob(job: PendingJob): Promise<boolean> {
  const campaign = getCampaignRowById(job.campaignId);
  if (!campaign) {
    clearPendingJob(job.campaignId, job.kind);
    return false;
  }
  const storage = getStorageAdapter(campaign);
  if (!storage) return false; // No token right now — leave the row for a later sweep.
  // Clear first so a crash mid-job cannot loop the same row forever; the job
  // kinds are idempotent rebuild/flush operations.
  clearPendingJob(job.campaignId, job.kind);
  if (job.kind === "rebuild") await rebuildSearchIndex(storage, campaign);
  else await flushCampaignSync(storage, campaign);
  return true;
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
        persistPendingJob(job.campaignId, job.kind, Date.now() + 5 * 60_000);
      }
    }
  })();
}

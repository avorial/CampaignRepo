import { getDb } from "@/lib/db";

export type PendingJobKind = "rebuild" | "sync";
export type PendingJob = { campaignId: number; kind: PendingJobKind; dueAt: number; revision?: number; attempts?: number; lastError?: string | null };
const running = new Set<string>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function persistPendingJob(campaignId: number, kind: PendingJobKind, dueAt: number) {
  const key = `${campaignId}:${kind}`;
  clearTimeout(retryTimers.get(key));
  retryTimers.delete(key);
  getDb().prepare(`
    INSERT INTO pending_jobs (campaignId, kind, dueAt, revision) VALUES (?, ?, ?, 1)
    ON CONFLICT(campaignId, kind) DO UPDATE SET dueAt = excluded.dueAt,
      revision = pending_jobs.revision + 1, attempts = 0, lastError = NULL
  `).run(campaignId, kind, dueAt);
}

export function clearPendingJob(campaignId: number, kind: PendingJobKind) {
  const key = `${campaignId}:${kind}`;
  clearTimeout(retryTimers.get(key));
  retryTimers.delete(key);
  getDb().prepare("DELETE FROM pending_jobs WHERE campaignId = ? AND kind = ?").run(campaignId, kind);
}

export function listOverduePendingJobs(now = Date.now()): PendingJob[] {
  return getDb().prepare("SELECT * FROM pending_jobs WHERE dueAt <= ? ORDER BY dueAt").all(now) as PendingJob[];
}

export function listCampaignPendingJobs(campaignId: number): PendingJob[] {
  return getDb().prepare("SELECT * FROM pending_jobs WHERE campaignId = ? ORDER BY dueAt").all(campaignId) as PendingJob[];
}

/** Keep durable intent until completion; a newer schedule must survive an older run. */
export async function executePendingJob(job: PendingJob, work: () => Promise<void>): Promise<boolean> {
  const key = `${job.campaignId}:${job.kind}`;
  if (running.has(key)) return false;
  const row = getDb().prepare("SELECT * FROM pending_jobs WHERE campaignId = ? AND kind = ?").get(job.campaignId, job.kind) as PendingJob | undefined;
  if (!row || row.dueAt > Date.now() || (job.revision !== undefined && job.revision !== row.revision)) return false;
  running.add(key);
  try {
    await work();
    getDb().prepare("DELETE FROM pending_jobs WHERE campaignId = ? AND kind = ? AND revision = ?").run(row.campaignId, row.kind, row.revision);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const delay = Math.min(5 * 60_000 * 2 ** Math.min(row.attempts || 0, 4), 60 * 60_000);
    const updated = getDb().prepare(`UPDATE pending_jobs SET dueAt = ?, attempts = attempts + 1, lastError = ?
      WHERE campaignId = ? AND kind = ? AND revision = ?`).run(Date.now() + delay, message, row.campaignId, row.kind, row.revision);
    if (updated.changes) {
      clearTimeout(retryTimers.get(key));
      const timer = setTimeout(() => {
        retryTimers.delete(key);
        void executePendingJob(row, work).catch(error => console.error("Could not execute queued retry.", error));
      }, delay);
      timer.unref?.();
      retryTimers.set(key, timer);
    }
    console.error(`Pending ${row.kind} for campaign ${row.campaignId} failed; retry queued.`, error);
    return false;
  } finally {
    running.delete(key);
  }
}

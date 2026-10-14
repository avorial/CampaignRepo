import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { executePendingJob, listCampaignPendingJobs, persistPendingJob, type PendingJob } from "@/lib/pending-jobs";

let campaignId = 100_000;
let job: PendingJob;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
  job = { campaignId: ++campaignId, kind: "sync", dueAt: Date.now() };
  persistPendingJob(job.campaignId, job.kind, job.dueAt);
});
afterEach(() => {
  getDb().prepare("DELETE FROM pending_jobs WHERE campaignId = ?").run(job.campaignId);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("durable job completion", () => {
  it("leaves interrupted work durable until its successful completion", async () => {
    let finish!: () => void;
    const run = executePendingJob(job, () => new Promise<void>(resolve => { finish = resolve; }));
    expect(listCampaignPendingJobs(job.campaignId)).toHaveLength(1);
    finish();
    expect(await run).toBe(true);
    expect(listCampaignPendingJobs(job.campaignId)).toEqual([]);
  });

  it("persists errors and automatically retries without another request", async () => {
    const work = vi.fn().mockRejectedValueOnce(new Error("Git unreachable")).mockResolvedValue(undefined);
    expect(await executePendingJob(job, work)).toBe(false);
    expect(listCampaignPendingJobs(job.campaignId)[0]).toMatchObject({ attempts: 1, lastError: "Git unreachable", dueAt: Date.now() + 5 * 60_000 });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(work).toHaveBeenCalledTimes(2);
    expect(listCampaignPendingJobs(job.campaignId)).toEqual([]);
  });

  it("caps repeated failure backoff at an hour", async () => {
    const work = vi.fn().mockRejectedValue(new Error("Unavailable"));
    await executePendingJob(job, work);
    for (const delay of [5, 10, 20, 40, 60, 60]) {
      expect(listCampaignPendingJobs(job.campaignId)[0].dueAt - Date.now()).toBe(delay * 60_000);
      await vi.advanceTimersByTimeAsync(delay * 60_000);
    }
    expect(listCampaignPendingJobs(job.campaignId)[0].attempts).toBe(7);
  });

  it("prevents a timer and request sweep from running the same job together", async () => {
    let finish!: () => void;
    const work = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = executePendingJob(job, work);
    expect(await executePendingJob(job, work)).toBe(false);
    expect(work).toHaveBeenCalledOnce();
    finish();
    await first;
  });

  it.each([false, true])("preserves a newer schedule when older work fails=%s", async fails => {
    let finish!: () => void;
    let fail!: (error: Error) => void;
    const first = executePendingJob(job, () => new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; }));
    // Same timestamp deliberately: the revision, not the time, identifies work.
    persistPendingJob(job.campaignId, job.kind, job.dueAt);
    if (fails) fail(new Error("Old failure")); else finish();
    await first;
    expect(listCampaignPendingJobs(job.campaignId)[0]).toMatchObject({ dueAt: job.dueAt, revision: 2, attempts: 0, lastError: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("recovers persisted retries when in-process timers are dropped", async () => {
    const work = vi.fn().mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValue(undefined);
    await executePendingJob(job, work);
    vi.clearAllTimers();
    vi.setSystemTime(Date.now() + 5 * 60_000);
    const persisted = listCampaignPendingJobs(job.campaignId)[0];
    expect(await executePendingJob(persisted, work)).toBe(true);
    expect(listCampaignPendingJobs(job.campaignId)).toEqual([]);
  });
});

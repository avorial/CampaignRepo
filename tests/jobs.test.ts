import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";

// getStorageAdapter lazy-requires ./storage-local for Next bundling; vitest's
// resolver can't follow that require. Importing storage-local INSIDE the mock
// factory would recurse into this very mock, so bridge via a hoisted holder
// filled after modules settle.
const adapterHolder = vi.hoisted(() => ({ make: null as null | ((localPath: string) => unknown) }));
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getStorageAdapter: (campaign: { localPath?: string | null }) =>
      campaign.localPath && adapterHolder.make ? adapterHolder.make(campaign.localPath) : null
  };
});
import { LocalFolderAdapter } from "@/lib/storage-local";
adapterHolder.make = (localPath: string) => new LocalFolderAdapter(localPath);
import os from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db";
import { clearPendingJob, listOverduePendingJobs, persistPendingJob, runPendingJob } from "@/lib/jobs";
import { scheduleSearchIndexRebuild } from "@/lib/search";
import { markPageDirty, countDirtyPages, scheduleCampaignSync } from "@/lib/sync-queue";
import { listCampaignPendingJobs } from "@/lib/pending-jobs";
import { parsePage } from "@/lib/markdown";
import type { Campaign } from "@/lib/types";

let campaign: Campaign;
let tmpDir = "";

beforeEach(() => {
  adapterHolder.make = (localPath: string) => new LocalFolderAdapter(localPath);
  const db = getDb();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crepo-jobs-"));
  fs.mkdirSync(path.join(tmpDir, "wiki", "pages"), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, "wiki", "media"), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, "wiki", "media", "media.json"), "{}");
  fs.writeFileSync(path.join(tmpDir, "wiki", "pages", "Seed.md"), "---\nname: Seed\ncategory: npc\ntype: npc\n---\n\nSeed body.");
  const userId = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run(`jobs-${Date.now()}-${Math.random()}@test`, "J", "x").lastInsertRowid);
  const campaignId = Number(
    db.prepare("INSERT INTO campaigns (userId, name, owner, repo, gameType, storageBackend, localPath) VALUES (?, ?, ?, ?, ?, 'local', ?)")
      .run(userId, "Jobs Test", "o", `jobs-${Date.now()}-${Math.random()}`, "Traveller", tmpDir).lastInsertRowid
  );
  campaign = { id: campaignId, userId, name: "Jobs Test", owner: "o", repo: "r", branch: "main", gameType: "Traveller", storageBackend: "local", localPath: tmpDir, createdAt: "" } as Campaign;
});

afterEach(() => {
  clearPendingJob(campaign.id, "sync");
  clearPendingJob(campaign.id, "rebuild");
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("pending jobs survive restarts", () => {
  it.each(["sweep", "timer"])("retains dirty pages and a retry when %s sync returns failure", async path => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    adapterHolder.make = localPath => {
      const storage = new LocalFolderAdapter(localPath);
      storage.commitFiles = vi.fn().mockRejectedValue(new Error("Git unreachable"));
      return storage;
    };
    markPageDirty(campaign.id, parsePage("Recovered", "---\nname: Recovered\n---\nSaved locally."));
    if (path === "timer") {
      scheduleCampaignSync(campaign, 100);
      await vi.advanceTimersByTimeAsync(100);
      await vi.waitFor(() => expect(listCampaignPendingJobs(campaign.id)[0]?.attempts).toBe(1));
    } else {
      persistPendingJob(campaign.id, "sync", Date.now());
      expect(await runPendingJob({ campaignId: campaign.id, kind: "sync", dueAt: Date.now() })).toBe(false);
    }
    expect(countDirtyPages(campaign.id)).toBe(1);
    expect(listCampaignPendingJobs(campaign.id)[0]).toMatchObject({ kind: "sync", attempts: 1, lastError: "Git unreachable" });
  });

  it("retains timer-driven rebuild failures for retry", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    adapterHolder.make = localPath => {
      const storage = new LocalFolderAdapter(localPath);
      storage.commitFiles = vi.fn().mockRejectedValue(new Error("Index write failed"));
      return storage;
    };
    scheduleSearchIndexRebuild(campaign, 100);
    await vi.advanceTimersByTimeAsync(100);
    await vi.waitFor(() => expect(listCampaignPendingJobs(campaign.id)[0]?.attempts).toBe(1));
    expect(listCampaignPendingJobs(campaign.id)[0]).toMatchObject({ kind: "rebuild", attempts: 1, lastError: "Index write failed" });
  });

  it("keeps unavailable-storage jobs queued rather than dropping them", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    adapterHolder.make = null;
    persistPendingJob(campaign.id, "sync", Date.now());
    expect(await runPendingJob({ campaignId: campaign.id, kind: "sync", dueAt: Date.now() })).toBe(false);
    expect(listCampaignPendingJobs(campaign.id)[0]).toMatchObject({ attempts: 1, lastError: "Campaign storage is unavailable." });
  });

  it("does not repeatedly retry conflicts requiring a user choice", async () => {
    vi.useFakeTimers();
    const storage = new LocalFolderAdapter(tmpDir);
    const base = await storage.getTextFile("wiki/pages/Seed.md");
    markPageDirty(campaign.id, parsePage("Seed", "---\nname: Seed\n---\nLocal changes.", base.sha), base.sha);
    await storage.putFile("wiki/pages/Seed.md", "---\nname: Seed\n---\nRemote changes.", "Remote edit", base.sha);
    persistPendingJob(campaign.id, "sync", Date.now());
    expect(await runPendingJob({ campaignId: campaign.id, kind: "sync", dueAt: Date.now() })).toBe(true);
    expect(countDirtyPages(campaign.id)).toBe(1);
    expect(listCampaignPendingJobs(campaign.id)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("schedules persist a durable row that outlives the in-process timer", () => {
    vi.useFakeTimers();
    try {
      scheduleSearchIndexRebuild(campaign, 60_000);
      // A restart would drop the setTimeout; the row is what survives.
      const rows = listOverduePendingJobs(Date.now() + 120_000);
      expect(rows.some((row) => row.campaignId === campaign.id && row.kind === "rebuild")).toBe(true);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      clearPendingJob(campaign.id, "rebuild");
    }
  });

  it("only reports jobs that are actually due", () => {
    persistPendingJob(campaign.id, "sync", Date.now() + 60_000);
    expect(listOverduePendingJobs().some((row) => row.campaignId === campaign.id)).toBe(false);
    persistPendingJob(campaign.id, "sync", Date.now() - 1_000);
    expect(listOverduePendingJobs().some((row) => row.campaignId === campaign.id && row.kind === "sync")).toBe(true);
    clearPendingJob(campaign.id, "sync");
  });

  it("runs an overdue sync job end-to-end and clears its row", async () => {
    vi.useFakeTimers();
    try {
      markPageDirty(campaign.id, parsePage("Recovered", "---\nname: Recovered\ncategory: npc\ntype: npc\n---\n\nEdited while Git was down."));
      persistPendingJob(campaign.id, "sync", Date.now() - 1_000);

      const ran = await runPendingJob({ campaignId: campaign.id, kind: "sync", dueAt: Date.now() - 1_000 });

      expect(ran).toBe(true);
      expect(countDirtyPages(campaign.id)).toBe(0);
      expect(fs.readFileSync(path.join(tmpDir, "wiki", "pages", "Recovered.md"), "utf8")).toContain("Edited while Git was down.");
      // The flush schedules a fresh (not yet due) rebuild — nothing overdue remains.
      expect(listOverduePendingJobs().some((row) => row.campaignId === campaign.id)).toBe(false);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      clearPendingJob(campaign.id, "rebuild");
    }
  });

  it("drops rows for campaigns that no longer exist", async () => {
    const ran = await runPendingJob({ campaignId: 999_999, kind: "rebuild", dueAt: 0 });
    expect(ran).toBe(false);
  });
});

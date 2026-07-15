import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/search", () => ({ scheduleSearchIndexRebuild: vi.fn() }));

import { countDirtyPages, flushCampaignSync, listPageConflicts, markPageDirty, resolvePageConflict } from "@/lib/sync-queue";
import { readPageCache, refreshPageCache } from "@/lib/page-cache";
import { parsePage } from "@/lib/markdown";
import { getDb } from "@/lib/db";
import { StorageError, type StorageAdapter } from "@/lib/storage";
import type { Campaign } from "@/lib/types";

function makeStorage(files: Map<string, string>, overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  const inDir = (dir: string) => [...files.keys()].filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes("/"));
  const sha = (path: string) => `sha-${files.get(path)!.length}-${path}`;
  return {
    isLocal: true,
    async getContent(path) {
      if (!files.has(path)) throw new StorageError("Not found", 404);
      return { content: files.get(path)!, sha: sha(path), type: "file" };
    },
    async getTextFile(path) {
      if (!files.has(path)) throw new StorageError("Not found", 404);
      return { sha: sha(path), text: files.get(path)! };
    },
    async getRawFile() { throw new StorageError("Not found", 404); },
    async listDirectory(dir) {
      return inDir(dir).map((path) => ({ name: path.split("/").pop()!, path, sha: sha(path), type: "file" }));
    },
    async listDirectoryTextFiles(dir, extension = ".md") {
      return inDir(dir).filter((path) => path.endsWith(extension)).map((path) => ({ name: path.split("/").pop()!, path, sha: sha(path), text: files.get(path)! }));
    },
    async putFile(path, content) {
      files.set(path, content);
      return { sha: sha(path) };
    },
    async putBase64File(path) { return { sha: `sha-${path}` }; },
    async deleteFile(path) { files.delete(path); },
    async commitFiles(changes) {
      for (const change of changes) {
        if (change.delete) files.delete(change.path);
        else files.set(change.path, change.content || "");
      }
      return { commit: "fake", files: changes.length };
    },
    async ensureFile(path, content) { if (!files.has(path)) files.set(path, content); },
    async listFileCommits() { return []; },
    async listRecentCommits() { return []; },
    async initializeRepo() {},
    ...overrides
  };
}

function pageText(name: string, body: string) {
  return `---\nname: ${name}\ncategory: npc\ntype: npc\nvisibility: gm\napprovalStatus: approved\n---\n\n${body}`;
}

let campaign: Campaign;

beforeEach(() => {
  const db = getDb();
  const userId = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run(`sync-${Date.now()}-${Math.random()}@test`, "S", "x").lastInsertRowid);
  const campaignId = Number(
    db.prepare("INSERT INTO campaigns (userId, name, owner, repo, gameType) VALUES (?, ?, ?, ?, ?)").run(userId, "Sync Test", "o", `sync-${Date.now()}-${Math.random()}`, "Traveller").lastInsertRowid
  );
  campaign = { id: campaignId, userId, name: "Sync Test", owner: "o", repo: "r", branch: "main", gameType: "Traveller", storageBackend: "local", localPath: "mock", createdAt: "" } as Campaign;
});

describe("batched sync queue", () => {
  it("flushes many dirty edits as one commit and clears the flags", async () => {
    const files = new Map([["wiki/media/media.json", "{}"]]);
    const storage = makeStorage(files);
    const commitSpy = vi.spyOn(storage, "commitFiles");
    for (let i = 1; i <= 20; i++) {
      markPageDirty(campaign.id, parsePage(`Page-${String(i).padStart(2, "0")}`, pageText(`Page ${i}`, `Body ${i}.`)));
    }
    expect(countDirtyPages(campaign.id)).toBe(20);

    const result = await flushCampaignSync(storage, campaign);

    expect(result).toMatchObject({ ok: true, committed: 20, conflicts: [] });
    expect(commitSpy).toHaveBeenCalledOnce();
    expect((commitSpy.mock.calls[0][0] as unknown[]).length).toBe(20);
    expect(countDirtyPages(campaign.id)).toBe(0);
    expect(files.get("wiki/pages/Page-07.md")).toContain("Body 7.");
  });

  it("keeps every edit dirty with the error recorded when the commit fails", async () => {
    const storage = makeStorage(new Map(), {
      commitFiles: async () => { throw new Error("GitHub timeout"); }
    });
    markPageDirty(campaign.id, parsePage("Solo", pageText("Solo", "Local body.")));

    const result = await flushCampaignSync(storage, campaign);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("GitHub timeout");
    expect(countDirtyPages(campaign.id)).toBe(1);
    const row = getDb().prepare("SELECT lastSyncError FROM campaign_page_cache WHERE campaignId = ? AND slug = 'Solo'").get(campaign.id) as { lastSyncError: string };
    expect(row.lastSyncError).toContain("GitHub timeout");
  });

  it("records a conflict instead of overwriting a remote edit, and commits the rest", async () => {
    const base = pageText("Contested", "Base body.");
    const files = new Map([["wiki/pages/Contested.md", base]]);
    const storage = makeStorage(files);
    const baseSha = (await storage.getTextFile("wiki/pages/Contested.md")).sha;
    // Local edit against the base…
    markPageDirty(campaign.id, parsePage("Contested", pageText("Contested", "Local change."), baseSha), baseSha);
    // …then the remote moves with different content.
    files.set("wiki/pages/Contested.md", pageText("Contested", "Remote change happened first."));
    // A second, unrelated dirty page should still flush.
    markPageDirty(campaign.id, parsePage("Peaceful", pageText("Peaceful", "No contest.")));

    const result = await flushCampaignSync(storage, campaign);

    expect(result.committed).toBe(1);
    expect(result.conflicts).toEqual(["Contested"]);
    // The remote version was NOT overwritten.
    expect(files.get("wiki/pages/Contested.md")).toContain("Remote change happened first.");
    expect(files.get("wiki/pages/Peaceful.md")).toContain("No contest.");
    expect(listPageConflicts(campaign.id).map((conflict) => conflict.slug)).toEqual(["Contested"]);
    expect(countDirtyPages(campaign.id)).toBe(1);
  });

  it("resolves a conflict by keeping the local edit", async () => {
    const files = new Map([["wiki/pages/Contested.md", pageText("Contested", "Base.")]]);
    const storage = makeStorage(files);
    const baseSha = (await storage.getTextFile("wiki/pages/Contested.md")).sha;
    markPageDirty(campaign.id, parsePage("Contested", pageText("Contested", "Local wins."), baseSha), baseSha);
    files.set("wiki/pages/Contested.md", pageText("Contested", "Remote version."));
    await flushCampaignSync(storage, campaign);

    const result = await resolvePageConflict(storage, campaign, "Contested", "local");

    expect(result.ok).toBe(true);
    expect(files.get("wiki/pages/Contested.md")).toContain("Local wins.");
    expect(listPageConflicts(campaign.id)).toHaveLength(0);
    expect(countDirtyPages(campaign.id)).toBe(0);
  });

  it("resolves a conflict by adopting the remote version", async () => {
    const files = new Map([["wiki/pages/Contested.md", pageText("Contested", "Base.")]]);
    const storage = makeStorage(files);
    const baseSha = (await storage.getTextFile("wiki/pages/Contested.md")).sha;
    markPageDirty(campaign.id, parsePage("Contested", pageText("Contested", "Local loses."), baseSha), baseSha);
    files.set("wiki/pages/Contested.md", pageText("Contested", "Remote version."));
    await flushCampaignSync(storage, campaign);

    const result = await resolvePageConflict(storage, campaign, "Contested", "remote");

    expect(result.ok).toBe(true);
    // The repo keeps the remote text; the working copy adopts it, clean.
    expect(files.get("wiki/pages/Contested.md")).toContain("Remote version.");
    expect(readPageCache(campaign.id).pages.find((page) => page.slug === "Contested")?.content).toContain("Remote version.");
    expect(listPageConflicts(campaign.id)).toHaveLength(0);
    expect(countDirtyPages(campaign.id)).toBe(0);
  });
});

describe("dirty rows survive refresh", () => {
  it("keeps unsynced local content through a full cache refresh", async () => {
    const files = new Map([["wiki/pages/Hero.md", pageText("Hero", "Remote body.")]]);
    const storage = makeStorage(files);
    markPageDirty(campaign.id, parsePage("Hero", pageText("Hero", "Unsynced local body.")));

    const snapshot = await refreshPageCache(storage, campaign);

    expect(snapshot.pages.find((page) => page.slug === "Hero")?.content).toContain("Unsynced local body.");
    expect(countDirtyPages(campaign.id)).toBe(1);
  });
});

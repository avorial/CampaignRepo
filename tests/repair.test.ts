import { beforeEach, describe, expect, it } from "vitest";
import { repairCampaignIndexes } from "@/lib/repair";
import { readPageCache, upsertPageInCache } from "@/lib/page-cache";
import { readRepositoryManifestText, repositoryManifestPath } from "@/lib/repository-manifest";
import { parsePage } from "@/lib/markdown";
import { getDb, searchDocs } from "@/lib/db";
import { StorageError, type StorageAdapter, type StorageDirEntry, type StorageTextEntry } from "@/lib/storage";
import type { Campaign } from "@/lib/types";

/** Minimal in-memory storage adapter backed by a path -> text map. */
function makeStorage(files: Map<string, string>): StorageAdapter {
  const inDir = (dir: string) => [...files.keys()].filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes("/"));
  return {
    isLocal: true,
    async getContent(path) {
      if (!files.has(path)) throw new StorageError("Not found", 404);
      return { content: files.get(path)!, sha: `sha-${path}`, type: "file" };
    },
    async getTextFile(path) {
      if (!files.has(path)) throw new StorageError("Not found", 404);
      return { sha: `sha-${files.get(path)!.length}-${path}`, text: files.get(path)! };
    },
    async getRawFile() {
      throw new StorageError("Not found", 404);
    },
    async listDirectory(dir): Promise<StorageDirEntry[]> {
      return inDir(dir).map((path) => ({ name: path.split("/").pop()!, path, sha: `sha-${path}`, type: "file" }));
    },
    async listDirectoryTextFiles(dir, extension = ".md"): Promise<StorageTextEntry[]> {
      return inDir(dir)
        .filter((path) => path.endsWith(extension))
        .map((path) => ({ name: path.split("/").pop()!, path, sha: `sha-${files.get(path)!.length}-${path}`, text: files.get(path)! }));
    },
    async putFile(path, content) {
      files.set(path, content);
      return { sha: `sha-${content.length}-${path}` };
    },
    async putBase64File(path) {
      return { sha: `sha-${path}` };
    },
    async deleteFile(path) {
      files.delete(path);
    },
    async commitFiles(changes) {
      for (const change of changes) {
        if (change.delete) files.delete(change.path);
        else files.set(change.path, change.content || "");
      }
      return { commit: "fake", files: changes.length };
    },
    async ensureFile(path, content) {
      if (!files.has(path)) files.set(path, content);
    },
    async listFileCommits() {
      return [];
    },
    async listRecentCommits() {
      return [];
    },
    async initializeRepo() {}
  };
}

function page(name: string, body: string, extra = "") {
  return `---\nname: ${name}\ncategory: npc\ntype: npc\nvisibility: gm\napprovalStatus: approved\n${extra}---\n\n${body}`;
}

let campaign: Campaign;
let ownerId = 0;

beforeEach(() => {
  const db = getDb();
  const userId = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run(`repair-${Date.now()}-${Math.random()}@test`, "R", "x").lastInsertRowid);
  ownerId = userId;
  const campaignId = Number(
    db.prepare("INSERT INTO campaigns (userId, name, owner, repo, gameType) VALUES (?, ?, ?, ?, ?)").run(userId, "Repair Test", "o", `repair-${Date.now()}-${Math.random()}`, "Traveller").lastInsertRowid
  );
  db.prepare("INSERT INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, 'owner')").run(campaignId, userId);
  campaign = { id: campaignId, userId, name: "Repair Test", owner: "o", repo: "r", branch: "main", gameType: "Traveller", storageBackend: "local", localPath: "mock", createdAt: "" } as Campaign;
});

function seedFiles() {
  return new Map<string, string>([
    ["wiki/pages/Alain.md", page("Alain", "Alain body with [[Jardin]].")],
    ["wiki/pages/Jardin.md", page("Jardin", "Jardin body.")],
    ["wiki/media/media.json", "{}"]
  ]);
}

describe("repairCampaignIndexes", () => {
  it("recreates a deleted manifest and search snapshot from page source", async () => {
    const files = seedFiles();
    expect(files.has(repositoryManifestPath)).toBe(false);
    expect(files.has("wiki/search/index.json")).toBe(false);

    const report = await repairCampaignIndexes(makeStorage(files), campaign);

    expect(report.ok).toBe(true);
    expect(report.counts.pageFiles).toBe(2);
    const manifest = readRepositoryManifestText(files.get(repositoryManifestPath)!);
    expect(manifest.pages).toHaveLength(2);
    const searchDocs = JSON.parse(files.get("wiki/search/index.json")!) as Array<{ slug: string }>;
    expect(searchDocs.filter((doc) => !String(doc.slug).startsWith("media/"))).toHaveLength(2);
    expect(report.counts.manifestPages).toBe(2);
    expect(report.counts.cacheRows).toBe(2);
  });

  it("replaces a corrupted cache row from source even when its sha matches", async () => {
    const files = seedFiles();
    const storage = makeStorage(files);
    // Poison the cache: same sha the refresh would compute, but an empty body.
    const sourceText = files.get("wiki/pages/Alain.md")!;
    const sha = `sha-${sourceText.length}-wiki/pages/Alain.md`;
    const poisoned = { ...parsePage("Alain", sourceText, sha), content: "", raw: "" };
    upsertPageInCache(campaign.id, poisoned);
    expect(readPageCache(campaign.id).pages.find((row) => row.slug === "Alain")?.content).toBe("");

    const report = await repairCampaignIndexes(storage, campaign);

    expect(report.ok).toBe(true);
    expect(report.counts.emptyCacheBodies).toBe(0);
    expect(readPageCache(campaign.id).pages.find((row) => row.slug === "Alain")?.content).toContain("Alain body");
  });

  it("reports genuinely empty source pages without filling them", async () => {
    const files = seedFiles();
    files.set("wiki/pages/Blank.md", page("Blank", ""));

    const report = await repairCampaignIndexes(makeStorage(files), campaign);

    expect(report.ok).toBe(true);
    expect(report.emptySourceSlugs).toEqual(["Blank"]);
    expect(report.counts.emptySourcePages).toBe(1);
    // The page source itself is untouched — still an empty body.
    expect(parsePage("Blank", files.get("wiki/pages/Blank.md")!).content.trim()).toBe("");
  });

  it("commits a lean snapshot: excerpts instead of full bodies, while SQLite keeps full-text search", async () => {
    const files = seedFiles();

    await repairCampaignIndexes(makeStorage(files), campaign);

    const committed = JSON.parse(files.get("wiki/search/index.json")!) as Array<{ slug: string; text: string; playerText: string; excerpt?: string }>;
    const alainDoc = committed.find((doc) => doc.slug === "Alain")!;
    // No full bodies in the committed file — it is a navigation index, not a content store.
    expect(alainDoc.text).toBe("");
    expect(alainDoc.playerText).toBe("");
    expect(alainDoc.excerpt).toContain("Alain body");
    // Live full-text search still finds body words via SQLite.
    const hits = searchDocs(ownerId, "body", campaign.id, "gm");
    expect(hits.map((hit) => hit.slug).sort()).toEqual(["Alain", "Jardin"]);
  });

  it("names the failed step and keeps going when the snapshot write fails", async () => {
    const files = seedFiles();
    const storage = makeStorage(files);
    storage.commitFiles = async () => {
      throw new Error("GitHub timeout");
    };

    const report = await repairCampaignIndexes(storage, campaign);

    expect(report.ok).toBe(false);
    const failed = report.steps.find((step) => !step.ok);
    expect(failed?.step).toBe("search-and-manifest");
    expect(failed?.error).toContain("GitHub timeout");
    // The cache step still completed from source.
    expect(report.steps.find((step) => step.step === "page-cache")?.ok).toBe(true);
    expect(report.counts.cacheRows).toBe(2);
  });
});

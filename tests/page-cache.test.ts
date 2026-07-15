import { beforeAll, describe, expect, it, vi } from "vitest";
import { readManifestPageSnapshot, readPageCache, readSearchIndexPageSnapshot, removePageFromCache, upsertPageInCache } from "@/lib/page-cache";
import { parsePage } from "@/lib/markdown";
import { getDb } from "@/lib/db";
import type { StorageAdapter } from "@/lib/storage";

let CAMPAIGN_ID = 0;

beforeAll(() => {
  const db = getDb();
  const userId = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("cache@test", "Cache", "x").lastInsertRowid);
  CAMPAIGN_ID = Number(
    db.prepare("INSERT INTO campaigns (userId, name, owner, repo, gameType) VALUES (?, ?, ?, ?, ?)").run(userId, "Cache Test", "o", "cache-repo", "Traveller").lastInsertRowid
  );
});

describe("page cache upserts", () => {
  it("serves a just-saved page body without waiting for a refresh", () => {
    const first = parsePage("Hero", "---\nname: Hero\ncategory: npc\n---\n\nOld body.\n", "sha-1");
    upsertPageInCache(CAMPAIGN_ID, first);
    expect(readPageCache(CAMPAIGN_ID).pages.find((page) => page.slug === "Hero")?.content).toContain("Old body.");

    const updated = parsePage("Hero", "---\nname: Hero\ncategory: npc\n---\n\nNew body.\n", "sha-2");
    upsertPageInCache(CAMPAIGN_ID, updated);

    const cached = readPageCache(CAMPAIGN_ID).pages.find((page) => page.slug === "Hero");
    expect(cached?.content).toContain("New body.");
    expect(cached?.sha).toBe("sha-2");

    removePageFromCache(CAMPAIGN_ID, "Hero");
    expect(readPageCache(CAMPAIGN_ID).pages.find((page) => page.slug === "Hero")).toBeUndefined();
  });
});

describe("remote freshness window", () => {
  it("round-trips the remote check stamp and reports freshness", async () => {
    const { isRemoteCheckFresh, readRemoteCheckState, stampRemoteCheck } = await import("@/lib/page-cache");
    expect(isRemoteCheckFresh(CAMPAIGN_ID)).toBe(false);

    stampRemoteCheck(CAMPAIGN_ID, "head-abc");

    expect(readRemoteCheckState(CAMPAIGN_ID).remoteHeadSha).toBe("head-abc");
    expect(isRemoteCheckFresh(CAMPAIGN_ID)).toBe(true);
    // A zero-length window is immediately stale.
    expect(isRemoteCheckFresh(CAMPAIGN_ID, 0)).toBe(false);
  });
});

describe("snapshot source labels", () => {
  it("labels each snapshot with the source it actually came from", async () => {
    const manifestStorage = {
      getTextFile: vi.fn(async () => ({
        sha: "m",
        text: JSON.stringify({
          schemaVersion: 1,
          generatedAt: "2026-07-13T18:00:00.000Z",
          pages: [{ id: "npc-a", title: "A", path: "wiki/pages/a.md", type: "npc", tags: [], links: [], parent: "jardin" }]
        })
      }))
    } as unknown as StorageAdapter;
    const searchStorage = {
      getTextFile: vi.fn(async () => ({
        sha: "s",
        text: JSON.stringify([{ slug: "a", title: "A", category: "npc", parent: "jardin" }])
      }))
    } as unknown as StorageAdapter;

    await expect(readManifestPageSnapshot(manifestStorage)).resolves.toMatchObject({
      source: "manifest",
      pages: [expect.objectContaining({ frontmatter: expect.objectContaining({ parent: "jardin" }) })]
    });
    await expect(readSearchIndexPageSnapshot(searchStorage)).resolves.toMatchObject({
      source: "search-index",
      pages: [expect.objectContaining({ frontmatter: expect.objectContaining({ parent: "jardin" }) })]
    });
  });
});

describe("refresh sweep guard", () => {
  it("refuses to shrink a populated cache when the listing collapses", async () => {
    const { refreshPageCache, upsertPageInCache, readPageCache } = await import("@/lib/page-cache");
    const { parsePage } = await import("@/lib/markdown");
    // Seed 20 clean rows.
    for (let i = 0; i < 20; i++) {
      upsertPageInCache(CAMPAIGN_ID, parsePage(`Guard-${i}`, `---\nname: Guard ${i}\ncategory: npc\n---\n\nBody ${i}.`, `sha-${i}`));
    }
    // A broken listing returns only 2 files.
    const brokenStorage = {
      isLocal: true,
      async listDirectoryTextFiles() {
        return [
          { name: "Guard-0.md", path: "wiki/pages/Guard-0.md", sha: "sha-0", text: "---\nname: Guard 0\ncategory: npc\n---\n\nBody 0." },
          { name: "Guard-1.md", path: "wiki/pages/Guard-1.md", sha: "sha-1", text: "---\nname: Guard 1\ncategory: npc\n---\n\nBody 1." }
        ];
      },
      async getTextFile() { throw new Error("unused"); }
    } as unknown as Parameters<typeof refreshPageCache>[0];

    await expect(refreshPageCache(brokenStorage, { id: CAMPAIGN_ID } as any)).rejects.toThrow(/Refusing to shrink/);
    // The good rows are still there.
    expect(readPageCache(CAMPAIGN_ID).pages.length).toBe(20);
  });
});

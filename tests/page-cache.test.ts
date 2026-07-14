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

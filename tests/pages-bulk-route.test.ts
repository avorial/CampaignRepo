import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listDirectoryTextFiles: vi.fn(),
  getTextFile: vi.fn(),
  commitFiles: vi.fn(),
  rebuildSearchIndex: vi.fn(),
  upsertPageInCache: vi.fn(),
  removePageFromCache: vi.fn(),
  deleteSearchDocument: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({ id: 1, name: "GM", githubToken: "token" }))
}));

vi.mock("@/lib/db", () => ({
  getCampaign: vi.fn(() => ({ id: 7, name: "Sparks", owner: "owner", repo: "repo", branch: "main", gameType: "Other" })),
  canManageCampaign: vi.fn(() => true),
  deleteSearchDocument: mocks.deleteSearchDocument
}));

vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({
    listDirectoryTextFiles: mocks.listDirectoryTextFiles,
    getTextFile: mocks.getTextFile,
    commitFiles: mocks.commitFiles
  }))
}));

vi.mock("@/lib/page-cache", () => ({
  upsertPageInCache: mocks.upsertPageInCache,
  removePageFromCache: mocks.removePageFromCache
}));

vi.mock("@/lib/search", () => ({
  rebuildSearchIndex: mocks.rebuildSearchIndex
}));

import { PATCH } from "@/app/api/campaigns/[id]/pages/bulk/route";

const pageText = `---
name: Sparks Guild
category: npc
type: npc
summary: Old summary
visibility: players
approvalStatus: approved
knownToPlayers: true
tags: []
aliases: []
---

## Notes

The sparks are organizing.
`;

const childPageText = `---
name: Arcology Hall
category: location
type: location
summary: Child page
visibility: players
approvalStatus: approved
knownToPlayers: true
tags: []
aliases: []
---

## Notes

A place that should nest.
`;

const manifestText = JSON.stringify({
  schemaVersion: 1,
  generatedAt: "2026-07-14T00:00:00.000Z",
  pages: [
    {
      id: "npc-sparks-guild",
      title: "Sparks Guild",
      path: "wiki/pages/sparks-guild.md",
      type: "npc",
      tags: [],
      links: [],
      aliases: [],
      summary: "Old summary",
      visibility: "players",
      approvalStatus: "approved",
      keyLinks: []
    },
    {
      id: "lore-sparks-background",
      title: "Sparks Background",
      path: "wiki/pages/sparks-background.md",
      type: "lore",
      tags: [],
      links: ["npc-sparks-guild"],
      aliases: [],
      summary: "",
      visibility: "players",
      approvalStatus: "approved",
      keyLinks: []
    }
  ]
});

describe("bulk page edits", () => {
  beforeEach(() => {
    mocks.listDirectoryTextFiles.mockReset();
    mocks.getTextFile.mockReset();
    mocks.commitFiles.mockReset();
    mocks.rebuildSearchIndex.mockReset();
    mocks.upsertPageInCache.mockReset();
  });

  it("updates the repository manifest when changing page category", async () => {
    mocks.listDirectoryTextFiles.mockResolvedValueOnce([
      { name: "sparks-guild.md", path: "wiki/pages/sparks-guild.md", text: pageText, sha: "page-sha" }
    ]);
    mocks.getTextFile.mockResolvedValueOnce({ text: manifestText, sha: "manifest-sha" });
    mocks.commitFiles.mockResolvedValueOnce({ commit: "commit", files: 2 });
    mocks.rebuildSearchIndex.mockResolvedValueOnce([]);

    const response = await PATCH(
      new Request("http://localhost/api/campaigns/7/pages/bulk", {
        method: "PATCH",
        body: JSON.stringify({ slugs: ["sparks-guild"], set: { category: "organization" } })
      }),
      { params: Promise.resolve({ id: "7" }) }
    );

    await expect(response.json()).resolves.toEqual({ ok: true, updated: 1 });
    const files = mocks.commitFiles.mock.calls[0][0] as Array<{ path: string; content?: string }>;
    const pageUpdate = files.find((file) => file.path === "wiki/pages/sparks-guild.md");
    expect(pageUpdate?.content).toContain("category: organization");
    expect(pageUpdate?.content).toContain("type: organization");

    const manifestUpdate = files.find((file) => file.path === ".campaignrepo/index.json");
    expect(manifestUpdate?.content).toBeTruthy();
    const manifest = JSON.parse(manifestUpdate!.content!);
    expect(manifest.pages[0]).toMatchObject({
      id: "organization-sparks-guild",
      title: "Sparks Guild",
      path: "wiki/pages/sparks-guild.md",
      type: "organization",
      visibility: "players",
      approvalStatus: "approved"
    });
    expect(manifest.pages[1].links).toEqual(["organization-sparks-guild"]);
    expect(mocks.upsertPageInCache).toHaveBeenCalledOnce();
    expect(mocks.rebuildSearchIndex).toHaveBeenCalledOnce();
  });

  it("reports stale indexes instead of failing when the rebuild breaks after pages landed", async () => {
    mocks.listDirectoryTextFiles.mockResolvedValueOnce([
      { name: "sparks-guild.md", path: "wiki/pages/sparks-guild.md", text: pageText, sha: "page-sha" }
    ]);
    mocks.getTextFile.mockResolvedValueOnce({ text: manifestText, sha: "manifest-sha" });
    mocks.commitFiles.mockResolvedValueOnce({ commit: "commit", files: 2 });
    mocks.rebuildSearchIndex.mockRejectedValueOnce(new Error("GitHub timeout"));

    const response = await PATCH(
      new Request("http://localhost/api/campaigns/7/pages/bulk", {
        method: "PATCH",
        body: JSON.stringify({ slugs: ["sparks-guild"], set: { visibility: "gm" } })
      }),
      { params: Promise.resolve({ id: "7" }) }
    );
    const body = await response.json();

    // The page commit succeeded — a broken snapshot rebuild is stale indexes,
    // never a failed edit.
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.updated).toBe(1);
    expect(body.indexesStale).toBe(true);
    expect(body.staleReason).toContain("GitHub timeout");
    expect(mocks.upsertPageInCache).toHaveBeenCalledOnce();
  });

  it("resolves parent names to slugs when bulk editing GitHub-listed pages", async () => {
    mocks.listDirectoryTextFiles.mockResolvedValueOnce([
      { name: "sparks-guild.md", path: "wiki/pages/sparks-guild.md", text: null, sha: "parent-sha" },
      { name: "arcology-hall.md", path: "wiki/pages/arcology-hall.md", text: null, sha: "child-sha" }
    ]);
    mocks.getTextFile
      .mockResolvedValueOnce({ text: pageText, sha: "parent-sha" })
      .mockResolvedValueOnce({ text: childPageText, sha: "child-sha" })
      .mockResolvedValueOnce({ text: manifestText, sha: "manifest-sha" });
    mocks.commitFiles.mockResolvedValueOnce({ commit: "commit", files: 2 });
    mocks.rebuildSearchIndex.mockResolvedValueOnce([]);

    const response = await PATCH(
      new Request("http://localhost/api/campaigns/7/pages/bulk", {
        method: "PATCH",
        body: JSON.stringify({ slugs: ["arcology-hall"], set: { parent: "Sparks Guild" } })
      }),
      { params: Promise.resolve({ id: "7" }) }
    );

    await expect(response.json()).resolves.toEqual({ ok: true, updated: 1 });
    const files = mocks.commitFiles.mock.calls[0][0] as Array<{ path: string; content?: string }>;
    const pageUpdate = files.find((file) => file.path === "wiki/pages/arcology-hall.md");
    expect(pageUpdate?.content).toContain("parent: sparks-guild");
    expect(pageUpdate?.content).not.toContain("parent: Sparks Guild");
    expect(pageUpdate?.content).toContain("A place that should nest.");
  });
});

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
    expect(mocks.upsertPageInCache).toHaveBeenCalledOnce();
    expect(mocks.rebuildSearchIndex).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listDirectoryTextFiles: vi.fn(),
  getTextFile: vi.fn(),
  commitFiles: vi.fn(),
  listReviewPages: vi.fn(),
  readPageCache: vi.fn(),
  upsertPageInCache: vi.fn(),
  scheduleSearchIndexRebuild: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({ id: 1, name: "GM", githubToken: "token" }))
}));

vi.mock("@/lib/db", () => ({
  getCampaign: vi.fn(() => ({ id: 7, name: "Sparks", owner: "owner", repo: "repo", branch: "main" })),
  canManageCampaign: vi.fn(() => true)
}));

vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({
    listDirectoryTextFiles: mocks.listDirectoryTextFiles,
    getTextFile: mocks.getTextFile,
    commitFiles: mocks.commitFiles
  }))
}));

vi.mock("@/lib/reviews", () => ({ listReviewPages: mocks.listReviewPages }));
vi.mock("@/lib/page-cache", () => ({
  readPageCache: mocks.readPageCache,
  upsertPageInCache: mocks.upsertPageInCache
}));
vi.mock("@/lib/search", () => ({ scheduleSearchIndexRebuild: mocks.scheduleSearchIndexRebuild }));

import { PATCH } from "@/app/api/campaigns/[id]/admin/reviews/route";

const pendingPage = `---
name: Pending Page
category: npc
type: npc
summary: Needs review
visibility: players
approvalStatus: pending
knownToPlayers: true
tags: []
aliases: []
---

## Notes

Keep this body.
`;

describe("bulk review decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readPageCache.mockReturnValue({ pages: [] });
    mocks.listReviewPages.mockResolvedValue([]);
    mocks.commitFiles.mockResolvedValue(undefined);
  });

  it("loads full GitHub files when directory entries omit their text", async () => {
    mocks.listDirectoryTextFiles.mockResolvedValue([
      { name: "pending-page.md", path: "wiki/pages/pending-page.md", text: null, sha: "sha-1" }
    ]);
    mocks.getTextFile.mockResolvedValue({ text: pendingPage, sha: "sha-1" });

    const response = await PATCH(
      new Request("http://localhost/api/campaigns/7/admin/reviews", {
        method: "PATCH",
        body: JSON.stringify({ all: true, decision: "approved" })
      }),
      { params: Promise.resolve({ id: "7" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, updated: 1 });
    expect(mocks.getTextFile).toHaveBeenCalledWith("wiki/pages/pending-page.md");
    expect(mocks.commitFiles).toHaveBeenCalledWith(
      [expect.objectContaining({
        path: "wiki/pages/pending-page.md",
        content: expect.stringMatching(/approvalStatus: approved[\s\S]*Keep this body\./)
      })],
      "CampaignRepo: approve 1 pages (bulk)"
    );
  });

  it("uses a matching full cached page without another GitHub request", async () => {
    mocks.listDirectoryTextFiles.mockResolvedValue([
      { name: "pending-page.md", path: "wiki/pages/pending-page.md", text: null, sha: "sha-1" }
    ]);
    const { parsePage } = await import("@/lib/markdown");
    mocks.readPageCache.mockReturnValue({ pages: [parsePage("pending-page", pendingPage, "sha-1")] });

    const response = await PATCH(
      new Request("http://localhost/api/campaigns/7/admin/reviews", {
        method: "PATCH",
        body: JSON.stringify({ all: true, decision: "approved" })
      }),
      { params: Promise.resolve({ id: "7" }) }
    );

    await expect(response.json()).resolves.toMatchObject({ updated: 1 });
    expect(mocks.getTextFile).not.toHaveBeenCalled();
    expect(mocks.commitFiles).toHaveBeenCalledOnce();
  });
});

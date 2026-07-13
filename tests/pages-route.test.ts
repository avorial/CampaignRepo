import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class GitHubError extends Error {
    constructor(message: string, public status?: number) {
      super(message);
    }
  }
  return {
    GitHubError,
    getTextFile: vi.fn(),
    putFile: vi.fn(),
    scheduleSearchIndexRebuild: vi.fn(),
    readPageCache: vi.fn(),
    readSearchIndexPageSnapshot: vi.fn(),
    refreshPageCache: vi.fn(),
    refreshPageCacheInBackground: vi.fn()
  };
});

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({ id: 1, name: "GM", githubToken: "token" }))
}));
vi.mock("@/lib/db", () => ({
  getCampaign: vi.fn(() => ({ id: 2, owner: "owner", repo: "repo", branch: "main", gameType: "Traveller" })),
  getCampaignRepositoryToken: vi.fn(() => "token"),
  canManageCampaign: vi.fn(() => true)
}));
vi.mock("@/lib/github", () => ({
  GitHubError: mocks.GitHubError,
  getTextFile: mocks.getTextFile,
  putFile: mocks.putFile,
  listDirectory: vi.fn(async () => [])
}));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({
    getTextFile: mocks.getTextFile,
    putFile: mocks.putFile
  })),
  isConflictError: (error: unknown) => Boolean((error as { status?: number })?.status === 409 || (error as { status?: number })?.status === 422),
  isNotFoundError: (error: unknown) => Boolean((error as { status?: number })?.status === 404)
}));
vi.mock("@/lib/search", () => ({ scheduleSearchIndexRebuild: mocks.scheduleSearchIndexRebuild }));
vi.mock("@/lib/page-cache", () => ({
  readPageCache: mocks.readPageCache,
  readSearchIndexPageSnapshot: mocks.readSearchIndexPageSnapshot,
  refreshPageCache: mocks.refreshPageCache,
  refreshPageCacheInBackground: mocks.refreshPageCacheInBackground
}));

import { GET, POST } from "@/app/api/campaigns/[id]/pages/route";

function createPage(name: string) {
  return POST(
    new Request("http://localhost/api/campaigns/2/pages", {
      method: "POST",
      body: JSON.stringify({ name, category: "npc", visibility: "gm" })
    }),
    { params: Promise.resolve({ id: "2" }) }
  );
}

describe("page creation", () => {
  beforeEach(() => {
    mocks.getTextFile.mockReset();
    mocks.putFile.mockReset();
    mocks.scheduleSearchIndexRebuild.mockClear();
    mocks.readPageCache.mockReset();
    mocks.readSearchIndexPageSnapshot.mockReset();
    mocks.readSearchIndexPageSnapshot.mockResolvedValue(null);
    mocks.refreshPageCache.mockReset();
    mocks.refreshPageCacheInBackground.mockReset();
  });

  it("returns cached pages immediately", async () => {
    const page = {
      slug: "Cached-Page",
      sha: "cached-sha",
      frontmatter: { name: "Cached Page", visibility: "players", approvalStatus: "approved" },
      content: "cached",
      raw: "cached",
      outgoingLinks: [],
      backlinks: []
    };
    mocks.readPageCache.mockReturnValue({ pages: [page], refreshedAt: "2026-06-23 12:00:00", refreshError: null });

    const response = await GET(new Request("http://localhost/api/campaigns/2/pages"), { params: Promise.resolve({ id: "2" }) });
    const body = await response.json();

    expect(body.pages).toEqual([page]);
    expect(body.cache.cached).toBe(true);
    expect(mocks.refreshPageCacheInBackground).not.toHaveBeenCalled();
    expect(mocks.refreshPageCache).not.toHaveBeenCalled();
  });

  it("waits for a refresh when the local cache is empty", async () => {
    mocks.readPageCache.mockReturnValue({ pages: [], refreshedAt: null, refreshError: null });
    mocks.refreshPageCache.mockResolvedValue({ pages: [], refreshedAt: "2026-06-23 12:01:00", refreshError: null });

    const response = await GET(new Request("http://localhost/api/campaigns/2/pages"), { params: Promise.resolve({ id: "2" }) });
    const body = await response.json();

    expect(body.cache.cached).toBe(false);
    expect(mocks.refreshPageCache).toHaveBeenCalledOnce();
    expect(mocks.refreshPageCacheInBackground).not.toHaveBeenCalled();
  });

  it("creates a page when the generated slug is unused", async () => {
    mocks.getTextFile.mockRejectedValueOnce(new mocks.GitHubError("Not Found", 404));
    mocks.putFile.mockResolvedValueOnce({});

    const response = await createPage("New Contact");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ slug: "New-Contact" });
    expect(mocks.putFile).toHaveBeenCalledWith(
      "wiki/pages/New-Contact.md",
      expect.any(String),
      "CampaignRepo: create New Contact"
    );
    expect(mocks.scheduleSearchIndexRebuild).toHaveBeenCalledOnce();
  });

  it("returns a clear conflict instead of GitHub's missing-sha error", async () => {
    mocks.getTextFile.mockResolvedValueOnce({ sha: "existing-sha", text: "existing" });

    const response = await createPage("Existing Contact");
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already exists");
    expect(body.slug).toBe("Existing-Contact");
    expect(mocks.putFile).not.toHaveBeenCalled();
  });

  it("translates a concurrent GitHub create collision into the same conflict", async () => {
    mocks.getTextFile.mockRejectedValueOnce(new mocks.GitHubError("Not Found", 404));
    mocks.putFile.mockRejectedValueOnce(new mocks.GitHubError("Invalid request. 'sha' wasn't supplied.", 422));

    const response = await createPage("Racing Contact");
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("created before this request completed");
  });

});

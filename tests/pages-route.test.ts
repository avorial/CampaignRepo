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
    commitFiles: vi.fn(),
    listRecentCommits: vi.fn(),
    scheduleSearchIndexRebuild: vi.fn(),
    readPageCache: vi.fn(),
    readManifestPageSnapshot: vi.fn(),
    readSearchIndexPageSnapshot: vi.fn(),
    refreshPageCache: vi.fn(),
    refreshPageCacheInBackground: vi.fn(),
    isRemoteCheckFresh: vi.fn(),
    readRemoteCheckState: vi.fn(),
    stampRemoteCheck: vi.fn(),
    stampRemoteManifestPages: vi.fn()
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
    isLocal: false,
    getTextFile: mocks.getTextFile,
    putFile: mocks.putFile,
    commitFiles: mocks.commitFiles,
    listRecentCommits: mocks.listRecentCommits
  })),
  isConflictError: (error: unknown) => Boolean((error as { status?: number })?.status === 409 || (error as { status?: number })?.status === 422),
  isNotFoundError: (error: unknown) => Boolean((error as { status?: number })?.status === 404)
}));
vi.mock("@/lib/search", () => ({ scheduleSearchIndexRebuild: mocks.scheduleSearchIndexRebuild }));
vi.mock("@/lib/page-cache", () => ({
  readPageCache: mocks.readPageCache,
  readManifestPageSnapshot: mocks.readManifestPageSnapshot,
  readSearchIndexPageSnapshot: mocks.readSearchIndexPageSnapshot,
  refreshPageCache: mocks.refreshPageCache,
  refreshPageCacheInBackground: mocks.refreshPageCacheInBackground,
  isRemoteCheckFresh: mocks.isRemoteCheckFresh,
  readRemoteCheckState: mocks.readRemoteCheckState,
  stampRemoteCheck: mocks.stampRemoteCheck,
  stampRemoteManifestPages: mocks.stampRemoteManifestPages,
  upsertPageInCache: vi.fn()
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
    mocks.commitFiles.mockReset();
    mocks.scheduleSearchIndexRebuild.mockClear();
    mocks.readPageCache.mockReset();
    mocks.readManifestPageSnapshot.mockReset();
    mocks.readManifestPageSnapshot.mockResolvedValue(null);
    mocks.readSearchIndexPageSnapshot.mockReset();
    mocks.readSearchIndexPageSnapshot.mockResolvedValue(null);
    mocks.refreshPageCache.mockReset();
    mocks.refreshPageCacheInBackground.mockReset();
    mocks.listRecentCommits.mockReset();
    mocks.isRemoteCheckFresh.mockReset();
    mocks.isRemoteCheckFresh.mockReturnValue(true);
    mocks.readRemoteCheckState.mockReset();
    mocks.readRemoteCheckState.mockReturnValue({ remoteCheckedAt: null, remoteHeadSha: null, remoteManifestPages: null });
    mocks.stampRemoteCheck.mockReset();
    mocks.stampRemoteManifestPages.mockReset();
  });

  const cachedPage = {
    slug: "Cached-Page",
    sha: "cached-sha",
    frontmatter: { name: "Cached Page", visibility: "players", approvalStatus: "approved" },
    content: "cached",
    raw: "cached",
    outgoingLinks: [],
    backlinks: []
  };

  it("serves a fresh local cache with zero remote calls", async () => {
    mocks.readPageCache.mockReturnValue({ pages: [cachedPage], refreshedAt: "2026-06-23 12:00:00", refreshError: null });

    const response = await GET(new Request("http://localhost/api/campaigns/2/pages"), { params: Promise.resolve({ id: "2" }) });
    const body = await response.json();

    expect(body.pages).toEqual([cachedPage]);
    expect(body.cache.cached).toBe(true);
    expect(mocks.listRecentCommits).not.toHaveBeenCalled();
    expect(mocks.readManifestPageSnapshot).not.toHaveBeenCalled();
    expect(mocks.refreshPageCacheInBackground).not.toHaveBeenCalled();
    expect(mocks.refreshPageCache).not.toHaveBeenCalled();
  });

  it("re-arms the window with one HEAD check when the remote is unchanged", async () => {
    mocks.readPageCache.mockReturnValue({ pages: [cachedPage], refreshedAt: "2026-06-23 12:00:00", refreshError: null });
    mocks.isRemoteCheckFresh.mockReturnValue(false);
    mocks.listRecentCommits.mockResolvedValue([{ sha: "head-1" }]);
    mocks.readRemoteCheckState.mockReturnValue({ remoteCheckedAt: "2026-06-23 11:00:00", remoteHeadSha: "head-1", remoteManifestPages: 1 });

    const response = await GET(new Request("http://localhost/api/campaigns/2/pages"), { params: Promise.resolve({ id: "2" }) });
    const body = await response.json();

    expect(body.pages).toEqual([cachedPage]);
    expect(mocks.listRecentCommits).toHaveBeenCalledOnce();
    expect(mocks.stampRemoteCheck).toHaveBeenCalledWith(2, "head-1");
    expect(mocks.readManifestPageSnapshot).not.toHaveBeenCalled();
    expect(mocks.refreshPageCacheInBackground).not.toHaveBeenCalled();
  });

  it("hydrates from the remote index when HEAD moved", async () => {
    mocks.readPageCache.mockReturnValue({ pages: [cachedPage], refreshedAt: "2026-06-23 12:00:00", refreshError: null });
    mocks.isRemoteCheckFresh.mockReturnValue(false);
    mocks.listRecentCommits.mockResolvedValue([{ sha: "head-2" }]);
    mocks.readRemoteCheckState.mockReturnValue({ remoteCheckedAt: "2026-06-23 11:00:00", remoteHeadSha: "head-1", remoteManifestPages: 1 });
    const manifestPage = { ...cachedPage, slug: "From-Manifest", frontmatter: { ...cachedPage.frontmatter, name: "From Manifest" } };
    mocks.readManifestPageSnapshot.mockResolvedValue({ pages: [manifestPage], refreshedAt: null, refreshError: null, source: "manifest" });

    const response = await GET(new Request("http://localhost/api/campaigns/2/pages"), { params: Promise.resolve({ id: "2" }) });
    const body = await response.json();

    expect(body.pages.map((page: { slug: string }) => page.slug)).toEqual(["From-Manifest"]);
    expect(mocks.stampRemoteCheck).toHaveBeenCalledWith(2, "head-2");
    expect(mocks.refreshPageCacheInBackground).toHaveBeenCalledOnce();
  });

  it("distrusts a cache far thinner than the known remote index, even while fresh", async () => {
    // Campaign-10 scenario: a bad refresh swept the cache to ~nothing while the
    // remote index still lists thousands of pages. The fresh 5-minute window
    // must NOT let the thin cache be served.
    mocks.readPageCache.mockReturnValue({ pages: [cachedPage], refreshedAt: "2026-06-23 12:00:00", refreshError: null });
    mocks.isRemoteCheckFresh.mockReturnValue(true);
    mocks.readRemoteCheckState.mockReturnValue({ remoteCheckedAt: "2026-06-23 12:00:00", remoteHeadSha: "head-1", remoteManifestPages: 2020 });
    const manifestPages = Array.from({ length: 2020 }, (_, i) => ({ ...cachedPage, slug: `p-${i}`, frontmatter: { ...cachedPage.frontmatter, name: `P ${i}` } }));
    mocks.readManifestPageSnapshot.mockResolvedValue({ pages: manifestPages, refreshedAt: null, refreshError: null, source: "manifest" });

    const response = await GET(new Request("http://localhost/api/campaigns/2/pages"), { params: Promise.resolve({ id: "2" }) });
    const body = await response.json();

    expect(body.pages.length).toBe(2020);
    expect(mocks.readManifestPageSnapshot).toHaveBeenCalled();
    expect(mocks.refreshPageCacheInBackground).toHaveBeenCalledOnce();
  });

  it("degrades to the local cache when the remote is unreachable", async () => {
    mocks.readPageCache.mockReturnValue({ pages: [cachedPage], refreshedAt: "2026-06-23 12:00:00", refreshError: null });
    mocks.isRemoteCheckFresh.mockReturnValue(false);
    mocks.listRecentCommits.mockRejectedValue(new Error("GitHub unreachable"));

    const response = await GET(new Request("http://localhost/api/campaigns/2/pages"), { params: Promise.resolve({ id: "2" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pages).toEqual([cachedPage]);
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
    mocks.commitFiles.mockResolvedValueOnce({ commit: "commit", files: 2 });

    const response = await createPage("New Contact");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ slug: "New-Contact" });
    expect(mocks.commitFiles).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ path: "wiki/pages/New-Contact.md", content: expect.any(String) }),
        expect.objectContaining({ path: ".campaignrepo/index.json", content: expect.any(String) })
      ]),
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
    expect(mocks.commitFiles).not.toHaveBeenCalled();
  });

  it("translates a concurrent GitHub create collision into the same conflict", async () => {
    mocks.getTextFile.mockRejectedValueOnce(new mocks.GitHubError("Not Found", 404));
    mocks.commitFiles.mockRejectedValueOnce(new mocks.GitHubError("Invalid request. 'sha' wasn't supplied.", 422));

    const response = await createPage("Racing Contact");
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("created before this request completed");
  });

});

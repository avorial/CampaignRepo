import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createRepo: vi.fn(),
  initializeRepo: vi.fn(),
  commitFiles: vi.fn(),
  saveCampaignTheme: vi.fn(),
  incrementCloneCount: vi.fn()
}));

vi.mock("@/lib/auth", () => ({
  currentUser: vi.fn(async () => ({ id: 4, name: "Cloner", githubToken: "token" }))
}));

vi.mock("@/lib/db", () => ({
  getCampaignRepositoryToken: vi.fn(() => null),
  getPublicSiteCampaign: vi.fn(() => ({ id: 9, name: "Golden Ruin", gameType: "Yellow King" })),
  incrementCloneCount: mocks.incrementCloneCount,
  getDb: vi.fn(() => ({
    prepare: vi.fn((sql: string) => ({
      run: vi.fn(() => ({ lastInsertRowid: 12 })),
      get: vi.fn(() => sql.includes("SELECT") ? ({
        id: 12,
        userId: 4,
        name: "Golden Ruin (clone)",
        owner: "cloner",
        repo: "my-golden-ruin",
        branch: "main",
        gameType: "Yellow King",
        storageBackend: "github"
      }) : undefined)
    }))
  }))
}));

vi.mock("@/lib/github", () => ({
  createRepo: mocks.createRepo,
  initializeRepo: mocks.initializeRepo,
  commitFiles: mocks.commitFiles,
  getContent: vi.fn(),
  isGitHubAppConnection: vi.fn(() => false),
  GitHubError: class GitHubError extends Error { status = 400; }
}));

vi.mock("@/lib/public-site", () => ({
  loadPublicPages: vi.fn(async () => []),
  loadCampaignTheme: vi.fn(async () => ({ preset: "classic" })),
  saveCampaignTheme: mocks.saveCampaignTheme
}));

import { POST } from "@/app/api/site/[slug]/clone/route";

describe("public world cloning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createRepo.mockResolvedValue({ name: "my-golden-ruin", owner: { login: "cloner" }, default_branch: "main" });
  });

  it("creates the repository with the requested name and visibility", async () => {
    const response = await POST(new Request("http://localhost/api/site/golden-ruin/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoName: "my-golden-ruin", private: false })
    }), { params: Promise.resolve({ slug: "golden-ruin" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ campaignId: 12 });
    expect(mocks.createRepo).toHaveBeenCalledWith("token", "my-golden-ruin", false);
    expect(mocks.initializeRepo).toHaveBeenCalledOnce();
  });

  it("rejects an invalid repository name before creating anything", async () => {
    const response = await POST(new Request("http://localhost/api/site/golden-ruin/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoName: "not a repo", private: true })
    }), { params: Promise.resolve({ slug: "golden-ruin" }) });

    expect(response.status).toBe(400);
    expect(mocks.createRepo).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTextFile: vi.fn(),
  readPageCache: vi.fn(),
  refreshPageCache: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(async () => ({ id: 1 })) }));
vi.mock("@/lib/db", () => ({
  getCampaign: vi.fn(() => ({ id: 4, owner: "avorial", repo: "kingdomdivided", branch: "main", role: "owner" })),
  getCampaignRepositoryToken: vi.fn(() => "installation-token"),
  canManageCampaign: vi.fn(() => true)
}));
vi.mock("@/lib/github", () => ({
  getTextFile: mocks.getTextFile,
  deleteFile: vi.fn(),
  putFile: vi.fn(),
  GitHubError: class GitHubError extends Error {
    constructor(message: string, public status?: number) { super(message); }
  }
}));
vi.mock("@/lib/search", () => ({ rebuildSearchIndex: vi.fn() }));
vi.mock("@/lib/page-cache", () => ({
  readPageCache: mocks.readPageCache,
  refreshPageCache: mocks.refreshPageCache
}));

import { GET } from "@/app/api/campaigns/[id]/pages/[slug]/route";

describe("page detail reads", () => {
  it("serves a valid linked page from the local cache without a GitHub REST request", async () => {
    const page = {
      slug: "House-Bellkind",
      sha: "cached-sha",
      frontmatter: {
        name: "House Bellkind",
        category: "organization",
        visibility: "players",
        approvalStatus: "unapproved"
      },
      content: "Liege: [[House-Rivers|House Rivers]]",
      raw: "cached",
      outgoingLinks: [{ target: "House-Rivers", label: "House Rivers" }],
      backlinks: []
    };
    mocks.readPageCache.mockReturnValue({ pages: [page], refreshedAt: "2026-06-23", refreshError: null });

    const response = await GET(new Request("http://localhost/api/campaigns/4/pages/House-Bellkind"), {
      params: Promise.resolve({ id: "4", slug: "House-Bellkind" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ page });
    expect(mocks.getTextFile).not.toHaveBeenCalled();
    expect(mocks.refreshPageCache).not.toHaveBeenCalled();
  });
});

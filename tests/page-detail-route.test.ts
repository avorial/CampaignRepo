import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTextFile: vi.fn(),
  readPageCache: vi.fn(),
  refreshPageCache: vi.fn()
}));

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(async () => ({ id: 1 })) }));
vi.mock("@/lib/db", () => ({
  getCampaign: vi.fn(() => ({ id: 4, owner: "owner", repo: "campaign-wiki", branch: "main", role: "owner" })),
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
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: vi.fn(() => ({
    getTextFile: mocks.getTextFile
  }))
}));
vi.mock("@/lib/search", () => ({ scheduleSearchIndexRebuild: vi.fn() }));
vi.mock("@/lib/page-cache", () => ({
  readPageCache: mocks.readPageCache,
  refreshPageCache: mocks.refreshPageCache
}));

import { GET } from "@/app/api/campaigns/[id]/pages/[slug]/route";

describe("page detail reads", () => {
  beforeEach(() => {
    mocks.getTextFile.mockReset();
    mocks.readPageCache.mockReset();
    mocks.refreshPageCache.mockReset();
  });

  it("serves a valid linked page from the local cache without a GitHub REST request", async () => {
    const page = {
      slug: "House-Aster",
      sha: "cached-sha",
      frontmatter: {
        name: "House Aster",
        category: "organization",
        visibility: "players",
        approvalStatus: "unapproved"
      },
      content: "Liege: [[House-River|House River]]",
      raw: "cached",
      outgoingLinks: [{ target: "House-River", label: "House River" }],
      backlinks: []
    };
    mocks.readPageCache.mockReturnValue({ pages: [page], refreshedAt: "2026-06-23", refreshError: null });

    const response = await GET(new Request("http://localhost/api/campaigns/4/pages/House-Aster"), {
      params: Promise.resolve({ id: "4", slug: "House-Aster" })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ page });
    expect(mocks.getTextFile).not.toHaveBeenCalled();
    expect(mocks.refreshPageCache).not.toHaveBeenCalled();
  });

  it("loads a selected page from the manifest path without refreshing every page", async () => {
    mocks.readPageCache.mockReturnValue({ pages: [], refreshedAt: null, refreshError: null });
    mocks.getTextFile.mockImplementation(async (path: string) => {
      if (path === ".campaignrepo/index.json") {
        return {
          sha: "manifest-sha",
          text: JSON.stringify({
            schemaVersion: 1,
            generatedAt: "2026-07-13T18:00:00.000Z",
            pages: [
              {
                id: "character-broseus",
                title: "Broseus",
                path: "wiki/pages/broseus.md",
                type: "character",
                tags: ["generated"],
                links: [],
                visibility: "players",
                approvalStatus: "approved"
              }
            ]
          })
        };
      }
      if (path === "wiki/pages/broseus.md") {
        return {
          sha: "page-sha",
          text: "---\nname: Broseus\ncategory: character\nvisibility: players\napprovalStatus: approved\n---\n\nBroseus body."
        };
      }
      throw new Error(`unexpected path: ${path}`);
    });

    const response = await GET(new Request("http://localhost/api/campaigns/4/pages/broseus"), {
      params: Promise.resolve({ id: "4", slug: "broseus" })
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.page.frontmatter.name).toBe("Broseus");
    expect(body.page.content).toBe("Broseus body.");
    expect(mocks.refreshPageCache).not.toHaveBeenCalled();
  });
});

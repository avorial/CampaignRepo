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
    rebuildSearchIndex: vi.fn(async () => [])
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
vi.mock("@/lib/search", () => ({ rebuildSearchIndex: mocks.rebuildSearchIndex }));

import { POST } from "@/app/api/campaigns/[id]/pages/route";

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
    mocks.rebuildSearchIndex.mockClear();
    mocks.rebuildSearchIndex.mockResolvedValue([]);
  });

  it("creates a page when the generated slug is unused", async () => {
    mocks.getTextFile.mockRejectedValueOnce(new mocks.GitHubError("Not Found", 404));
    mocks.putFile.mockResolvedValueOnce({});

    const response = await createPage("New Contact");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ slug: "New-Contact" });
    expect(mocks.putFile).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ id: 2 }),
      "wiki/pages/New-Contact.md",
      expect.any(String),
      "CampaignRepo: create New Contact"
    );
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

  it("returns the created slug when only the secondary search refresh fails", async () => {
    mocks.getTextFile.mockRejectedValueOnce(new mocks.GitHubError("Not Found", 404));
    mocks.putFile.mockResolvedValueOnce({});
    mocks.rebuildSearchIndex.mockRejectedValueOnce(new mocks.GitHubError("Invalid request. 'sha' wasn't supplied.", 422));

    const response = await createPage("Created Despite Search");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.slug).toBe("Created-Despite-Search");
    expect(body.warning).toContain("search index");
  });
});

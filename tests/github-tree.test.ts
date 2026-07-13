import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRepositoryTreeCacheForTests,
  getTextFile,
  listDirectory,
  listDirectoryTextFiles
} from "@/lib/github";
import type { Campaign } from "@/lib/types";

function makeCampaign(): Campaign {
  return {
    id: 1,
    userId: 1,
    name: "Git Tree Test",
    owner: "avorial",
    repo: "campaign",
    branch: "main",
    gameType: "Traveller",
    storageBackend: "github",
    localPath: null,
    createdAt: new Date().toISOString()
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": "1893456000"
    }
  });
}

function mockGitHub(treeSha: string, trees: Record<string, unknown>, content: Record<string, string> = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/repos/avorial/campaign/branches/main")) {
      return json({ commit: { sha: `commit-${treeSha}`, commit: { tree: { sha: treeSha } } } });
    }

    const treeMatch = url.match(/\/git\/trees\/([^?]+)(\?recursive=1)?$/);
    if (treeMatch) {
      const sha = decodeURIComponent(treeMatch[1]);
      const response = trees[`${sha}${treeMatch[2] ? ":recursive" : ""}`] ?? trees[sha];
      if (!response) return json({ message: "tree not found" }, 404);
      return json(response);
    }

    const contentMatch = url.match(/\/contents\/(.+)\?ref=main$/);
    if (contentMatch) {
      const path = decodeURIComponent(contentMatch[1]);
      const text = content[path];
      if (text === undefined) return json({ message: "not found" }, 404);
      return json({ content: Buffer.from(text, "utf8").toString("base64"), sha: `sha-${path}`, type: "file" });
    }

    return json({ message: `unexpected request: ${url}` }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GitHub repository tree loading", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearRepositoryTreeCacheForTests();
  });

  it("loads a normal recursive tree into direct directory entries", async () => {
    mockGitHub("root-1", {
      "root-1:recursive": {
        truncated: false,
        tree: [
          { path: "characters", type: "tree", sha: "tree-1" },
          { path: "characters/alain.md", type: "blob", sha: "blob-1" },
          { path: "sessions/session-001.md", type: "blob", sha: "blob-2" }
        ]
      }
    });

    await expect(listDirectory("token", makeCampaign(), "characters")).resolves.toEqual([
      { name: "alain.md", path: "characters/alain.md", sha: "blob-1", type: "file", size: undefined }
    ]);
  });

  it("normalizes Git tree entry types to storage directory entry types", async () => {
    mockGitHub("root-types", {
      "root-types:recursive": {
        truncated: false,
        tree: [
          { path: "wiki", type: "tree", sha: "tree-wiki" },
          { path: "README.md", type: "blob", sha: "blob-readme" }
        ]
      }
    });

    await expect(listDirectory("token", makeCampaign(), "")).resolves.toEqual([
      { name: "wiki", path: "wiki", sha: "tree-wiki", type: "dir", size: undefined },
      { name: "README.md", path: "README.md", sha: "blob-readme", type: "file", size: undefined }
    ]);
  });

  it("represents more than 1000 files in one directory without Contents API directory listing", async () => {
    const tree = Array.from({ length: 1100 }, (_, index) => ({
      path: `wiki/pages/page-${String(index).padStart(4, "0")}.md`,
      type: "blob",
      sha: `blob-${index}`
    }));
    const fetchMock = mockGitHub("root-1100", {
      "root-1100:recursive": { truncated: false, tree }
    });

    const files = await listDirectoryTextFiles("token", makeCampaign(), "wiki/pages");

    expect(files).toHaveLength(1100);
    expect(files[1099]).toMatchObject({ name: "page-1099.md", path: "wiki/pages/page-1099.md", text: null });
    expect(fetchMock.mock.calls.map((call) => String(call[0])).some((url) => url.includes("/contents/wiki/pages"))).toBe(false);
  });

  it("reuses the cached immutable tree for repeated directory listings", async () => {
    const fetchMock = mockGitHub("root-cache", {
      "root-cache:recursive": {
        truncated: false,
        tree: [{ path: "wiki/pages/one.md", type: "blob", sha: "blob-1" }]
      }
    });

    await listDirectoryTextFiles("token", makeCampaign(), "wiki/pages");
    await listDirectoryTextFiles("token", makeCampaign(), "wiki/pages");

    const treeRequests = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/git/trees/root-cache?recursive=1"));
    expect(treeRequests).toHaveLength(1);
  });

  it("loads a new tree when the branch points at a changed tree SHA", async () => {
    const campaign = makeCampaign();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const branchCalls = fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/branches/main")).length;
      const treeSha = branchCalls <= 1 ? "root-old" : "root-new";
      if (url.endsWith("/repos/avorial/campaign/branches/main")) {
        return json({ commit: { sha: `commit-${treeSha}`, commit: { tree: { sha: treeSha } } } });
      }
      if (url.endsWith("/git/trees/root-old?recursive=1")) {
        return json({ truncated: false, tree: [{ path: "wiki/pages/old.md", type: "blob", sha: "old" }] });
      }
      if (url.endsWith("/git/trees/root-new?recursive=1")) {
        return json({ truncated: false, tree: [{ path: "wiki/pages/new.md", type: "blob", sha: "new" }] });
      }
      return json({ message: `unexpected request: ${url}` }, 500);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listDirectoryTextFiles("token", campaign, "wiki/pages")).resolves.toMatchObject([{ name: "old.md" }]);
    await expect(listDirectoryTextFiles("token", campaign, "wiki/pages")).resolves.toMatchObject([{ name: "new.md" }]);
  });

  it("falls back to subtree traversal when the recursive tree is truncated", async () => {
    mockGitHub("root-truncated", {
      "root-truncated:recursive": { truncated: true, tree: [] },
      "root-truncated": {
        truncated: false,
        tree: [
          { path: "characters", type: "tree", sha: "characters-tree" },
          { path: "README.md", type: "blob", sha: "readme" }
        ]
      },
      "characters-tree": {
        truncated: false,
        tree: [{ path: "alain.md", type: "blob", sha: "blob-1" }]
      }
    });

    await expect(listDirectoryTextFiles("token", makeCampaign(), "characters")).resolves.toEqual([
      { name: "alain.md", path: "characters/alain.md", sha: "blob-1", text: null }
    ]);
  });

  it("rejects a truncated subtree instead of showing incomplete results", async () => {
    mockGitHub("root-too-big", {
      "root-too-big:recursive": { truncated: true, tree: [] },
      "root-too-big": { truncated: true, tree: [] }
    });

    await expect(listDirectory("token", makeCampaign(), "")).rejects.toThrow(/truncated Git tree/i);
  });

  it("fetches only the selected file after the tree is indexed", async () => {
    const fetchMock = mockGitHub(
      "root-select",
      {
        "root-select:recursive": {
          truncated: false,
          tree: [
            { path: "wiki/pages/one.md", type: "blob", sha: "blob-1" },
            { path: "wiki/pages/two.md", type: "blob", sha: "blob-2" }
          ]
        }
      },
      { "wiki/pages/one.md": "# One\n" }
    );

    await listDirectoryTextFiles("token", makeCampaign(), "wiki/pages");
    const file = await getTextFile("token", makeCampaign(), "wiki/pages/one.md");

    expect(file.text).toBe("# One\n");
    const contentRequests = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes("/contents/"));
    expect(contentRequests).toEqual(["https://api.github.com/repos/avorial/campaign/contents/wiki/pages/one.md?ref=main"]);
  });
});

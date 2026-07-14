import { describe, expect, it, vi } from "vitest";
import { loadPublicPages, loadPublicQuests } from "@/lib/public-site";
import type { Campaign } from "@/lib/types";

let questFiles: Array<{ name: string; text: string }> = [];
let storageMock: any;

vi.mock("@/lib/storage", () => ({
  getStorageAdapter: () => storageMock
}));

function makeCampaign(): Campaign {
  return {
    id: 1,
    userId: 1,
    name: "Public Test",
    owner: "",
    repo: "",
    branch: "main",
    gameType: "Traveller",
    storageBackend: "local",
    localPath: "mock",
    createdAt: new Date().toISOString()
  };
}

describe("public site quests", () => {
  it("prefers the repository manifest for public page navigation", async () => {
    storageMock = {
      getTextFile: vi.fn(async (path: string) => {
        if (path !== ".campaignrepo/index.json") throw new Error(`unexpected read: ${path}`);
        return {
          sha: "manifest-sha",
          text: JSON.stringify({
            schemaVersion: 1,
            generatedAt: "2026-07-13T18:00:00.000Z",
            pages: [
              {
                id: "lore-public",
                title: "Manifest Public Page",
                path: "wiki/pages/manifest-public-page.md",
                type: "lore",
                tags: ["manifest"],
                links: [],
                summary: "Listed from manifest",
                visibility: "players",
                approvalStatus: "approved",
                parent: "jardin"
              }
            ]
          })
        };
      }),
      listDirectory: vi.fn()
    };

    const pages = await loadPublicPages(makeCampaign());

    expect(pages).toHaveLength(1);
    expect(pages[0].frontmatter.name).toBe("Manifest Public Page");
    expect(pages[0].frontmatter.parent).toBe("jardin");
    expect(storageMock.getTextFile).toHaveBeenCalledTimes(1);
    expect(storageMock.listDirectory).not.toHaveBeenCalled();
  });

  it("loads public pages from the search snapshot without downloading every markdown page", async () => {
    storageMock = {
      getTextFile: vi.fn(async (path: string) => {
        if (path !== "wiki/search/index.json") throw new Error(`unexpected read: ${path}`);
        return {
          sha: "index-sha",
          text: JSON.stringify([
            {
              id: "1:public-page",
              campaignId: 1,
              campaignName: "Public Test",
              slug: "public-page",
              title: "Public Page",
              category: "lore",
              summary: "Visible summary",
              tags: ["visible"],
              aliases: [],
              visibility: "players",
              approvalStatus: "approved",
              text: "Visible.\n\n:::gm\nSecret.\n:::\n",
              playerText: "Visible.\n",
              links: [],
              backlinks: [],
              keyLinks: [],
              parent: "jardin"
            },
            {
              id: "1:private-page",
              campaignId: 1,
              campaignName: "Public Test",
              slug: "private-page",
              title: "Private Page",
              category: "lore",
              summary: "",
              tags: [],
              aliases: [],
              visibility: "gm",
              approvalStatus: "approved",
              text: "Secret.",
              playerText: "",
              links: [],
              backlinks: [],
              keyLinks: []
            }
          ])
        };
      }),
      listDirectory: vi.fn()
    };

    const pages = await loadPublicPages(makeCampaign());

    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe("public-page");
    expect(pages[0].frontmatter.parent).toBe("jardin");
    expect(pages[0].content).toBe("");
    expect(pages[0].content).not.toContain("Secret.");
    expect(storageMock.listDirectory).not.toHaveBeenCalled();
    expect(storageMock.getTextFile).toHaveBeenCalledTimes(2);
  });

  it("loads only player-visible quests and strips GM blocks", async () => {
    storageMock = {
      listDirectoryTextFiles: vi.fn(async () => questFiles.map((file) => ({ ...file, path: `wiki/quests/${file.name}`, sha: file.name })))
    };
    questFiles = [
      {
        name: "public.md",
        text: `---
title: Public Hook
status: active
visibility: players
objectives:
  - text: Find the contact
    done: false
participants:
  - Annette
locations:
  - Old Harbor
clocks:
  - name: Heat
    segments: 6
    filled: 2
---

Visible briefing.

:::gm
Hidden twist.
:::
`
      },
      {
        name: "private.md",
        text: `---
title: Private Plot
status: active
visibility: gm
---

GM eyes only.
`
      }
    ];

    const quests = await loadPublicQuests(makeCampaign());

    expect(quests).toHaveLength(1);
    expect(quests[0].frontmatter.title).toBe("Public Hook");
    expect(quests[0].description).toContain("Visible briefing.");
    expect(quests[0].description).not.toContain("Hidden twist.");
  });
});

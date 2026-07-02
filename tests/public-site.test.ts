import { describe, expect, it, vi } from "vitest";
import { loadPublicQuests } from "@/lib/public-site";
import type { Campaign } from "@/lib/types";

let questFiles: Array<{ name: string; text: string }> = [];

vi.mock("@/lib/storage", () => ({
  getStorageAdapter: () => ({
    listDirectoryTextFiles: vi.fn(async () => questFiles.map((file) => ({ ...file, path: `wiki/quests/${file.name}`, sha: file.name })))
  })
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
  it("loads only player-visible quests and strips GM blocks", async () => {
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
  - Jardin
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

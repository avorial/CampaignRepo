import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gameTypes, repoReadme } from "@/lib/templates";
import { LocalFolderAdapter } from "@/lib/storage-local";
import type { Campaign, GameType } from "@/lib/types";

const temporaryFolders: string[] = [];

afterEach(async () => {
  for (const folder of temporaryFolders.splice(0)) await fs.rm(folder, { recursive: true, force: true });
});

describe("campaign README generation", () => {
  it("includes the selected system and campaign workflow for every template pack", () => {
    for (const system of gameTypes) {
      const readme = repoReadme("Example Campaign", system);
      expect(readme).toContain("# Example Campaign");
      expect(readme).toContain(system);
      expect(readme).toContain("## Game System");
      expect(readme).toContain("## What CampaignRepo Does");
      expect(readme).toContain("Refresh repo");
      expect(readme).toContain("approvalStatus: approved");
      expect(readme).not.toContain("undefined");
      expect(readme).not.toContain("\\`");
    }
  });

  it.each([
    ["Traveller", "Mongoose Publishing"],
    ["Sword Chronicle", "Green Ronin"],
    ["Dungeons & Dragons", "Wizards of the Coast"],
    ["Vampire: The Masquerade", "World of Darkness"],
    ["Dark Ages: Vampire", "Onyx Path"],
    ["Mage: The Ascension", "Onyx Path"],
    ["The King in Yellow RPG", "Pelgrane Press"]
  ])("gives %s a synopsis and publisher reference", (system, publisher) => {
    expect(repoReadme("Example", system as GameType)).toContain(publisher);
  });

  it("supports the old one-argument call without inventing a campaign premise", () => {
    expect(repoReadme(" Example ")).toMatch(/^# Example\n/);
    expect(repoReadme("Example")).toContain("custom game system");
  });

  it("initializes a local campaign with its actual system and preserves an existing README", async () => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), "campaignrepo-readme-"));
    temporaryFolders.push(folder);
    const adapter = new LocalFolderAdapter(folder);
    const campaign = { name: "New Science Fiction Campaign", gameType: "Traveller" } as Campaign;
    await adapter.initializeRepo(campaign);
    const readme = await fs.readFile(path.join(folder, "README.md"), "utf8");
    expect(readme).toContain("Traveller");
    expect(readme).toContain("Mongoose Publishing");
    await fs.writeFile(path.join(folder, "README.md"), "# Custom campaign introduction\n");
    await adapter.initializeRepo(campaign);
    expect(await fs.readFile(path.join(folder, "README.md"), "utf8")).toBe("# Custom campaign introduction\n");
  });
});

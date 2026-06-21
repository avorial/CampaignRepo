import type { Category, GameType, WikiPageFrontmatter } from "@/lib/types";

export const gameTypes: GameType[] = ["Sword Chronicle", "Dungeons & Dragons", "World of Darkness", "Traveller", "Custom"];
export const categories: { id: Category; label: string }[] = [
  { id: "character", label: "Characters" },
  { id: "npc", label: "NPCs" },
  { id: "organization", label: "Organizations" },
  { id: "species", label: "Species" },
  { id: "location", label: "Locations" },
  { id: "item", label: "Items" },
  { id: "event", label: "Events" },
  { id: "lore", label: "Lore" },
  { id: "game", label: "Games" }
];

export const categoryIds = categories.map((category) => category.id) as [Category, ...Category[]];

export function defaultFrontmatter(name: string, category: Category, visibility = "gm"): WikiPageFrontmatter {
  return {
    category,
    type: category,
    name,
    summary: "",
    tags: [category],
    visibility: visibility as "gm" | "players",
    approvalStatus: "approved",
    knownToPlayers: visibility === "players",
    keyLinks: [],
    aliases: [],
    lastEditedBy: "CampaignRepo"
  };
}

export function starterBody(name: string, category: Category, gameType: GameType) {
  const heading = `# ${name}`;
  const common = "\n\n## Overview\n\n\n## Key Links\n\n- [[Session Zero]]\n\n:::gm\nGM-only truth goes here.\n:::\n";
  if (gameType === "Traveller" && category === "location") {
    return `${heading}\n\n## UWP\n\n\n## Trade Notes\n\n\n## Known To Players\n\n${common}`;
  }
  if (category === "npc" || category === "character") {
    return `${heading}\n\n## Public Face\n\n\n## Relationships\n\n\n## Secrets\n\n:::gm\nWhat they really want, know, or fear.\n:::\n`;
  }
  if (category === "organization") {
    return `${heading}\n\n## Overview\n\n\n## Leadership\n\n- [[NPC]]\n\n## Members & Holdings\n\n\n## Allies & Rivals\n\n\n:::gm\nSecret agenda, debts, and leverage.\n:::\n`;
  }
  if (category === "species") {
    return `${heading}\n\n## Overview\n\n\n## Appearance & Biology\n\n\n## Culture & Society\n\n\n## Homeland\n\n- [[Location]]\n\n:::gm\nHidden truths about this species.\n:::\n`;
  }
  if (category === "item") {
    return `${heading}\n\n## Description\n\n\n## Properties\n\n\n## History\n\n\n## Current Owner\n\n- [[NPC]]\n\n:::gm\nCurses, true power, or origin secrets.\n:::\n`;
  }
  if (category === "lore") {
    return `${heading}\n\n## Summary\n\n\n## Details\n\n\n## Related\n\n- [[Page Name]]\n\n:::gm\nThe truth behind the myth.\n:::\n`;
  }
  return `${heading}${common}`;
}

export function campaignYaml(name: string, gameType: GameType) {
  const cats = categories.map((category) => `  - ${category.label}`).join("\n");
  return `name: ${JSON.stringify(name)}\ngameType: ${JSON.stringify(gameType)}\ncategories:\n${cats}\nvisibility:\n  default: gm\napprovals:\n  aiDefault: unapproved\n`;
}

export function repoReadme(name: string) {
  return `# ${name}\n\nThis campaign repository is managed by CampaignRepo.\n\n## Structure\n\n- Pages live in \`/wiki/pages\`.\n- Media lives in \`/wiki/media\`.\n- Templates live in \`/wiki/templates\`.\n- Character imports live in \`/wiki/imports/characters\`.\n- The portable search snapshot lives in \`/wiki/search/index.json\`.\n- Campaign settings live in \`/wiki/campaign.yaml\`.\n\nManual edits are welcome. Preserve YAML frontmatter and CampaignRepo conventions for wiki links, visibility, and approvals.\n\n## Links\n\n- GitHub docs: https://docs.github.com/repositories/creating-and-managing-repositories/creating-a-new-repository\n- CampaignRepo wiki links: use \`[[Page Name]]\` or \`[[Page Name|label]]\`.\n- GM-only sections: wrap secret content in \`:::gm\` blocks.\n`;
}

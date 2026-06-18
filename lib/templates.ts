import type { Category, GameType, WikiPageFrontmatter } from "@/lib/types";

export const gameTypes: GameType[] = ["Sword Chronicle", "Dungeons & Dragons", "World of Darkness", "Traveller", "Custom"];
export const categories: { id: Category; label: string }[] = [
  { id: "character", label: "Characters" },
  { id: "npc", label: "NPCs" },
  { id: "location", label: "Locations" },
  { id: "event", label: "Events" },
  { id: "game", label: "Games" }
];

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
  return `${heading}${common}`;
}

export function campaignYaml(name: string, gameType: GameType) {
  return `name: ${JSON.stringify(name)}\ngameType: ${JSON.stringify(gameType)}\ncategories:\n  - Characters\n  - NPCs\n  - Locations\n  - Events\n  - Games\nvisibility:\n  default: gm\napprovals:\n  aiDefault: unapproved\n`;
}

export function repoReadme(name: string) {
  return `# ${name}\n\nThis campaign repository is managed by CampaignRepo.\n\n## Structure\n\n- Pages live in \`/wiki/pages\`.\n- Media lives in \`/wiki/media\`.\n- Templates live in \`/wiki/templates\`.\n- Character imports live in \`/wiki/imports/characters\`.\n- The portable search snapshot lives in \`/wiki/search/index.json\`.\n- Campaign settings live in \`/wiki/campaign.yaml\`.\n\nManual edits are welcome. Preserve YAML frontmatter and CampaignRepo conventions for wiki links, visibility, and approvals.\n\n## Links\n\n- GitHub docs: https://docs.github.com/repositories/creating-and-managing-repositories/creating-a-new-repository\n- CampaignRepo wiki links: use \`[[Page Name]]\` or \`[[Page Name|label]]\`.\n- GM-only sections: wrap secret content in \`:::gm\` blocks.\n`;
}

import type { Category, GameType, WikiPageFrontmatter } from "@/lib/types";
import { themePresetForGame } from "@/lib/game-pack-branding";

// Game template packs grouped by genre (Fantasy, Modern, Sci-Fi, Generic),
// alphabetical within each group; Custom is the generic catch-all and stays last.
export const gameTypeGroups: { label: string; types: GameType[] }[] = [
  {
    label: "Fantasy",
    types: [
      "Blades in the Dark",
      "Burning Wheel",
      "Dark Ages: Fae",
      "Dark Ages: Inquisitor",
      "Dark Ages: Mage",
      "Dark Ages: Vampire",
      "Dark Ages: Werewolf",
      "Dragonbane",
      "Dungeons & Dragons",
      "Fabula Ultima",
      "Mörk Borg",
      "Old-School Essentials",
      "Pathfinder",
      "Pendragon",
      "Reign",
      "Shadowdark RPG",
      "Sword Chronicle",
      "The One Ring",
      "Warhammer Fantasy Roleplay"
    ]
  },
  {
    label: "Modern",
    types: [
      "Call of Cthulhu",
      "Candela Obscura",
      "Changeling: The Dreaming",
      "Delta Green",
      "Demon: The Fallen",
      "Hunter: The Reckoning",
      "Mage: The Ascension",
      "Mummy: The Resurrection",
      "The King in Yellow RPG",
      "Twilight: 2000",
      "Vampire: The Masquerade",
      "Werewolf: The Apocalypse",
      "Wraith: The Oblivion"
    ]
  },
  {
    label: "Sci-Fi",
    types: [
      "2300AD",
      "Alien RPG",
      "Coriolis",
      "Cyberpunk RED",
      "Dune: Adventures in the Imperium",
      "Mothership",
      "Starfinder",
      "Traveller",
      "Warhammer 40,000 Roleplay"
    ]
  },
  {
    label: "Generic",
    types: ["Fate Core", "Savage Worlds", "Custom"]
  }
];

// Flat list (genre order) — drives the zod validator and any non-grouped consumers.
export const gameTypes: GameType[] = gameTypeGroups.flatMap((group) => group.types);
export const categories: { id: Category; label: string }[] = [
  { id: "character", label: "Characters" },
  { id: "npc", label: "NPCs" },
  { id: "organization", label: "Organizations" },
  { id: "species", label: "Species" },
  { id: "location", label: "Locations" },
  { id: "item", label: "Items" },
  { id: "spell", label: "Spells & Abilities" },
  { id: "religion", label: "Religions & Cults" },
  { id: "vehicle", label: "Vehicles & Ships" },
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
  if (category === "spell") {
    return `${heading}\n\n## Effect\n\n\n## Casting Requirements\n\n- **Range:** \n- **Duration:** \n- **Components:** \n\n## Scaling\n\n\n## Source\n\n- [[Location or Tradition]]\n\n:::gm\nSecret effects, ritual misuse, or plot hooks.\n:::\n`;
  }
  if (category === "religion") {
    return `${heading}\n\n## Overview\n\n\n## Core Beliefs\n\n\n## Clergy & Structure\n\n- [[NPC Leader]]\n\n## Holy Days & Rites\n\n\n## Sacred Places\n\n- [[Location]]\n\n:::gm\nCorruption, divine truth, and secret doctrine.\n:::\n`;
  }
  if (category === "vehicle") {
    return `${heading}\n\n## Overview\n\n\n## Specifications\n\n- **Type:** \n- **Crew:** \n- **Capacity:** \n- **Speed:** \n\n## History\n\n\n## Current Status\n\n\n## Crew & Passengers\n\n- [[NPC]]\n\n:::gm\nHidden cargo, defects, and modification secrets.\n:::\n`;
  }
  return `${heading}${common}`;
}

/** Seed body for a campaign's pinned "Campaign" data page — the shared home page. */
export function campaignDataBody(name: string, gameType: GameType) {
  return `# ${name}

The home page for this campaign — who's playing, what it's about, and how to plug in. Edit it like any other page.

## The Concept

_A paragraph on the setting, the premise, the stakes, and where the story stands right now._

## System & Tone

- **Game system:** ${gameType}
- **Tone:**
- **Safety tools:**

## The Table

_The players and the characters they run._

| Player | Character | Role |
| --- | --- | --- |
|  | [[Character]] |  |

## How to Connect

- **Web app:** this site — sign in and open this campaign.
- **GitHub:** the campaign repo (see the "Open GitHub" button in the header).
- **AI / MCP:** mint a token under **GM Admin → tokens**, then point your MCP client at this campaign.

## Key NPCs & Factions

- [[NPC]] —

## House Rules

-

## Where We Are Now

_Current location, active goals, and looming threats._

## Timeline

-

:::gm
GM-only campaign notes: the truth behind the concept, secret clocks, and long-game plans.
:::
`;
}

export function campaignYaml(name: string, gameType: GameType) {
  const cats = categories.map((category) => `  - id: ${category.id}\n    label: ${JSON.stringify(category.label)}`).join("\n");
  return `name: ${JSON.stringify(name)}\ngameType: ${JSON.stringify(gameType)}\ncategories:\n${cats}\nvisibility:\n  default: gm\napprovals:\n  aiDefault: unapproved\ntheme:\n  preset: ${JSON.stringify(themePresetForGame(gameType))}\n  accent: "#d4a957"\n  accent2: "#a075ff"\n  displayFont: "Fraunces"\n  banner: ""\n`;
}

/**
 * Windows-safe template folder name for a game type. Colons are invalid in
 * NTFS paths, so "Vampire: The Masquerade" as a directory name breaks
 * `git clone` on every Windows machine ("Vampire - The Masquerade" instead).
 */
export function templateDirName(gameType: string) {
  return gameType.replace(/:\s*/g, " - ").replace(/[*?"<>|\\/]/g, "").replace(/\s+/g, " ").trim();
}

/** Map a template folder name (legacy colon form or sanitized) back to its game type. */
export function gameTypeFromTemplateDirName(dirName: string): string {
  const match = gameTypes.find((type) => type === dirName || templateDirName(type) === dirName);
  return match || dirName;
}

const readmeSystems: Partial<Record<GameType, { text: string; url: string; label: string }>> = {
  "Traveller": {
    "text": "Traveller is a science-fiction roleplaying game about people making their way between worlds. Exploration, trade, patrons, starships, military service, and difficult choices can all drive a campaign. Character backgrounds and practical skills give the setting a grounded, lived-in feel.",
    "url": "https://www.mongoosepublishing.com/collections/traveller-rpgs",
    "label": "Mongoose Publishing's Traveller overview"
  },
  "Sword Chronicle": {
    "text": "Sword Chronicle is a feudal fantasy roleplaying game using Green Ronin's Chronicle System. Noble houses, personal loyalties, courtly intrigue, and warfare shape play. Characters can influence a household's fortunes as well as their own, with social conflicts and political decisions carrying weight alongside battles.",
    "url": "https://greenronin.com/blog/2020/07/27/whats-different-about-sword-chronicle/",
    "label": "Green Ronin's Sword Chronicle overview"
  },
  "Dungeons & Dragons": {
    "text": "Dungeons & Dragons is a fantasy roleplaying game in which a party of adventurers explores a world presented by the Dungeon Master. Players choose their characters' actions, solve problems, negotiate, and confront dangerous creatures. Character abilities and dice resolve uncertain outcomes as the group's choices shape the story.",
    "url": "https://www.dndbeyond.com/posts/1480-what-is-dungeons-dragons",
    "label": "Wizards of the Coast's D&D introduction"
  },
  "Vampire: The Masquerade": {
    "text": "Vampire: The Masquerade is a World of Darkness game of personal and political horror. Players portray vampires navigating hunger, rivalries, secrecy, and the struggle to retain their humanity. Clans and supernatural powers matter, but relationships and the costs of survival are central to the chronicle.",
    "url": "https://www.paradoxinteractive.com/games/world-of-darkness/about",
    "label": "The official World of Darkness overview"
  },
  "Dark Ages: Vampire": {
    "text": "Dark Ages: Vampire places vampiric horror in a medieval world of faith, feudal power, and ancient bloodlines. Characters balance their supernatural appetites with loyalties, beliefs, and the demands of elders and mortal society. The chronicle's chosen edition and house rules determine the mechanics used at the table.",
    "url": "https://theonyxpath.com/now-available-v20-dark-ages/",
    "label": "Onyx Path's Dark Ages overview"
  },
  "Mage: The Ascension": {
    "text": "Mage: The Ascension is a World of Darkness game about people whose awakened beliefs and will can reshape reality. Magic, faith, and technology become competing ways of understanding and changing the world. Stories explore the responsibility of power and conflicts over what reality should become.",
    "url": "https://theonyxpath.com/mage-the-ascension-20th-anniversary-edition-faq-part-1/",
    "label": "Onyx Path's Mage introduction"
  },
  "The King in Yellow RPG": {
    "text": "The Yellow King Roleplaying Game is an investigative horror game inspired by Robert W. Chambers. Its stories connect unsettling art, unreliable reality, and lives across different settings and timelines. Investigators follow clues while confronting the physical and psychological consequences of contact with the Yellow King's influence.",
    "url": "https://pelgranepress.com/product/the-yellow-king-rpg/",
    "label": "Pelgrane Press's Yellow King overview"
  }
};

export function repoReadme(name: string, gameType: GameType = "Custom") {
  const system = readmeSystems[gameType];
  const genre = gameTypeGroups.find((group) => group.types.includes(gameType))?.label;
  const overview = system
    ? `${system.text} [${system.label}](${system.url}).`
    : gameType === "Custom"
      ? "This campaign uses a custom game system. Record the group's rules, house conventions, and character options in the wiki and templates."
      : `This campaign uses ${gameType}, listed in CampaignRepo's ${genre || "game-system"} template catalog. Use the selected game's rulebooks for play and the repository's templates for campaign records; note the edition and house rules in the wiki.`;
  return `# ${name.trim()}

A tabletop roleplaying campaign using **${gameType}**, managed with [CampaignRepo](https://github.com/avorial/CampaignRepo).

## Game System

${overview}

The group's chosen edition and house rules govern play. Campaign notes and templates supplement the rulebooks.

## About the Campaign

This repository holds the campaign's characters, places, factions, session notes, and reference material. Its premise and current situation can be maintained on the campaign home page in \`wiki/pages/\`.

## What CampaignRepo Does

CampaignRepo turns this repository into a searchable browser-based wiki with linked pages, media, maps, relationship graphs, calendars, sessions, and quests. Owners and GMs can review drafts, keep private notes, and share approved player-facing content through a player portal or public campaign site.

The content remains portable Markdown, YAML, JSON, and media files that can be read without the app.

## Repository Structure

| Path | Contents |
| --- | --- |
| \`wiki/pages/\` | Wiki pages, characters, lore, and reports |
| \`wiki/media/\` | Images, maps, and handouts |
| \`wiki/templates/\` | Game-specific page and character templates |
| \`wiki/imports/characters/\` | Preserved character import sources |
| \`wiki/sessions/\` | Session preparation and notes, when used |
| \`wiki/quests/\` | Quest records, when used |
| \`wiki/maps/\` | Map records, when used |
| \`wiki/campaign.yaml\` | Campaign configuration |
| \`.campaignrepo/index.json\` | Generated navigation manifest |
| \`wiki/search/index.json\` | Generated search snapshot |

Some folders are created when their tools are first used. Page source and frontmatter remain authoritative; indexes can be rebuilt.

## Editing and Sharing

- Preserve YAML frontmatter when editing wiki pages.
- Use \`[[Page Name]]\` or \`[[Page Name|label]]\` for wiki links.
- Reference media with paths such as \`/wiki/media/image.png\`.
- Player-visible pages need \`visibility: players\` and \`approvalStatus: approved\`.
- Wrap private sections in \`:::gm\` blocks.
- After external file edits or pushes, click **Refresh repo** to reload source, rebuild indexes, and update the open view.
- Use **Repair indexes** in settings or the Health center when generated state needs recovery.

Player visibility applies to CampaignRepo views, not raw repository access. Anyone who can read the repository files can also read GM notes.

## Links

- [Wiki pages](wiki/pages/)
- [Campaign configuration](wiki/campaign.yaml)
- [CampaignRepo setup and documentation](https://github.com/avorial/CampaignRepo)
`;
}

/** Starter pages seeded into a brand-new campaign so the wiki is never empty. */
export function starterPages(campaignName: string): Array<{ slug: string; frontmatter: WikiPageFrontmatter; body: string }> {
  return [
    {
      slug: "getting-started",
      frontmatter: {
        name: `Welcome to ${campaignName}`,
        category: "lore",
        type: "",
        summary: "Getting started guide for CampaignRepo.",
        visibility: "gm",
        approvalStatus: "approved",
        knownToPlayers: false,
        keyLinks: [],
        tags: ["meta"],
        aliases: []
      },
      body: `This page is a quick tour of CampaignRepo — delete it whenever you're ready.

## Writing pages

Pages are Markdown files with YAML frontmatter. You can edit them here or open the \`wiki/pages/\` folder directly in any text editor.

Use **wiki links** to connect pages: \`[[Character Name]]\` or \`[[Character Name|custom label]]\`.

Use **GM blocks** to hide text from players:

:::gm
Only the GM sees this. Perfect for hidden motives, secret locations, and lore reveals.
:::

## Visibility

Every page has a **visibility** setting:

- **GM only** — private to the GM (and other GMs).
- **Players** — visible in the player portal once approved.

The **approval status** controls whether players can actually see a player-visible page. Set it to *Approved* to publish it.

## Categories and templates

Use categories (Character, Location, Faction, etc.) to organise pages. The **Templates** folder in the sidebar has ready-made page structures for each category.

## What to create next

- [[Characters]] — your protagonist and supporting cast.
- [[Locations]] — the places the story takes place.
- [[Factions]] — organisations, guilds, and powers that be.

Happy worldbuilding!
`
    }
  ];
}

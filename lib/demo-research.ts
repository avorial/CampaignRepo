import type { GameType } from "@/lib/types";

export type DemoResearchStatus = "first-pass" | "needs-reference" | "ready-for-polish";

export type DemoSheetBrief = {
  status: DemoResearchStatus;
  visualNotes: string[];
  layoutDirection: string;
  fieldGroups: string[];
  cleanupNotes: string[];
};

export type DemoResearch = {
  status: DemoResearchStatus;
  concept: string;
  sheetBrief: DemoSheetBrief;
  lists: { title: string; items: string[] }[];
};

type DemoFamily = "fantasy" | "dark-fantasy" | "gothic" | "modern" | "investigation" | "scifi" | "pulp" | "generic";

type DemoSeed = {
  premise: string;
  pcRole?: string;
  locationName?: string;
  factionName?: string;
};

const FAMILY_BY_GAME: Record<GameType, DemoFamily> = {
  "Blades in the Dark": "dark-fantasy",
  "Burning Wheel": "fantasy",
  "Dark Ages: Fae": "gothic",
  "Dark Ages: Inquisitor": "gothic",
  "Dark Ages: Mage": "gothic",
  "Dark Ages: Vampire": "gothic",
  "Dark Ages: Werewolf": "gothic",
  Dragonbane: "fantasy",
  "Dungeons & Dragons": "fantasy",
  "Fabula Ultima": "fantasy",
  "Mörk Borg": "dark-fantasy",
  "Old-School Essentials": "fantasy",
  Pathfinder: "fantasy",
  Pendragon: "fantasy",
  Reign: "fantasy",
  "Shadowdark RPG": "dark-fantasy",
  "Sword Chronicle": "fantasy",
  "The One Ring": "fantasy",
  "Warhammer Fantasy Roleplay": "dark-fantasy",
  "Call of Cthulhu": "investigation",
  "Candela Obscura": "investigation",
  "Changeling: The Dreaming": "gothic",
  "Delta Green": "investigation",
  "Demon: The Fallen": "gothic",
  "Hunter: The Reckoning": "gothic",
  "Mage: The Ascension": "gothic",
  "Mummy: The Resurrection": "gothic",
  "The King in Yellow RPG": "investigation",
  "Twilight: 2000": "modern",
  "Vampire: The Masquerade": "gothic",
  "Werewolf: The Apocalypse": "gothic",
  "Wraith: The Oblivion": "gothic",
  "2300AD": "scifi",
  "Alien RPG": "scifi",
  Coriolis: "scifi",
  "Cyberpunk RED": "scifi",
  Mothership: "scifi",
  Starfinder: "scifi",
  Traveller: "scifi",
  "Warhammer 40,000 Roleplay": "dark-fantasy",
  "Fate Core": "generic",
  "Savage Worlds": "pulp",
  Custom: "generic"
};

const FAMILY_STYLE: Record<DemoFamily, Omit<DemoSheetBrief, "status">> = {
  fantasy: {
    visualNotes: ["parchment or vellum surfaces", "strong identity header", "stat blocks arranged for quick table scanning", "inventory and bonds as framed lists"],
    layoutDirection: "Use an illuminated campaign ledger: wide identity banner, compact stat tiles, two-column abilities/gear, and a clean notes band.",
    fieldGroups: ["Identity", "Attributes", "Skills or Moves", "Combat / Harm", "Gear", "Bonds and Hooks", "Notes"],
    cleanupNotes: ["Replace generic stat names with the game's exact terms.", "Decide whether ratings are numbers, dice, dots, or narrative tags."]
  },
  "dark-fantasy": {
    visualNotes: ["distressed ink", "high contrast blocks", "doom or stress tracks", "scarred inventory lists"],
    layoutDirection: "Use a grim dossier sheet with stark sections, warning-color accents, and condensed survival/combat state near the top.",
    fieldGroups: ["Identity", "Doom / Stress / Harm", "Core Ratings", "Special Abilities", "Gear", "Enemies", "Notes"],
    cleanupNotes: ["Check whether resource tracks reset per session or persist.", "Tune palette per game so it feels inspired, not copied."]
  },
  gothic: {
    visualNotes: ["dot ratings", "three-column trait groups", "portrait or sigil block", "virtue/morality/resource tracks"],
    layoutDirection: "Use a nocturne dossier: character identity and type at the top, dot-rated traits in balanced columns, powers/resources in framed lower panels.",
    fieldGroups: ["Identity", "Attributes", "Abilities", "Powers", "Backgrounds / Merits", "Resource Track", "Health", "Notes"],
    cleanupNotes: ["Separate World of Darkness variants by their power list names.", "Confirm morality/resource labels for each line before final polish."]
  },
  modern: {
    visualNotes: ["mission record typography", "loadout strip", "condition clocks", "clear logistics fields"],
    layoutDirection: "Use a field file: operational header, capability grid, condition/loadout panels, and a strong mission notes area.",
    fieldGroups: ["Identity", "Role", "Attributes", "Skills", "Stress / Conditions", "Loadout", "Contacts", "Notes"],
    cleanupNotes: ["Keep the sheet practical and low-decoration.", "Confirm weapon/loadout fields against the game's action economy."]
  },
  investigation: {
    visualNotes: ["case-file styling", "evidence boxes", "sanity/stability tracks", "relationship clues"],
    layoutDirection: "Use an investigator case sheet: personal details, capabilities, mental strain, clue/evidence panels, and campaign ties.",
    fieldGroups: ["Identity", "Occupation / Role", "Characteristics", "Skills", "Stability / Sanity / Stress", "Clues", "Gear", "Notes"],
    cleanupNotes: ["Differentiate clue mechanics from general skills.", "Avoid copying official case-sheet typography or seal graphics."]
  },
  scifi: {
    visualNotes: ["registry header", "technical readouts", "equipment manifest", "status panels", "crew/contact strip"],
    layoutDirection: "Use a clean technical record: ID band, stat grid, role/skills matrix, gear manifest, and ship/crew relationship panels.",
    fieldGroups: ["Identity", "Origin", "Characteristics", "Skills", "Career / Role", "Gear", "Ship / Assets", "Contacts", "Notes"],
    cleanupNotes: ["Split military, corporate, and exploration games by tone.", "Confirm whether money, encumbrance, and ship shares belong on the character sheet."]
  },
  pulp: {
    visualNotes: ["bold title card", "ranked traits", "wound/status row", "action-forward gear"],
    layoutDirection: "Use a punchy adventure card: large hero name, fast-read traits, edges/stunts, wounds, and dramatic hooks.",
    fieldGroups: ["Identity", "Traits", "Edges / Stunts", "Wounds", "Gear", "Allies", "Notes"],
    cleanupNotes: ["Keep it fast and uncluttered.", "Mark optional genre modules as add-on panels."]
  },
  generic: {
    visualNotes: ["neutral campaign file", "configurable sections", "tag-based traits", "open notes"],
    layoutDirection: "Use a flexible character record with configurable labels, enough structure to demo the app, and no system-specific assumptions.",
    fieldGroups: ["Identity", "Concept", "Traits", "Resources", "Gear", "Relationships", "Notes"],
    cleanupNotes: ["Let the GM rename all field groups.", "Do not overfit the generic sheet to any one ruleset."]
  }
};

const SYSTEM_FIELDS: Partial<Record<GameType, string[]>> = {
  "Blades in the Dark": ["Playbook", "Heritage", "Background", "Actions", "Stress", "Trauma", "Vice", "Load", "Special Abilities", "Cohort / Crew"],
  "Burning Wheel": ["Stock", "Lifepaths", "Beliefs", "Instincts", "Traits", "Stats", "Skills", "Resources", "Circles", "Steel"],
  "Dungeons & Dragons": ["Ancestry", "Class & Level", "Ability Scores", "Saving Throws", "Skills", "Armor Class", "Hit Points", "Attacks", "Features", "Spells"],
  Pathfinder: ["Ancestry", "Background", "Class", "Ability Scores", "Proficiency Ranks", "Armor Class", "Hit Points", "Feats", "Actions", "Spells"],
  Traveller: ["Species", "Career", "Characteristics", "Skills", "Status", "Armour", "Weapons", "Equipment", "Credits", "Ship Shares", "Contacts"],
  "Vampire: The Masquerade": ["Clan", "Predator Type", "Attributes", "Skills", "Disciplines", "Hunger", "Humanity", "Health", "Willpower", "Touchstones"],
  "Mage: The Ascension": ["Tradition", "Essence", "Attributes", "Abilities", "Spheres", "Arete", "Quintessence", "Paradox", "Willpower", "Focus"],
  "Werewolf: The Apocalypse": ["Auspice", "Tribe", "Breed", "Attributes", "Abilities", "Gifts", "Rage", "Gnosis", "Willpower", "Renown"],
  "Call of Cthulhu": ["Occupation", "Characteristics", "Skills", "Sanity", "Luck", "Hit Points", "Magic Points", "Backstory", "Possessions", "Contacts"],
  "Delta Green": ["Profession", "Statistics", "Skills", "Sanity", "Breaking Points", "Bonds", "Wounds", "Gear", "Incidents", "Notes"],
  "Alien RPG": ["Career", "Attributes", "Skills", "Talents", "Stress", "Health", "Consumables", "Gear", "Agenda", "Buddy/Rival"],
  "Cyberpunk RED": ["Role", "Stats", "Skills", "Lifepath", "Humanity", "Hit Points", "Cyberware", "Weapons", "Armor", "Gear"],
  Mothership: ["Class", "Stats", "Saves", "Skills", "Stress", "Panic", "Wounds", "Loadout", "Credits", "Notes"],
  "Fate Core": ["High Concept", "Trouble", "Aspects", "Approaches / Skills", "Stunts", "Stress", "Consequences", "Refresh", "Extras"]
};

const SYSTEM_CONCEPTS: Partial<Record<GameType, string>> = {
  "Dungeons & Dragons": "Heroic fantasy built around a party of adventurers, class identity, escalating danger, tactical encounters, exploration, and treasure. The demo should show clear party-facing lore and a character sheet that separates ability scores, combat state, features, and spell/gear notes.",
  Pathfinder: "Crunchier heroic fantasy with strong ancestry/background/class identity, proficiency tiers, feats, and action economy. The demo sheet should make ranks and action tags easy to scan.",
  Traveller: "Grounded science-fiction adventure about careers, skills, trade, travel, patrons, ships, and consequences. The demo sheet should feel like a registry record and manifest rather than a fantasy stat page.",
  "Vampire: The Masquerade": "Modern gothic personal horror about undead politics, hunger, humanity, relationships, and predation. The sheet should foreground identity, clan/type, dot-rated traits, disciplines, hunger, health, willpower, and relationship anchors.",
  "Mage: The Ascension": "Occult modern fantasy about belief, reality, paradigms, and awakened will. The sheet should show mundane competence alongside Spheres, Arete, paradox risk, and focus tools.",
  "Call of Cthulhu": "Investigative cosmic horror where clues, competence, sanity, and fragile human context matter more than combat optimization. The sheet should read like a case file with mental strain visible at a glance.",
  "Blades in the Dark": "Criminal crew drama about scores, stress, trauma, vice, factions, and desperate action in a haunted industrial city. The sheet should read like a playbook and heat ledger.",
  "Fate Core": "A narrative engine centered on aspects, stunts, stress, consequences, and collaborative dramatic permissions. The sheet should be highly configurable and aspect-first."
};

function list(title: string, items: string[]) {
  return { title, items };
}

function familyLists(family: DemoFamily, fields: string[]) {
  return [
    list("Sheet Field Groups To Review", fields),
    list("Visual Direction Notes", FAMILY_STYLE[family].visualNotes),
    list("Cleanup Checklist", FAMILY_STYLE[family].cleanupNotes)
  ];
}

function sheetMarkdown(gameType: GameType, brief: DemoSheetBrief) {
  return `## Character Sheet Direction - ${gameType}

This is a CampaignRepo-native sheet brief. It is inspired by common online/reference sheet patterns for this type of game, but should be implemented as original web UI.

### Layout Direction

${brief.layoutDirection}

### Visual Notes

${brief.visualNotes.map((note) => `- ${note}`).join("\n")}

### Field Groups

${brief.fieldGroups.map((field) => `- ${field}`).join("\n")}

### Cleanup Notes

${brief.cleanupNotes.map((note) => `- ${note}`).join("\n")}`;
}

export function demoResearchFor(gameType: GameType, seed: DemoSeed): DemoResearch {
  const family = FAMILY_BY_GAME[gameType] || "generic";
  const style = FAMILY_STYLE[family];
  const fields = SYSTEM_FIELDS[gameType] || style.fieldGroups;
  const concept =
    SYSTEM_CONCEPTS[gameType] ||
    `${gameType} demo content should communicate the table promise quickly: ${seed.premise} The first-pass demo should give GMs enough connected pages to inspect tone, player-facing lore, secrets, and a sample character sheet direction without relying on licensed setting text.`;
  const sheetBrief: DemoSheetBrief = {
    status: "first-pass",
    visualNotes: style.visualNotes,
    layoutDirection: style.layoutDirection,
    fieldGroups: fields,
    cleanupNotes: [
      ...style.cleanupNotes,
      `Use ${seed.pcRole || "the sample character"} as the first example character.`,
      `Cross-link sheet hooks to ${seed.locationName || "the demo location"} and ${seed.factionName || "the demo faction"}.`
    ]
  };
  return {
    status: "first-pass",
    concept,
    sheetBrief,
    lists: familyLists(family, fields)
  };
}

export function demoSheetMarkdown(gameType: GameType, brief: DemoSheetBrief) {
  return sheetMarkdown(gameType, brief);
}

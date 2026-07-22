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
type DemoResearchProfile = {
  status?: DemoResearchStatus;
  concept: string;
  fields: string[];
  lists: { title: string; items: string[] }[];
};

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
  "Dune: Adventures in the Imperium": "scifi",
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
  "Dune: Adventures in the Imperium": ["House", "Homeworld", "Archetype", "Skills", "Drives", "Drive Statements", "Focuses", "Talents", "Assets", "Traits", "Determination"],
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
  "Dune: Adventures in the Imperium": "Feudal science-fiction intrigue about houses, loyalty, and the cost of ambition. Characters are defined less by gear than by their Drives and the statements attached to them, so the demo sheet should foreground Skills, Drives, Drive Statements, Assets, and House standing rather than equipment lists.",
  Traveller: "Grounded science-fiction adventure about careers, skills, trade, travel, patrons, ships, and consequences. The demo sheet should feel like a registry record and manifest rather than a fantasy stat page.",
  "Vampire: The Masquerade": "Modern gothic personal horror about undead politics, hunger, humanity, relationships, and predation. The sheet should foreground identity, clan/type, dot-rated traits, disciplines, hunger, health, willpower, and relationship anchors.",
  "Mage: The Ascension": "Occult modern fantasy about belief, reality, paradigms, and awakened will. The sheet should show mundane competence alongside Spheres, Arete, paradox risk, and focus tools.",
  "Call of Cthulhu": "Investigative cosmic horror where clues, competence, sanity, and fragile human context matter more than combat optimization. The sheet should read like a case file with mental strain visible at a glance.",
  "Blades in the Dark": "Criminal crew drama about scores, stress, trauma, vice, factions, and desperate action in a haunted industrial city. The sheet should read like a playbook and heat ledger.",
  "Fate Core": "A narrative engine centered on aspects, stunts, stress, consequences, and collaborative dramatic permissions. The sheet should be highly configurable and aspect-first."
};

const SYSTEM_PROFILES: Partial<Record<GameType, DemoResearchProfile>> = {
  "Blades in the Dark": {
    status: "ready-for-polish",
    concept: "Blades in the Dark is pressure-cooker crime fantasy: crews take scores, manage heat, indulge vice, and get pulled into faction clocks they only half understand. Demo content should make the crew feel like a living organization, not just a party, with claims, rivals, trauma, downtime, and consequences visible on every page.",
    fields: ["Crew", "Playbook", "Heritage", "Background", "Actions", "Stress", "Trauma", "Harm", "Vice", "Load", "Special Abilities", "Friends / Rivals"],
    lists: [
      list("Score Types", ["Assault", "Deception", "Stealth", "Occult", "Social", "Transport", "Sabotage", "Acquisition"]),
      list("Crew Pressures", ["Heat", "Wanted level", "Turf pressure", "Rival claims", "Coin shortage", "Entanglements", "Vice trouble", "Ghost activity"]),
      list("Sheet UI Priorities", ["Action dots in a compact grid", "Stress and trauma always visible", "Harm with severity tiers", "Load picker that changes gear visibility", "Crew/faction hooks beside the character"])
    ]
  },
  "Burning Wheel": {
    concept: "Burning Wheel campaigns turn on belief, intent, consequence, and hard-won growth. The demo should put Beliefs, Instincts, Traits, lifepaths, artha, and advancement tests in the foreground so the sheet teaches play: declare what matters, risk it, and let failure change the fiction.",
    fields: ["Stock", "Lifepaths", "Beliefs", "Instincts", "Traits", "Stats", "Skills", "Resources", "Circles", "Steel", "Mortal Wound", "Artha"],
    lists: [
      list("Belief Prompts", ["I will prove...", "I cannot forgive...", "The realm needs...", "My family must...", "This oath costs me..."]),
      list("Growth Track Notes", ["Routine tests", "Difficult tests", "Challenging tests", "Artha awards", "Trait votes", "Failed tests as story fuel"]),
      list("Sheet UI Priorities", ["Beliefs at the top", "Instincts beside conditions", "Skill tests with advancement marks", "Relationship/reputation callouts", "Wound penalties visible"])
    ]
  },
  "Dark Ages: Fae": {
    concept: "Dark Ages: Fae is medieval dream-politics: wonder, oaths, courts, and mortal fear grind against the slow advance of Banality. Demo pages should distinguish mortal face from fae identity and make freeholds, chimera, oaths, glamour, and court duties easy to connect.",
    fields: ["Mortal Name", "Fae Name", "Kith", "Court", "House", "Attributes", "Abilities", "Arts", "Realms", "Glamour", "Banality", "Oaths", "Chimera"],
    lists: [
      list("Fae Trouble", ["Broken oath", "Cold iron rumor", "Freehold debt", "Noble demand", "Chimerical beast", "Banality surge", "Mortal suspicion"]),
      list("Court Hooks", ["Hospitality demanded", "Beauty used as leverage", "Old grievance revived", "Impossible promise", "Token of favor stolen"]),
      list("Sheet UI Priorities", ["Mortal/fae dual identity", "Glamour and Banality side by side", "Arts and Realms as paired powers", "Oath ledger", "Freehold ties"])
    ]
  },
  "Dark Ages: Inquisitor": {
    concept: "Dark Ages: Inquisitor is faith, fear, and terrible certainty. Demo material should support investigations into the supernatural while showing the cost of authority: vows, virtues, doubts, relics, witnesses, and the question of whether the hunter is saving souls or breaking them.",
    fields: ["Name", "Order", "Vocation", "Attributes", "Abilities", "Conviction", "Faith", "Virtues", "Relics", "Suspicions", "Contacts", "Doubts"],
    lists: [
      list("Investigation Leads", ["Confession", "Relic trace", "Witness contradiction", "Blighted miracle", "Forbidden text", "Missing corpse", "False accusation"]),
      list("Authority Costs", ["Public panic", "Clerical politics", "Condemned innocent", "Corrupt superior", "Broken vow", "Monster wearing a trusted face"]),
      list("Sheet UI Priorities", ["Faith/conviction resources", "Relics and rites", "Witness list", "Suspect clock", "Doubt or corruption notes"])
    ]
  },
  "Dark Ages: Mage": {
    concept: "Dark Ages: Mage frames magic as worldview and peril. The demo should show paradigm conflict, masters and apprentices, chantries, spheres/pillars of power, quiet heresy, and the social danger of miracles in a fearful age.",
    fields: ["Name", "Tradition / Fellowship", "Paradigm", "Essence", "Attributes", "Abilities", "Spheres", "Arete", "Quintessence", "Paradox", "Foci", "Mentor"],
    lists: [
      list("Mage Problems", ["Miracle witnessed", "Grimoire theft", "Rival chantry", "Church suspicion", "Botched working", "Star omen", "Familiar bargain"]),
      list("Focus Examples", ["Astrolabe", "Prayer chain", "Labyrinth diagram", "Herbal smoke", "Blood seal", "Chanted theorem", "Crafted sigil"]),
      list("Sheet UI Priorities", ["Paradigm statement", "Sphere dots grid", "Quintessence/paradox counters", "Foci list", "Rote notes"])
    ]
  },
  "Dark Ages: Vampire": {
    concept: "Dark Ages: Vampire is feudal undead politics under candlelight. Demo pages should make domain, sire, clan, road, blood, boons, havens, and mortal herd matter as much as powers. Every character sheet should feel like a legal and spiritual liability.",
    fields: ["Name", "Clan", "Sire", "Generation", "Road", "Attributes", "Abilities", "Disciplines", "Blood Pool", "Willpower", "Health", "Boons", "Haven", "Retainers"],
    lists: [
      list("Domain Pressures", ["Tithe demanded", "Haven exposed", "Mortal church inquiry", "Clan insult", "Feeding ground dispute", "Boon called in", "Peasant uprising"]),
      list("Undead Assets", ["Herd", "Retainer", "Haven", "Influence", "Boons owed", "Relic", "Secret passage"]),
      list("Sheet UI Priorities", ["Clan/sire/domain header", "Blood and willpower tracks", "Discipline cards", "Boon ledger", "Road/morality visible"])
    ]
  },
  "Dark Ages: Werewolf": {
    concept: "Dark Ages: Werewolf is sacred war in a world still full of spirits. Demo content should make caerns, packs, renown, rage, rites, spirit bargains, kinfolk, and territory central so the sheet reflects duty as much as combat.",
    fields: ["Name", "Breed", "Auspice", "Tribe", "Pack", "Attributes", "Abilities", "Gifts", "Rage", "Gnosis", "Willpower", "Renown", "Rites", "Fetishes"],
    lists: [
      list("Sept Problems", ["Caern blight", "Spirit insult", "Kinfolk in danger", "Rival pack challenge", "Broken rite", "Human encroachment", "Wyrm-tainted lord"]),
      list("Spirit Deal Terms", ["Chiminage", "Taboo", "Seasonal offering", "Hunt obligation", "Name secrecy", "Debt of protection"]),
      list("Sheet UI Priorities", ["Auspice/tribe identity", "Rage and Gnosis counters", "Renown tracker", "Gift list grouped by source", "Pack/caern bonds"])
    ]
  },
  Dragonbane: {
    concept: "Dragonbane demos should feel quick, bright, and dangerous: folk-tale fantasy where a joke can turn into a death spiral once the dragon lands. The sheet should support fast rolls, conditions, heroic abilities, kin, profession, and gear without burying the playful tone.",
    fields: ["Kin", "Profession", "Age", "Attributes", "Skills", "Heroic Abilities", "Conditions", "Hit Points", "Willpower", "Armor", "Weapons", "Gear", "Mementos"],
    lists: [
      list("Adventure Beats", ["Warm village problem", "Odd patron", "Old ruin", "Monster with personality", "Treasure with a catch", "Campfire complication"]),
      list("Condition Ideas", ["Exhausted", "Sickly", "Dazed", "Angry", "Scared", "Disheartened"]),
      list("Sheet UI Priorities", ["Kin/profession badge", "Attribute and skill roll buttons", "Condition checkboxes", "Heroic abilities as cards", "Gear and treasure split"])
    ]
  },
  "Dungeons & Dragons": {
    status: "ready-for-polish",
    concept: "Dungeons & Dragons demos should teach heroic party play: clear class roles, exploration hooks, tactical danger, treasure, social ties, and a readable character sheet. The sample campaign should show how CampaignRepo handles lore, NPCs, factions, quests, magic items, and player-safe handouts.",
    fields: ["Ancestry", "Class & Level", "Background", "Ability Scores", "Saving Throws", "Skills", "Armor Class", "Hit Points", "Initiative", "Attacks", "Features", "Spells", "Equipment"],
    lists: [
      list("Page Seeds", ["Starting town", "Dungeon entrance", "Patron", "Rival adventuring party", "Villain cult", "Magic item", "Regional rumor", "Quest log"]),
      list("Encounter Ingredients", ["Terrain hazard", "Monster role", "Objective besides killing", "Treasure clue", "NPC in danger", "Rest pressure"]),
      list("Sheet UI Priorities", ["Ability score cards", "AC/HP/saves always visible", "Actions and attacks grouped", "Spell prep area", "Feature list with expandable rules notes"])
    ]
  },
  "Fabula Ultima": {
    concept: "Fabula Ultima demos should feel like a console RPG opening chapter: crystal trouble, dramatic bonds, colorful classes, clocks for villains, and a party destined to become legends. The sheet should celebrate multi-class identity, resources, bonds, and dramatic identity traits.",
    fields: ["Identity", "Theme", "Origin", "Classes", "Attributes", "Bonds", "Hit Points", "Mind Points", "Inventory Points", "Fabula Points", "Skills", "Spells", "Equipment"],
    lists: [
      list("JRPG Chapter Beats", ["Festival before crisis", "Airship arrival", "Crystal omen", "Rival party", "Boss with speech", "World map reveal", "Villain clock advances"]),
      list("Character Hooks", ["Lost heir", "Runaway apprentice", "Sky pirate", "Oathbound guardian", "Inventor prodigy", "Monster friend"]),
      list("Sheet UI Priorities", ["Class chips with levels", "Resource tracks", "Bond statements", "Inventory points", "Spell/skill cards with costs"])
    ]
  },
  "Mörk Borg": {
    concept: "Mork Borg demos should be vicious, funny, and terminal. The content should emphasize doom, filthy treasure, awful bargains, short-lived characters, and strong visual attitude while keeping CampaignRepo's demo text original rather than copying book layout.",
    fields: ["Name", "Class / Wretch", "Abilities", "HP", "Omens", "Silver", "Armor", "Weapons", "Scrolls", "Broken Bodies", "Miseries", "Filthy Gear"],
    lists: [
      list("Doom Table Seeds", ["Sun turns black", "Saint's corpse speaks", "Rations rot", "Priest sells plague", "Gate screams", "Dead king wakes"]),
      list("Loot Tone", ["Useful trash", "Blasphemous relic", "Rotten food", "Stolen silver", "Cursed weapon", "False miracle"]),
      list("Sheet UI Priorities", ["Huge doomed name", "Ability modifiers", "Omens counter", "Misery tracker", "Gear as dirty inventory scraps"])
    ]
  },
  "Old-School Essentials": {
    concept: "Old-School Essentials demos should show procedure-rich dungeon play: turns, light, reaction rolls, morale, treasure XP, retainers, factions, and maps. The character sheet should be plain, fast, and easy to print mentally.",
    fields: ["Class", "Level", "Alignment", "Attributes", "Saving Throws", "Armor Class", "Hit Points", "Movement", "Attacks", "Spells", "Equipment", "Treasure", "Retainers"],
    lists: [
      list("Dungeon Procedure", ["Exploration turn", "Torch duration", "Wandering monster", "Reaction check", "Morale check", "Rest", "Treasure extraction"]),
      list("Classic Problems", ["Stuck door", "Trap clue", "Faction parley", "Resource drain", "Map error", "Cursed treasure", "Retainer loyalty"]),
      list("Sheet UI Priorities", ["Saves table", "Inventory slots/weight", "Light and rations", "Treasure tally", "Retainer roster"])
    ]
  },
  Pathfinder: {
    concept: "Pathfinder demos should show crunchy heroic fantasy with tactical clarity: ancestry, background, class, feats, ranks, actions, conditions, and character options. The sheet needs hierarchy so detail is discoverable instead of noisy.",
    fields: ["Ancestry", "Heritage", "Background", "Class", "Level", "Ability Scores", "Proficiencies", "Skills", "Feats", "Actions", "Reactions", "Spells", "Equipment"],
    lists: [
      list("Action Tags", ["One action", "Two actions", "Three actions", "Reaction", "Free action", "Exploration activity", "Downtime activity"]),
      list("Build Hooks", ["Ancestry feat", "Skill feat", "Class feat", "Archetype", "Focus power", "Signature equipment"]),
      list("Sheet UI Priorities", ["Three-action action bar", "Proficiency rank badges", "Feat cards", "Condition chips", "Spell/actions search"])
    ]
  },
  Pendragon: {
    concept: "Pendragon demos should center lineage, virtue, glory, passion, duty, and seasons. CampaignRepo pages should make families, manors, oaths, battles, feasts, marriages, and winter phase records easy to maintain across years.",
    fields: ["Name", "Homeland", "Family", "Traits", "Passions", "Skills", "Combat Skills", "Glory", "Honor", "Age", "Horse", "Arms", "Manor", "Family Events"],
    lists: [
      list("Seasonal Records", ["Spring court", "Summer campaign", "Autumn harvest", "Winter phase", "Marriage prospect", "Heir birth", "Manor improvement"]),
      list("Knightly Trouble", ["Hospitality test", "Passion conflict", "Liege command", "Family feud", "Questing beast rumor", "Saxon raid", "Tournament boast"]),
      list("Sheet UI Priorities", ["Traits/passions as paired ratings", "Glory ledger", "Family tree hooks", "Horse/arms panel", "Winter phase history"])
    ]
  },
  Reign: {
    concept: "Reign demos should make the company as important as the heroes. The app should expose organization stats, projects, enemies, assets, territory, and consequences, while individual sheets track the people driving those institutional moves.",
    fields: ["Name", "Role", "Stats", "Skills", "Esoteric Disciplines", "Advantages", "Company", "Company Stats", "Assets", "Projects", "Enemies", "Resources"],
    lists: [
      list("Company Moves", ["Expand territory", "Crush rival", "Secure trade", "Train specialists", "Sway population", "Spy network", "Build wonder"]),
      list("Organization Assets", ["Guild charter", "Fortified hall", "Agent network", "Trade monopoly", "Mercenary contract", "Sacred legitimacy"]),
      list("Sheet UI Priorities", ["Character/company split view", "Company stats prominent", "Project clocks", "Asset list", "One-roll-engine dice pools"])
    ]
  },
  "Shadowdark RPG": {
    concept: "Shadowdark demos should create urgent dungeon pressure: real-time torchlight, risky delves, simple classes, dangerous magic, and loot worth the fear. The sheet should be compact enough that the map and countdown matter more than rules lookup.",
    fields: ["Ancestry", "Class", "Level", "Background", "Stats", "Armor Class", "Hit Points", "Gear Slots", "Torches", "Spells", "Talents", "Treasure"],
    lists: [
      list("Delve Pressure", ["Torch timer", "Random encounter", "Noise", "Encumbrance", "Retreat route", "Rest risk", "Darkness hazard"]),
      list("Room Seeds", ["Obvious treasure", "Unclear monster motive", "Lever with cost", "Fungal clue", "Shrine bargain", "Vertical danger"]),
      list("Sheet UI Priorities", ["Torch/gear slots", "Roll buttons", "Spell mishap notes", "Talent log", "Treasure and XP visible"])
    ]
  },
  "Sword Chronicle": {
    status: "ready-for-polish",
    concept: "Sword Chronicle demos should make noble houses playable: status, intrigue, warfare, holdings, heirs, alliances, and scandal. The character sheet should connect personal abilities to house resources and long-term political stakes.",
    fields: ["Name", "House", "Status", "Abilities", "Specialties", "Destiny", "Health", "Intrigue Defense", "Combat Defense", "Armor", "Weapons", "Holdings", "Relationships"],
    lists: [
      list("House Assets", ["Lands", "Law", "Population", "Power", "Wealth", "Defense", "Influence"]),
      list("Court Problems", ["Marriage offer", "Hostage demand", "Border raid", "Debt scandal", "Bastard claim", "Feast insult", "Banner call"]),
      list("Sheet UI Priorities", ["House badge in header", "Intrigue/combat defenses", "Specialty modifiers", "Destiny points", "Holdings and relationships"])
    ]
  },
  "The One Ring": {
    concept: "The One Ring demos should feel like journeys through a beautiful world under growing shadow. Pages should track sanctuaries, patrons, journeys, councils, fellowship, shadow, hope, and regional lore with strong player-safe handouts.",
    fields: ["Culture", "Calling", "Standard of Living", "Attributes", "Skills", "Combat Proficiencies", "Valour", "Wisdom", "Endurance", "Hope", "Shadow", "Fellowship", "Wargear"],
    lists: [
      list("Journey Roles", ["Guide", "Scout", "Hunter", "Look-out", "Companion in trouble", "Patron request"]),
      list("Fellowship Phase Seeds", ["Sanctuary opened", "Patron audience", "Heirloom improved", "Rumor learned", "Shadow confession", "Home trouble"]),
      list("Sheet UI Priorities", ["Hope/endurance/shadow tracks", "Culture/calling identity", "Journey role assignment", "Fellowship pool", "Wargear as named heirlooms"])
    ]
  },
  "Warhammer Fantasy Roleplay": {
    concept: "Warhammer Fantasy Roleplay demos should be grimy, dangerous, and suspiciously funny. The sheet should make career, status, corruption, wounds, criticals, disease, talents, trappings, and petty social consequences easy to see.",
    fields: ["Species", "Career", "Class", "Status", "Characteristics", "Skills", "Talents", "Fate", "Fortune", "Resilience", "Wounds", "Criticals", "Corruption", "Trappings"],
    lists: [
      list("Grim Complications", ["Tax collector", "Mutant rumor", "Guild permit", "Rotten noble", "Skaven denial", "Witch hunter arrival", "Bad ale"]),
      list("Career Hooks", ["Rat catcher", "Road warden", "Apprentice wizard", "Boatman", "Scribe", "Soldier", "Physician"]),
      list("Sheet UI Priorities", ["Career/status header", "Characteristic advances", "Wound/critical panel", "Corruption counter", "Trappings inventory"])
    ]
  },
  "Call of Cthulhu": {
    status: "ready-for-polish",
    concept: "Call of Cthulhu demos should work like a case folder: investigators, clues, locations, handouts, sanity pressure, and one truth the players wish was not true. The sheet should prioritize occupation, skills, backstory, sanity, luck, wounds, and artifacts.",
    fields: ["Name", "Occupation", "Characteristics", "Skills", "Sanity", "Luck", "Hit Points", "Magic Points", "Backstory", "Ideology", "Significant People", "Phobias / Manias", "Possessions"],
    lists: [
      list("Clue Types", ["Document", "Witness", "Physical trace", "Dream", "Photograph", "Ritual residue", "Contradiction", "Library lead"]),
      list("Investigation Pressure", ["Police attention", "Missing time", "Sanity loss", "Cult surveillance", "Weather closes in", "Mythos tome temptation"]),
      list("Sheet UI Priorities", ["Skill percentage grid", "Sanity/luck/HP strip", "Backstory anchors", "Possession list", "Mythos exposure notes"])
    ]
  },
  "Candela Obscura": {
    concept: "Candela Obscura demos should feel like a supernatural case board for a circle: assignments, scars, drives, specialties, bleed containment, chapter resources, and consequences after the case. The sheet should give the circle identity as much space as individual competence.",
    fields: ["Name", "Role", "Specialty", "Drive", "Actions", "Resistance", "Marks", "Scars", "Illumination Keys", "Gear", "Relationships", "Circle"],
    lists: [
      list("Case Board Cards", ["Phenomenon", "Victim", "Location", "Witness", "Object", "Rival circle", "Containment option", "Aftermath scar"]),
      list("Bleed Signs", ["Cold lights", "Memory overlap", "False reflections", "Whispering walls", "Time slip", "Impossible wound"]),
      list("Sheet UI Priorities", ["Role/specialty banner", "Marks and scars", "Drive prompt", "Case links", "Circle resource panel"])
    ]
  },
  "Changeling: The Dreaming": {
    concept: "Changeling: The Dreaming demos should make wonder fragile and social. The sheet should show mortal identity, kith, seeming, court, arts, realms, glamour, banality, chimera, freehold duties, and the people keeping the dream alive.",
    fields: ["Mortal Name", "Fae Name", "Kith", "Seeming", "Court", "Attributes", "Abilities", "Arts", "Realms", "Glamour", "Banality", "Willpower", "Chimera", "Freehold"],
    lists: [
      list("Dreaming Hooks", ["Foreclosed freehold", "Lost chimera", "Oathbound favor", "Cold iron threat", "Festival of glamour", "Noble decree", "Mortal loved one"]),
      list("Mood Notes", ["Whimsy with teeth", "Courtly obligation", "Childhood wonder", "Urban melancholy", "Myth in a strip mall"]),
      list("Sheet UI Priorities", ["Dual identity header", "Glamour/Banality contrast", "Arts and Realms grid", "Chimera cards", "Freehold relationships"])
    ]
  },
  "Delta Green": {
    status: "ready-for-polish",
    concept: "Delta Green demos should feel like an operational file: agents, handler notes, bonds under strain, coverups, impossible evidence, and a mission clock. The sheet should track profession, skills, sanity, breaking point, bonds, disorders, gear, and incidents.",
    fields: ["Codename", "Profession", "Statistics", "Skills", "Sanity", "Breaking Point", "Bonds", "Motivations", "Disorders", "Wounds", "Gear", "Incidents", "Cover Identity"],
    lists: [
      list("Operation Beats", ["Briefing", "Cover identity", "Scene of incident", "Witness cleanup", "Unnatural reveal", "Evidence disposal", "Debrief lie"]),
      list("Bond Pressure", ["Missed birthday", "Violent outburst", "Debt", "Divorce papers", "Suspicious partner", "Therapy appointment"]),
      list("Sheet UI Priorities", ["Agent header with clearance", "Sanity/breaking point", "Bond damage ledger", "Incident history", "Gear and illegal assets"])
    ]
  },
  "Demon: The Fallen": {
    concept: "Demon: The Fallen demos should focus on cosmic memory in broken human lives: house, faction, torment, faith, pacts, apocalyptic form, and the host's unfinished business. The sheet should hold angelic scale and street-level drama at once.",
    fields: ["Celestial Name", "Host Name", "House", "Faction", "Nature", "Demeanor", "Attributes", "Abilities", "Lores", "Faith", "Torment", "Willpower", "Pacts", "Apocalyptic Form"],
    lists: [
      list("Faith Sources", ["Devoted thrall", "Desperate prayer", "Miracle witnessed", "Cult service", "Host's loved one", "False prophet"]),
      list("Torment Trouble", ["Old war memory", "Cruel miracle", "Host conflict", "Earthbound command", "Rival fallen", "Broken pact"]),
      list("Sheet UI Priorities", ["Host/celestial identity split", "Faith and Torment tracks", "Lore powers", "Pact ledger", "Apocalyptic form toggles"])
    ]
  },
  "Hunter: The Reckoning": {
    concept: "Hunter: The Reckoning demos should emphasize ordinary people choosing what to do after seeing the truth. The sheet should keep edges, creed, conviction, injuries, contacts, and moral lines visible, with pages supporting cells, targets, and fallout.",
    fields: ["Name", "Creed", "Virtue", "Concept", "Attributes", "Abilities", "Edges", "Conviction", "Health", "Willpower", "Cell", "Contacts", "Targets", "Lines"],
    lists: [
      list("Cell Problems", ["Monster next door", "Evidence dismissed", "Family endangered", "Police pressure", "Another hunter goes too far", "Mercy debate"]),
      list("Target File Sections", ["Signs", "Weakness", "Victims", "Pattern", "Cover story", "Final choice"]),
      list("Sheet UI Priorities", ["Creed/virtue header", "Edges as powers", "Conviction tracker", "Cell relationship map", "Target notes"])
    ]
  },
  "Mage: The Ascension": {
    status: "ready-for-polish",
    concept: "Mage: The Ascension demos should be about belief colliding with reality. The app should support paradigms, practices, instruments, spheres, rotes, quintessence, paradox, chantries, mentors, and ideological enemies without flattening magic into a spell list.",
    fields: ["Name", "Tradition", "Paradigm", "Practice", "Instruments", "Attributes", "Abilities", "Spheres", "Arete", "Quintessence", "Paradox", "Willpower", "Rotes", "Resonance"],
    lists: [
      list("Reality War Scenes", ["Coincidental working", "Vulgar miracle", "Sleeper witness", "Technocratic audit", "Chantry council", "Paradox backlash"]),
      list("Focus Notes", ["Practice", "Instrument", "Belief statement", "Limit", "Signature effect", "Mentor warning"]),
      list("Sheet UI Priorities", ["Paradigm statement prominent", "Sphere dots grid", "Paradox/quintessence counters", "Rote cards", "Practice/instrument library"])
    ]
  },
  "Mummy: The Resurrection": {
    concept: "Mummy: The Resurrection demos should feel ancient and modern at the same time: recurring lives, sacred purpose, relics, cults, memory, balance, and enemies who steal souls. The sheet should make immortal identity and current life both editable.",
    fields: ["True Name", "Modern Identity", "Dynasty", "Balance", "Attributes", "Abilities", "Hekau", "Sekhem", "Willpower", "Memory", "Vessels", "Relics", "Cult", "Purpose"],
    lists: [
      list("Resurrection Hooks", ["Stolen vessel", "Past-life enemy", "Museum theft", "Cult schism", "Dream of Duat", "Soul debt"]),
      list("Relic Questions", ["Who buried it?", "Who stole it?", "What memory wakes?", "What price activates it?", "Who claims ownership?"]),
      list("Sheet UI Priorities", ["Ancient/modern identity", "Sekhem and balance", "Hekau list", "Relic/vessel inventory", "Memory notes"])
    ]
  },
  "The King in Yellow RPG": {
    concept: "The King in Yellow RPG demos should be structured around contamination by art, altered timelines, and obsessive clues. The sheet should support identities that may change across sequence, shock/injury pressure, relationships, and the cursed text at the center.",
    fields: ["Identity", "Occupation", "Drive", "Investigative Abilities", "General Abilities", "Shock", "Injury", "Contacts", "Clues", "Cursed Media", "Continuity Notes"],
    lists: [
      list("Yellow Sign Clues", ["Playbill", "Mask", "Unstageable line", "Audience memory", "Impossible review", "Set design sketch", "Actor disappearance"]),
      list("Scene Modes", ["Bohemian party", "Police inquiry", "Theatre rehearsal", "Hospital recovery", "Unreliable city", "Future echo"]),
      list("Sheet UI Priorities", ["Case-era identity", "Shock/injury tracks", "Ability pools", "Cursed media notes", "Continuity/change log"])
    ]
  },
  "Twilight: 2000": {
    concept: "Twilight: 2000 demos should show survival logistics after organized war breaks down. Campaign pages should track ammo, fuel, food, routes, factions, vehicles, refugees, and the choices a stranded unit makes when command is gone.",
    fields: ["Name", "Nationality", "Military / Civilian Specialty", "Attributes", "Skills", "Coolness Under Fire", "Hit Capacity", "Stress", "Ammo", "Rations", "Vehicle", "Unit", "Contacts", "Gear"],
    lists: [
      list("Survival Logistics", ["Fuel", "Ammunition", "Food", "Medicine", "Spare parts", "Water", "Shelter", "Trade goods"]),
      list("Road Encounters", ["Checkpoint", "Refugee convoy", "Minefield", "Fuel rumor", "Broken bridge", "Radio ghost", "Local militia"]),
      list("Sheet UI Priorities", ["Unit/role header", "Ammo and supply counters", "Vehicle panel", "Stress/injury", "Contact/faction map"])
    ]
  },
  "Vampire: The Masquerade": {
    status: "ready-for-polish",
    concept: "Vampire: The Masquerade demos should center hunger, secrecy, predation, and politics. CampaignRepo should make city domains, boons, touchstones, relationships, feeding grounds, and masquerade risks easy to expose or hide per audience.",
    fields: ["Name", "Clan", "Predator Type", "Generation", "Ambition", "Desire", "Attributes", "Skills", "Disciplines", "Hunger", "Humanity", "Health", "Willpower", "Touchstones", "Haven"],
    lists: [
      list("City Web Pages", ["Prince", "Coterie", "Feeding ground", "Elysium", "Rival clan", "Touchstone", "Boon ledger", "Masquerade breach"]),
      list("Nightly Pressures", ["Hunger spike", "Boon called", "Touchstone threatened", "Domain trespass", "SI surveillance", "Clan command", "Messy critical fallout"]),
      list("Sheet UI Priorities", ["Hunger dice/counter", "Humanity and stains", "Discipline cards", "Touchstone anchors", "Boon/domain ledger"])
    ]
  },
  "Werewolf: The Apocalypse": {
    status: "ready-for-polish",
    concept: "Werewolf: The Apocalypse demos should be ecological, spiritual, and furious. The app should track packs, caerns, spirits, corporations, kin, renown, gifts, rage, and impossible choices between human lives and sacred war.",
    fields: ["Name", "Auspice", "Tribe", "Breed / Form", "Pack", "Attributes", "Abilities", "Gifts", "Rage", "Gnosis", "Willpower", "Renown", "Health", "Rites", "Fetishes"],
    lists: [
      list("Pack Agenda", ["Defend caern", "Punish polluter", "Bargain with spirit", "Protect kinfolk", "Expose fomori", "Challenge elder", "Cleanse site"]),
      list("Spirit Tags", ["Hungry", "Proud", "Wounded", "Ancient", "Urban", "Elemental", "Trickster", "Corrupted"]),
      list("Sheet UI Priorities", ["Pack/caern header", "Rage/Gnosis/Willpower tracks", "Renown tracker", "Gift cards", "Form-specific notes"])
    ]
  },
  "Wraith: The Oblivion": {
    concept: "Wraith: The Oblivion demos should focus on memory, fetters, passions, shadows, and the bureaucracy of death. The sheet should make what anchors a character visible and what destroys them uncomfortably close.",
    fields: ["Name", "Death", "Archetype", "Nature", "Demeanor", "Attributes", "Abilities", "Arcanoi", "Pathos", "Willpower", "Corpus", "Passions", "Fetters", "Shadow", "Memoriam"],
    lists: [
      list("Haunting Hooks", ["Living loved one", "Destroyed fetter", "Shadow bargain", "Hierarchy order", "Spectre rumor", "Old murder", "Forgotten name"]),
      list("Afterlife Assets", ["Fetter", "Relic", "Haunt", "Ally among dead", "Living medium", "Secret memory"]),
      list("Sheet UI Priorities", ["Passions/fetters prominent", "Pathos/corpus tracks", "Shadow notes", "Arcanoi list", "Living-world links"])
    ]
  },
  "2300AD": {
    concept: "2300AD demos should be grounded frontier science fiction: colonization, survey work, national/corporate interests, hostile environments, hard logistics, and contact problems. The sheet should look like a mission record rather than space opera flair.",
    fields: ["Name", "Nationality", "Career", "Attributes", "Skills", "Training", "Contacts", "Equipment", "Armor", "Weapons", "Vehicle", "Ship Role", "Credits", "Mission Log"],
    lists: [
      list("Frontier Problems", ["Colonial politics", "Biosphere hazard", "Supply delay", "Corporate claim", "Survey anomaly", "Military patrol", "Cultural misunderstanding"]),
      list("Expedition Gear", ["Survey drone", "Vacc suit", "Field lab", "Rover", "Beacon", "Medkit", "Translator", "Rations"]),
      list("Sheet UI Priorities", ["Mission header", "Skill matrix", "Environmental protection", "Gear manifest", "Contacts/national affiliation"])
    ]
  },
  "Alien RPG": {
    status: "ready-for-polish",
    concept: "Alien RPG demos should sell industrial space horror: jobs, corporate orders, stress, panic, consumables, agendas, buddy/rival relationships, and one thing in the vents that was never in the contract.",
    fields: ["Name", "Career", "Personal Agenda", "Buddy", "Rival", "Attributes", "Skills", "Talents", "Stress", "Health", "Radiation", "Air", "Food", "Water", "Power", "Gear", "Critical Injuries"],
    lists: [
      list("Cinematic Act Beats", ["Company order", "Routine job", "Sensor anomaly", "Body horror clue", "Lockdown", "Panic cascade", "Final betrayal"]),
      list("Consumables", ["Air", "Power", "Food", "Water", "Ammo", "Time", "Trust"]),
      list("Sheet UI Priorities", ["Stress/panic strip", "Consumables counters", "Agenda/buddy/rival", "Gear cards", "Critical injury log"])
    ]
  },
  Coriolis: {
    concept: "Coriolis demos should mix trade, prayer, debt, faction politics, and starship risk. The sheet should hold crew position, icons, darkness points, talents, gear, ship ties, and the character's place in a larger spiritual economy.",
    fields: ["Name", "Concept", "Group Concept", "Icon", "Attributes", "Skills", "Talents", "Reputation", "Hit Points", "Mind Points", "Gear", "Ship Role", "Debt", "Relationships"],
    lists: [
      list("Station Intrigue", ["Dock fee dispute", "Icon omen", "Smuggled relic", "Merchant house threat", "Portal jump risk", "Crew debt", "Darkness bargain"]),
      list("Crew Assets", ["Ship module", "Trade contact", "Religious patron", "Hidden cargo", "Dockside fixer", "Old chart"]),
      list("Sheet UI Priorities", ["Icon and concept header", "Group/ship connection", "HP/MP/stress", "Talent cards", "Debt and reputation"])
    ]
  },
  "Cyberpunk RED": {
    status: "ready-for-polish",
    concept: "Cyberpunk RED demos should be street-level survival in a broken neon economy: roles, lifepaths, gigs, fixers, reputation, humanity, cyberware, armor, weapons, and corporate retaliation. The sheet should feel useful mid-job.",
    fields: ["Handle", "Role", "Role Ability", "Stats", "Skills", "Lifepath", "Humanity", "Hit Points", "Death Save", "Armor", "Weapons", "Cyberware", "Fashion", "Gear", "Contacts", "Reputation"],
    lists: [
      list("Gig Types", ["Extraction", "Data theft", "Protection", "Sabotage", "Courier run", "Revenge hit", "Blackmail cleanup", "Rescue"]),
      list("Street Pressure", ["Rent due", "Cyberpsychosis risk", "Gang turf", "Corp reprisal", "Fixer lie", "Medtech shortage", "Media leak"]),
      list("Sheet UI Priorities", ["Role ability prominent", "HP/armor/death save", "Cyberware humanity cost", "Weapon table", "Lifepath/contact map"])
    ]
  },
  Mothership: {
    status: "ready-for-polish",
    concept: "Mothership demos should feel like a workplace accident in hell: contractors, broken ships, stress, panic, bad pay, fragile bodies, and a threat nobody understands in time. The sheet should be stark, fast, and panic-aware.",
    fields: ["Name", "Class", "Stats", "Saves", "Skills", "Stress", "Panic", "Wounds", "Health", "Armor", "Loadout", "Credits", "Patch", "Contract", "Notes"],
    lists: [
      list("Horror Job Seeds", ["Derelict salvage", "Cryopod recovery", "Terraforming audit", "Missing crew", "Artifact transport", "Station quarantine", "Corporate cleanup"]),
      list("Failure Texture", ["Air running thin", "Alarm loop", "Static on comms", "Incorrect map", "Blood in zero-g", "Payroll dispute", "Door welded shut"]),
      list("Sheet UI Priorities", ["Stress and panic front and center", "Class patch visual", "Loadout manifest", "Wound log", "Contract objective"])
    ]
  },
  Starfinder: {
    concept: "Starfinder demos should be bright tactical space fantasy: species, themes, classes, starships, factions, magic tech, exploration, and high-energy danger. The sheet should support class features, stamina/HP, resolve, gear, spells, and ship role.",
    fields: ["Species", "Theme", "Class", "Level", "Ability Scores", "Skills", "Stamina", "Hit Points", "Resolve", "Armor Class", "Attacks", "Class Features", "Spells", "Gear", "Starship Role"],
    lists: [
      list("Space Fantasy Beats", ["Station intrigue", "Alien ruin", "Ship chase", "Faction contract", "Magic-tech relic", "Boarding action", "Planetfall hazard"]),
      list("Crew Roles", ["Captain", "Pilot", "Engineer", "Science Officer", "Gunner", "Envoy", "Mystic support"]),
      list("Sheet UI Priorities", ["Stamina/HP/resolve strip", "Class/theme/species header", "Gear upgrades", "Spell/feature cards", "Starship role panel"])
    ]
  },
  Traveller: {
    status: "ready-for-polish",
    concept: "Traveller demos should be about careers, patrons, trade routes, debt, ships, skills, and consequences. The sheet should feel like a clean registry file where a whole prior life is visible: careers, terms, benefits, contacts, enemies, gear, ship shares, and liabilities.",
    fields: ["Name", "Species", "Career", "Terms", "Age", "Characteristics", "Skills", "Ranks", "Benefits", "Credits", "Pension", "Ship Shares", "Equipment", "Weapons", "Armour", "Contacts", "Rivals", "Allies"],
    lists: [
      list("Subsector Pages", ["Mainworld", "Downport", "Patron", "Trade code", "Rumor", "Cargo", "Naval base", "Scout station", "Local law"]),
      list("Patron Jobs", ["Speculative cargo", "Survey anomaly", "Passenger trouble", "Mercenary escort", "Courier packet", "Salvage claim", "Diplomatic errand"]),
      list("Sheet UI Priorities", ["Registry banner", "Characteristic tiles", "Alphabetized skills matrix", "Career history timeline", "Ship/assets/debts panels"])
    ]
  },
  "Warhammer 40,000 Roleplay": {
    concept: "Warhammer 40,000 Roleplay demos should be baroque, lethal, and bureaucratic: acolytes or specialists serving impossible authority in a galaxy of heresy. The sheet should emphasize origin, role, characteristics, skills, talents, corruption, insanity/stress, wounds, armor, weapons, and authority.",
    fields: ["Name", "Home World", "Background", "Role", "Aptitudes", "Characteristics", "Skills", "Talents", "Fate", "Wounds", "Fatigue", "Corruption", "Insanity / Shock", "Armor", "Weapons", "Influence", "Gear"],
    lists: [
      list("Imperial Case Files", ["Heresy rumor", "Xenos artifact", "Mutant cult", "Hive noble", "Adeptus rivalry", "Forbidden machine", "Missing tithe"]),
      list("Gothic Assets", ["Rosette", "Servo-skull", "Dataslate", "Prayer strip", "Bolt weapon", "Voidship berth", "Interrogator contact"]),
      list("Sheet UI Priorities", ["Authority/inquisition header", "Characteristic and skill grids", "Corruption/shock tracks", "Weapon/armor tables", "Case file links"])
    ]
  },
  "Fate Core": {
    status: "ready-for-polish",
    concept: "Fate Core demos should teach aspect-forward play: characters are proactive, trouble is useful, and every page can become a compel or invocation. The sheet should be configurable, readable, and focused on aspects, stunts, stress, consequences, and extras.",
    fields: ["High Concept", "Trouble", "Aspects", "Skills / Approaches", "Stunts", "Refresh", "Fate Points", "Stress", "Consequences", "Extras", "Relationships"],
    lists: [
      list("Aspect Prompts", ["Because I...", "I cannot resist...", "Known for...", "Owes me...", "The city always...", "Never again...", "My crew..."]),
      list("Scene Tools", ["Create advantage", "Compel", "Invoke", "Boost", "Cost", "Success with style", "Consequence offer"]),
      list("Sheet UI Priorities", ["Aspects first", "Fate point counter", "Stress boxes configurable", "Consequences with recovery notes", "Stunt cards"])
    ]
  },
  "Savage Worlds": {
    concept: "Savage Worlds demos should support fast, pulpy action with genre flexibility: traits by die type, edges, hindrances, bennies, wounds, fatigue, powers, vehicles, and set-piece scenes. The sheet should be punchy and table-fast.",
    fields: ["Name", "Concept", "Ancestry", "Attributes", "Skills", "Pace", "Parry", "Toughness", "Bennies", "Wounds", "Fatigue", "Edges", "Hindrances", "Powers", "Gear", "Allies"],
    lists: [
      list("Set Piece Seeds", ["Chase", "Dramatic task", "Mass battle", "Social conflict", "Quick encounter", "Vehicle stunt", "Cliffhanger"]),
      list("Pulpy Pressure", ["Villain monologue", "Countdown device", "Hostage", "Collapsing bridge", "Rival hero", "One last benny"]),
      list("Sheet UI Priorities", ["Die-type trait buttons", "Bennies counter", "Wound/fatigue strip", "Edges/hindrances cards", "Power point panel"])
    ]
  },
  Custom: {
    concept: "Custom demos should prove CampaignRepo can carry a homebrew or unsupported game without waiting on a rules module. The sheet should be label-driven, with GM-editable field groups, resources, traits, clocks, relationships, and notes.",
    fields: ["Identity", "Concept", "Traits", "Resources", "Actions", "Conditions", "Gear", "Relationships", "Clocks", "Notes"],
    lists: [
      list("Custom Build Questions", ["What does a roll use?", "What runs out?", "What hurts?", "What improves?", "What is public?", "What is secret?"]),
      list("Reusable Sections", ["Identity", "Stats", "Moves", "Inventory", "Relationships", "Progress clocks", "GM-only truths"]),
      list("Sheet UI Priorities", ["Editable labels", "Add/remove field groups", "Flexible counters", "Markdown notes", "Import/export friendly structure"])
    ]
  }
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
  const profile = SYSTEM_PROFILES[gameType];
  const fields = profile?.fields || SYSTEM_FIELDS[gameType] || style.fieldGroups;
  const concept =
    profile?.concept ||
    SYSTEM_CONCEPTS[gameType] ||
    `${gameType} demo content should communicate the table promise quickly: ${seed.premise} The first-pass demo should give GMs enough connected pages to inspect tone, player-facing lore, secrets, and a sample character sheet direction without relying on licensed setting text.`;
  const sheetBrief: DemoSheetBrief = {
    status: profile?.status || "first-pass",
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
    status: profile?.status || "first-pass",
    concept,
    sheetBrief,
    lists: [...familyLists(family, fields), ...(profile?.lists || [])]
  };
}

export function demoSheetMarkdown(gameType: GameType, brief: DemoSheetBrief) {
  return sheetMarkdown(gameType, brief);
}

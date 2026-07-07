import type { GameType } from "@/lib/types";
import { demoResearchFor, demoSheetMarkdown, type DemoResearchStatus, type DemoSheetBrief } from "@/lib/demo-research";

/**
 * Demo data — one bespoke "kit" per game system, rendered through a single
 * uniform page template so every game's demo content shares the same clean
 * format. Kits are original, genre-appropriate placeholders (not licensed
 * setting material). Rendered pages cross-link each other so the relationship
 * map and backlinks light up immediately.
 *
 * Used two ways:
 *  - Dashboard demo browser previews demoPagesFor(gameType) in-app.
 *  - The demo seed API writes those pages into a campaign repo on opt-in.
 */

export type DemoEntity = { name: string; role?: string; blurb: string };

export type DemoList = { title: string; items: string[] };

export type DemoKit = {
  premise: string;
  location: DemoEntity;
  faction: DemoEntity;
  npc: DemoEntity;
  pc: DemoEntity;
  threat: DemoEntity;
  item: DemoEntity;
  /** Researched flavor — filled in per game. */
  concept?: string;            // a fuller paragraph on setting, themes, and play
  sheet?: string;              // the system's character sheet, as markdown, appended to the sample PC
  lists?: DemoList[];          // reference lists (ancestries, classes, conditions, gear, …)
  researchStatus?: DemoResearchStatus;
  sheetBrief?: DemoSheetBrief;
};

export type DemoPage = {
  slug: string;
  name: string;
  category: string;
  visibility: "gm" | "players";
  summary: string;
  tags: string[];
  body: string;
};

function demoSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const e = (name: string, role: string, blurb: string): DemoEntity => ({ name, role, blurb });
const x = (name: string, blurb: string): DemoEntity => ({ name, blurb });

const DEMO_KITS: Record<GameType, DemoKit> = {
  // ------------------------------- Fantasy -------------------------------
  "Blades in the Dark": {
    premise: "A scoundrel crew claws for power in a haunted, lightning-walled city.",
    location: x("Cindergate", "A soot-black district where leviathan-oil refineries never sleep and the fog hides more than it reveals."),
    faction: x("The Ashen Veil", "A rival crew of smugglers and spirit-traffickers who resent every job you take."),
    npc: e("Madame Sévrin", "Information broker", "She trades secrets from a velvet booth and always knows who owes whom."),
    pc: e("Quill", "Whisper (occultist)", "A twitchy medium who hears the city's ghosts and pretends it's a gift."),
    threat: x("The Choir of Static", "A knot of angry spirits gathering in the electric hum of the lightning barrier."),
    item: x("The Cortex Key", "A brass-and-bone rod that briefly opens a spirit well — everyone wants it, no one should hold it.")
  },
  "Burning Wheel": {
    premise: "Ambition and belief collide in a low-magic realm on the edge of civil war.",
    location: x("The Graymarch", "A contested borderland of stone keeps, muddy roads, and old grievances."),
    faction: x("The Iron Covenant", "A sworn brotherhood of knights bound by oaths older than the current king."),
    npc: e("Ser Aldous", "Oathbound knight", "Honourable to a fault, and quietly certain the crown has lost its way."),
    pc: e("Bram", "Hedge-priest", "A wandering cleric with a beggar's coat and a scholar's stubborn faith."),
    threat: x("The Succession", "Two claimants, one throne, and a war that will be paid for in villages."),
    item: x("The Broken Charter", "A torn founding document whose missing half could legitimize a rebellion.")
  },
  "Dark Ages: Fae": {
    premise: "Medieval changelings guard the Dreaming as cold Banality creeps across the land.",
    location: x("The Hollow of Thornwake", "A freehold hidden in a briar-choked barrow, warm with old glamour."),
    faction: x("The Court of Silver Thorns", "A prickly noble court that prizes beauty, oaths, and elaborate grudges."),
    npc: e("Lord Bramblefast", "Sidhe noble", "Gracious host, ruthless schemer, and utterly bound by his own promises."),
    pc: e("Pell", "Commoner changeling", "A miller's daughter who dreams too vividly and pays for it."),
    threat: x("The Banality Frost", "A creeping numbness that turns wonder to ash and freeholds to ruins."),
    item: x("The Dreaming Glass", "A cracked mirror that shows the fae truth beneath any mortal face.")
  },
  "Dark Ages: Inquisitor": {
    premise: "Church-sanctioned hunters root out the supernatural in a fearful medieval world.",
    location: x("The Cloister of Saint Aldhelm", "A fortified monastery whose crypts hold both relics and prisoners."),
    faction: x("The Shadow Congregation", "A secret order of monster-hunters who answer to a hidden cardinal."),
    npc: e("Mother Ysolde", "Inquisitor", "Iron-willed and quietly terrified of how much she has come to know."),
    pc: e("Brother Anselm", "Warrior-monk", "A former soldier who took vows to atone and now hunts worse than men."),
    threat: x("The Whispering Heresy", "A cult that speaks with the voices of the damned and grows within the flock."),
    item: x("The Reliquary of Ash", "A blessed casket said to bind any spirit sealed within it.")
  },
  "Dark Ages: Mage": {
    premise: "Sorcerers of rival traditions duel over the fate of reality in a superstitious age.",
    location: x("The Tower of Astara", "A hidden chantry of astrolabes and forbidden libraries above a plague town."),
    faction: x("The Ninefold Circle", "An order of hermetic mages who guard their formulae as jealously as gold."),
    npc: e("Magister Corvinus", "Archmage", "Brilliant, paranoid, and convinced the stars themselves are turning."),
    pc: e("Ilsa", "Apprentice mage", "Gifted, impatient, and one bad decision from a very public burning."),
    threat: x("The Sundering", "A widening crack between the world and the divine that magic keeps worsening."),
    item: x("The Codex of Spheres", "A living grimoire whose pages rewrite themselves for the worthy — and the doomed.")
  },
  "Dark Ages: Vampire": {
    premise: "Immortal Cainites plot beneath a medieval domain as the Long Night deepens.",
    location: x("The Domain of Greywater", "A fog-bound river city ruled after dark by the undead."),
    faction: x("The Court of Ashes", "A brittle vampiric court where every courtesy hides a centuries-old debt."),
    npc: e("Prince Aldric the Grey", "Cainite prince", "Ancient, weary, and willing to burn the city to keep his throne."),
    pc: e("Mireille", "Fledgling Cainite", "Newly embraced, still half-mortal in her sympathies, and dangerous for it."),
    threat: x("The Long Night", "A rising tide of superstition and fire that hunts the sleeping dead."),
    item: x("The Charter of Caine", "A blood-sealed writ that names the rightful ruler of the domain.")
  },
  "Dark Ages: Werewolf": {
    premise: "Shapeshifter warriors defend a sacred wild against corruption in a dark age.",
    location: x("The Ashenmoon Sept", "A hidden caern in old-growth forest where the spirit-world bleeds through."),
    faction: x("The Greymane Pack", "A proud war-pack sworn to hold the last wild places against the blight."),
    npc: e("Elder Greymane", "Sept elder", "Scarred, slow to trust, and the only one who remembers the old treaties."),
    pc: e("Fenn", "Garou cub", "Newly Changed, full of fury, and still learning what the rage costs."),
    threat: x("The Creeping Blight", "A rot that fouls the land and turns spirits feral and hungry."),
    item: x("The Fetish of the First Howl", "A carved bone talisman that calls kin across any distance — once.")
  },
  Dragonbane: {
    premise: "Plucky heroes brave dungeons and dragons in a bright, deadly fairy-tale world.",
    location: x("Oakhollow", "A cozy village of thatched roofs and tall tales, one road from real danger."),
    faction: x("The Thistlebrook Guild", "A ragtag adventurers' guild that pays in coin, rumours, and hot stew."),
    npc: e("Torun", "Dwarf smith", "Grumbles constantly, forges beautifully, and secretly loves the company."),
    pc: e("Pib", "Mallard rogue", "A dapper, feathered thief with light fingers and an even lighter conscience."),
    threat: x("Cinderwing", "A young dragon whose raids have emptied three farmsteads and one guild treasury."),
    item: x("The Everfull Flask", "A dented flask that refills with whatever the holder needs most — usually soup.")
  },
  "Dungeons & Dragons": {
    premise: "A band of adventurers answers the call on a troubled frontier.",
    location: x("Redhollow", "A muddy frontier town clinging to a crossroads between forest and ruin."),
    faction: x("The Greenwarden Lodge", "Rangers and druids who keep the old roads open and the deep woods honest."),
    npc: e("Captain Marn", "Retired knight", "Runs the tavern, still wears the sword, and knows every threat for miles."),
    pc: e("Rilla Windmere", "Half-elf ranger", "A quiet tracker hunting the war-band that razed her home."),
    threat: x("The Cult of the Shattered Crown", "Zealots digging beneath the hills for a broken artifact of a fallen king."),
    item: x("The Sword of the First Dawn", "An old blade that kindles with light in the presence of true evil."),
    concept:
      "Dungeons & Dragons is heroic sword-and-sorcery fantasy. A party of diverse adventurers explores dungeons and wildlands, battles monsters, and shapes the fate of a frontier realm. Play swings between exploration, roleplay, and tactical d20 combat, with characters growing in power across levels. Themes: heroism, discovery, escalating danger, and treasure hard-won.",
    sheet: `## Character Sheet — D&D 5e

**Ancestry:** Half-Elf · **Class & Level:** Ranger 5 · **Background:** Outlander · **Alignment:** Neutral Good
**Proficiency Bonus:** +3 · **Passive Perception:** 15 · **Inspiration:** ( )

### Ability Scores

| Ability | Score | Mod | Save |
| --- | --- | --- | --- |
| Strength | 12 | +1 | +1 |
| Dexterity | 17 | +3 | +6 |
| Constitution | 14 | +2 | +2 |
| Intelligence | 10 | +0 | +0 |
| Wisdom | 15 | +2 | +5 |
| Charisma | 11 | +0 | +0 |

### Combat

| AC | Initiative | Speed | Max HP | Hit Dice |
| --- | --- | --- | --- | --- |
| 15 | +3 | 30 ft. | 44 | 5d10 |

**Death Saves:** Successes ( )( )( ) · Failures ( )( )( )

### Skills (proficient)

Perception +5 · Survival +5 · Stealth +6 · Nature +3 · Animal Handling +5 · Insight +5

### Attacks

| Weapon | Attack | Damage |
| --- | --- | --- |
| Longbow | +6 | 1d8+3 piercing |
| Shortsword | +6 | 1d6+3 piercing |

### Features & Traits

- **Ranger:** Favored Enemy, Natural Explorer, Fighting Style (Archery), Spellcasting, Primeval Awareness.
- **Half-Elf:** Darkvision, Fey Ancestry, Skill Versatility.

### Equipment & Languages

- Studded leather, longbow with 20 arrows, two shortswords, explorer's pack, hunting trap.
- **Languages:** Common, Elvish, Sylvan.`,
    lists: [
      { title: "Classes", items: ["Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard", "Artificer"] },
      { title: "Core Ancestries", items: ["Human", "Elf", "Dwarf", "Halfling", "Dragonborn", "Gnome", "Half-Elf", "Half-Orc", "Tiefling"] },
      { title: "Conditions", items: ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious", "Exhaustion"] },
      { title: "Damage Types", items: ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"] }
    ]
  },
  "Fabula Ultima": {
    premise: "Bright-hearted heroes fight a JRPG-style tale of crystals, airships, and a fallen king.",
    location: x("Lumen", "A town grown around a humming skycrystal, all bells, gears, and hope."),
    faction: x("The Cogwork Guild", "Inventors and airship-wrights who believe any problem yields to a good machine."),
    npc: e("Captain Vespera", "Airship captain", "Reckless, generous, and one storm away from her greatest story."),
    pc: e("Aster", "Spellblade", "A young duelist channeling elemental magic through a family-heirloom blade."),
    threat: x("The Fallen King Umbra", "A once-beloved ruler corrupted by a dying crystal, now unmaking the world."),
    item: x("The Aether Shard", "A sliver of living crystal that answers to the courage of whoever bears it.")
  },
  "Mörk Borg": {
    premise: "Doomed wretches scavenge a dying world as prophesied miseries unfold.",
    location: x("Sallow", "An ash-choked town of grey mud and greyer prayers, waiting for the end."),
    faction: x("The Heretical Priesthood", "Fanatics who preach the world's death as a mercy and hasten it gladly."),
    npc: e("Vsen", "Plague-prophet", "Rings a cracked bell and screams the next misery to anyone too slow to leave."),
    pc: e("Grit", "Wretched scum", "A knife, a grudge, and just enough luck to still be breathing."),
    threat: x("The Seventh Misery", "A prophesied calamity that curdles the sky and the minds beneath it."),
    item: x("The Rust-Eaten Blade", "A ruined sword that cuts true exactly once before it crumbles.")
  },
  "Old-School Essentials": {
    premise: "Classic dungeon-delvers plunder a monster-haunted underworld for gold and glory.",
    location: x("The Moldering Keep", "A half-ruined border fort perched over stairs that go down forever."),
    faction: x("The Restwell Guild", "Fences, guides, and rope-sellers who profit from every doomed expedition."),
    npc: e("Old Castellan Voss", "Keep warden", "Sells maps of dubious accuracy and warns you not to go — for a fee."),
    pc: e("Dain", "Fighting-man", "Sturdy, plainspoken, and here strictly for the treasure."),
    threat: x("The Goblin Warren", "A sprawling nest in the keep's lower halls, better organized than it should be."),
    item: x("The Bag of Holding", "A humble sack that swallows a room's worth of loot — mind what else you drop in.")
  },
  Pathfinder: {
    premise: "Bold adventurers unravel an ancient conspiracy at a busy crossroads of the realm.",
    location: x("Havenreach", "A bustling coastal town of festivals, feuds, and inconvenient old ruins."),
    faction: x("The Wayfarers' Lodge", "Explorer-scholars who fund expeditions in exchange for what they dig up."),
    npc: e("Oracle Sabine", "Varisian oracle", "Reads fortunes that are always true and never quite what you wanted."),
    pc: e("Doran Vex", "Human wizard", "Ambitious evoker chasing a rune he glimpsed in a very bad dream."),
    threat: x("The Rune-Bound Giant", "A slumbering colossus a cult means to wake beneath the town."),
    item: x("The Wayfinder", "A brass compass that points not north, but toward the nearest unsolved mystery.")
  },
  Pendragon: {
    premise: "Knights pursue glory, love, and honour across a legendary Arthurian Britain.",
    location: x("Ambrose Manor", "A modest knightly holding of fields, feuds, and one very old hall."),
    faction: x("The Order of the Hawk", "A fellowship of knights sworn to defend the shire and outshine each other."),
    npc: e("Steward Cadoc", "Manor steward", "Keeps the accounts, the secrets, and a low opinion of hasty young knights."),
    pc: e("Sir Gareth", "Knight of Salisbury", "Earnest, brave, and desperate to prove his family's honour."),
    threat: x("The Saxon Incursion", "Raiders pressing the borders while the great lords bicker over precedence."),
    item: x("Ancestral Blade Dawnkeeper", "A knight's heirloom sword said to have never been drawn in a dishonourable cause.")
  },
  Reign: {
    premise: "Founders build a company — a guild, gang, or fledgling nation — against rising rivals.",
    location: x("The Free City of Heluso", "A crossroads city-state where every guild is one bad season from ruin."),
    faction: x("The Founders' Company", "The player-run organization: small, hungry, and full of promise."),
    npc: e("Rival Captain Isadora", "Company rival", "Runs the older, larger company and would love to buy — or bury — yours."),
    pc: e("Casimir", "Company founder", "A charismatic schemer who has bet everything on this venture."),
    threat: x("The Coming War", "A neighbouring power eyeing the city, and everyone in it, for the taking."),
    item: x("The Founding Charter", "A signed writ granting your company legal existence — and a target on its back.")
  },
  "Shadowdark RPG": {
    premise: "Torchbearers plumb a lethal dark where light is life and time is running out.",
    location: x("The Gloaming Deep", "A drowned labyrinth beneath a dead city, where the dark eats flame."),
    faction: x("The Torchbearers' Guild", "Guides and lamplighters who rent light at ruinous, life-saving prices."),
    npc: e("Mad Wizard Oleth", "Ruin-dweller", "Lives in the depths, trades cryptic help, and has forgotten his own name."),
    pc: e("Wick", "Thief", "Fast, quiet, and acutely aware that every torch is a countdown."),
    threat: x("The Hungry Dark", "A living blackness that snuffs light and swallows anyone it touches."),
    item: x("The Everburning Brand", "A torch that never dies — which is why three factions want to steal it.")
  },
  "Sword Chronicle": {
    premise: "Noble houses scheme, marry, and go to war over a contested succession.",
    location: x("Blackmyre Holdfast", "A grim keep on the marshes, ancestral seat of an ambitious minor house."),
    faction: x("House Vaelor", "The player house — proud, cash-poor, and one good marriage from greatness."),
    npc: e("Maester Corwin", "House maester", "Loyal counsel, keeper of secrets, and quietly playing his own long game."),
    pc: e("Lady Elyse Vaelor", "House heir", "Sharp-tongued heir balancing duty, ambition, and a dangerous betrothal."),
    threat: x("The War of Succession", "A dead king, three claimants, and every house forced to choose a side."),
    item: x("Winter's Tooth", "The house's ancestral blade — losing it would shame the line for generations.")
  },
  "The One Ring": {
    premise: "Wanderers brave the Wild as a long shadow lengthens over the North.",
    location: x("Stonebridge", "A weathered village of hardy folk at the last safe ford before the wilds."),
    faction: x("The Woodmen's Council", "Free folk of the forest who trust slowly and remember every debt."),
    npc: e("Haldric the Host", "Village elder", "Offers hearth and warning in equal measure to any traveller who'll listen."),
    pc: e("Brand of the Dale-lands", "Wandering adventurer", "A trader's son who took up a bow when the roads grew dark."),
    threat: x("The Shadow in the Wood", "A spreading dread that fouls the forest and stirs old, patient evils."),
    item: x("The Heirloom of the North", "An ancestral token that heartens the weary and marks its bearer as trustworthy.")
  },
  "Warhammer Fantasy Roleplay": {
    premise: "Ordinary folk stumble into grim intrigue and corruption in the crumbling Old World.",
    location: x("Grünburg", "A rotting river town of guild feuds, cheap ale, and things beneath the streets."),
    faction: x("The Purple Hand", "A hidden Chaos cult worming its way into the town's guilds and watch."),
    npc: e("Witch Hunter Kessler", "Templar of Sigmar", "Zealous, humourless, and not always wrong about who to burn."),
    pc: e("Otto", "Rat catcher", "Knows the sewers better than anyone — which is exactly the problem."),
    threat: x("The Skaven Below", "Ratmen tunnelling beneath Grünburg, whom the authorities insist do not exist."),
    item: x("Sigmar's Blessed Hammer", "A warrior-priest's relic that smites the unnatural and terrifies the corrupt.")
  },

  // ------------------------------- Modern --------------------------------
  "Call of Cthulhu": {
    premise: "Investigators in the 1920s uncover cosmic horror beneath a quiet town.",
    location: x("Ashwick", "A cramped New England harbour town of salt fog, old money, and older secrets."),
    faction: x("The Brine Congregation", "A furtive coastal cult that gathers where the tide comes in."),
    npc: e("Professor Elias Crane", "Antiquarian", "Nervous scholar who found something in the archives he can't unsee."),
    pc: e("Dr. Mara Finch", "Alienist", "A physician of the mind, about to meet things no diagnosis covers."),
    threat: x("The Thing Beneath the Harbour", "Something vast and patient stirs in the deep water off Ashwick."),
    item: x("The Ashwick Codex", "A water-stained tome whose reading rearranges the reader's certainties.")
  },
  "Candela Obscura": {
    premise: "A circle of investigators contains supernatural bleed in a gaslit city.",
    location: x("The Marrow Quarter", "A gaslamp district of narrow canals where the veil runs thin."),
    faction: x("Circle of the Guttering Flame", "The players' chapter of investigators, sworn to hold back the dark."),
    npc: e("The Lightkeeper", "Circle handler", "Assigns the cases, hides the worst files, and grieves every loss quietly."),
    pc: e("Iris Vane", "Face (investigator)", "A former stage magician who now debunks the fake to fight the real."),
    threat: x("The Bleed at Marrow Bridge", "A widening wound in reality leaking nightmares into the fog."),
    item: x("The Warding Candle", "A blessed flame that reveals — and briefly repels — what shouldn't be there.")
  },
  "Changeling: The Dreaming": {
    premise: "Modern faerie souls chase wonder while cold reason drains the world of magic.",
    location: x("The Glimmerloft", "A hidden freehold above a city bookshop, thick with music and glamour."),
    faction: x("The Seelie Court", "Idealist fae who cling to hope, honour, and the old chivalric dream."),
    npc: e("Duke Aurelian", "Sidhe noble", "Radiant, romantic, and slowly hardening under the weight of the mundane."),
    pc: e("Robin", "Commoner changeling", "A barista pooka whose small kindnesses keep a whole freehold aloft."),
    threat: x("The Grey Tide", "Banality made civic policy — rezoning, foreclosure, and forgetting."),
    item: x("The Dross Locket", "A trinket humming with stored Glamour, enough to spark one true miracle.")
  },
  "Delta Green": {
    premise: "Burned-out agents cover up the unnatural at unbearable personal cost.",
    location: x("Rural Route 9, Kettle County", "A nowhere stretch of farmland with a decommissioned government site."),
    faction: x("The Program", "The illegal network of agents who know, and wish they didn't."),
    npc: e("Handler CROW", "Case officer", "Gives the orders from a burner phone and never says his real name."),
    pc: e("Agent REED", "Federal agent", "A by-the-book investigator whose book has no chapter for this."),
    threat: x("The Kettle County Incident", "An unnatural incursion the Program needs buried before dawn."),
    item: x("The Green Box", "A dead agent's cache of evidence, weapons, and one very dangerous file.")
  },
  "Demon: The Fallen": {
    premise: "Fallen angels reawaken in the modern world, torn between wrath and redemption.",
    location: x("The Rust District", "A dying industrial quarter where the faithless outnumber the streetlights."),
    faction: x("The Luciferan Circle", "Fallen who still believe their rebellion was righteous — and unfinished."),
    npc: e("Thomas Pike", "Mortal thrall", "Bound by a pact, adoring and terrified of the thing wearing his friend."),
    pc: e("Azrael-in-Marcus", "Fallen in a host", "An angel of death inhabiting a paramedic, hoarding scraps of faith to survive."),
    threat: x("The Earthbound", "An ancient fallen, buried and worshipped, waking beneath the city."),
    item: x("The Reliquary of Faith", "A vessel storing human devotion — sustenance and temptation both.")
  },
  "Hunter: The Reckoning": {
    premise: "Ordinary people, suddenly able to see monsters, decide what to do about it.",
    location: x("Maple Court", "A tired suburb where too many neighbours have gone missing too quietly."),
    faction: x("The Maple Court Cell", "The players' scratch team of imbued hunters, armed mostly with resolve."),
    npc: e("The Messenger", "Imbued visionary", "Speaks in warnings from the unseen source that Chose the hunters."),
    pc: e("Dana Reyes", "Imbued hunter", "A nurse who now recognizes what's been feeding on the night shift."),
    threat: x("The Nest on Elm Street", "A quiet vampire brood that has run the suburb for a decade."),
    item: x("The Edged Relic", "A blessed blade that bites the unnatural far deeper than steel should.")
  },
  "Mage: The Ascension": {
    premise: "Reality-benders wage a secret war over what humanity is allowed to believe.",
    location: x("The Loft Chantry", "A warehouse sanctum humming with impossible machines and hand-drawn sigils."),
    faction: x("The Traditions", "A fractious alliance of mystics defending wonder from grey conformity."),
    npc: e("Cypher", "Void Engineer defector", "Fled the Technocracy with its secrets and a target on her back."),
    pc: e("Jax", "Virtual Adept", "A hacker-mage who edits reality like unsecured code."),
    threat: x("The Technocracy", "An order enforcing a rational world, one erased miracle at a time."),
    item: x("The Talisman Drive", "An enchanted device storing a paradigm-shaking working — if it doesn't backfire.")
  },
  "Mummy: The Resurrection": {
    premise: "Deathless immortals pursue ancient purpose across recurring lifetimes.",
    location: x("The Antiquities Wing", "A museum gallery where the exhibits remember being alive."),
    faction: x("The Reborn Amenti", "A fellowship of resurrected immortals guarding secrets from before history."),
    npc: e("Dr. Halloway", "Grave-robbing dealer", "Sells relics to the wrong people and never asks what they're for."),
    pc: e("Nefer-Ka", "Returned mummy", "Awake again in a new age, bearing memories older than the city."),
    threat: x("The Devouring Cult", "Soul-eaters seeking the immortals' secret of return for themselves."),
    item: x("The Canopic Jar", "A sealed vessel holding a piece of a soul — and the key to a resurrection.")
  },
  "The King in Yellow RPG": {
    premise: "A cursed play spreads madness through those who read too far.",
    location: x("The Thespian Theatre", "A gilded, rotting playhouse whose final production was never officially staged."),
    faction: x("The Audience of the Sign", "Devotees who have seen the second act and smile too much."),
    npc: e("Gideon Marsh", "Haunted playwright", "Adapted the forbidden script and now can't stop hearing the applause."),
    pc: e("Cora Ellison", "Theatre critic", "Investigating a rash of 'suicides' among the play's cast and crew."),
    threat: x("The Second Act", "The point in the play past which nothing is ever the same."),
    item: x("The Yellow Manuscript", "A slim script bound in pale leather — reading it is the whole danger.")
  },
  "Twilight: 2000": {
    premise: "Stranded soldiers survive the aftermath of a war that shattered the world.",
    location: x("The Ruins of Kalisz", "A bombed-out town of rubble, refugees, and rationed hope."),
    faction: x("The Iron Column", "A brutal scavenger militia that taxes the roads in fuel and blood."),
    npc: e("Warlord Bortko", "Militia boss", "Controls the only working fuel depot for fifty kilometres."),
    pc: e("Sgt. Marta Kane", "Stranded soldier", "Holding her squad together on grit, memory, and dwindling ammo."),
    threat: x("The Long Winter", "Fuel, food, and medicine running out faster than anyone will admit."),
    item: x("The Running Truck", "A fuel-hauling 4x4 that actually starts — worth more than gold out here.")
  },
  "Vampire: The Masquerade": {
    premise: "Newly-embraced vampires navigate deadly undead politics in a modern city.",
    location: x("The City of Ashford by Night", "A rain-slick metropolis carved into invisible vampiric fiefdoms."),
    faction: x("The Prince's Court", "The Camarilla establishment that keeps the Masquerade — and its own power."),
    npc: e("Prince Valindra", "Camarilla prince", "Rules the city's undead with poise, patience, and utter ruthlessness."),
    pc: e("Nico Alvarez", "Neonate", "A freshly-embraced fledgling still clinging to a mortal conscience."),
    threat: x("The Second Inquisition", "Mortal agents who have learned vampires are real — and how to hunt them."),
    item: x("The Prince's Edict", "A signed decree of vampiric law; defying it is a death sentence.")
  },
  "Werewolf: The Apocalypse": {
    premise: "Shapeshifter warriors defend a wounded Earth against corporate corruption.",
    location: x("The Riverside Caern", "A sacred grove in a city park where the spirit-world still breathes."),
    faction: x("The Riverside Sept", "The players' pack and its allies, sworn to hold this last wild place."),
    npc: e("Elder Stone-Sings", "Theurge elder", "Speaks with spirits and despairs at how few of them remain."),
    pc: e("Ash Redhand", "Young Garou", "New to the rage, quick to fight, slow to see the bigger war."),
    threat: x("Vyre Corporation", "A polluting conglomerate that is far more than it appears — and far worse."),
    item: x("The Klaive Fetish", "A silver war-blade housing a bound spirit that hungers for the Wyrm's servants.")
  },
  "Wraith: The Oblivion": {
    premise: "The restless dead cling to memory in a decaying land beyond life.",
    location: x("The Shadowlands of Ironport", "A grey death-mirror of a harbour city, eroding into the Void."),
    faction: x("The Iron Legion", "A grim Hierarchy legion that polices the dead and conscripts the lost."),
    npc: e("The Ferryman", "Psychopomp", "Guides souls across the deadly waters — for a memory, or a favour."),
    pc: e("Vera Cole", "Newly dead wraith", "Struggling to matter to the living she can no longer touch."),
    threat: x("The Whisper of Oblivion", "The pull of nothingness, echoed by the dark Shadow inside every wraith."),
    item: x("The Fetter", "A cherished object that anchors a wraith to the living world — and to its pain.")
  },

  // ------------------------------- Sci-Fi --------------------------------
  "2300AD": {
    premise: "Explorers and colonists push humanity's frontier along the near-future stars.",
    location: x("Colony Aurelis", "A young settlement on a marginal world, one supply-drop from crisis."),
    faction: x("The Meridian Charter", "A corporate consortium that funds — and quietly owns — the colony."),
    npc: e("Administrator Voss", "Colony director", "Balances survival, quotas, and secrets she was paid not to share."),
    pc: e("Scout Devi Rao", "Frontier scout", "Maps the wilds beyond the perimeter and trusts her instruments more than people."),
    threat: x("The Biosphere Anomaly", "The planet's ecology is adapting to the colony — and it isn't friendly."),
    item: x("The Survey Drone 'Kite'", "A rugged recon drone carrying data three factions would kill to read.")
  },
  "Alien RPG": {
    premise: "Working-class crews face corporate greed and a perfect organism in cold space.",
    location: x("Halcyon Station", "A rust-streaked refinery station on the edge of regulated space."),
    faction: x("Halcyon Corp", "The company that owns the station, the air, and your contract."),
    npc: e("APOLLO Unit 7", "Synthetic", "Helpful, unfailingly calm, and following priorities you were never shown."),
    pc: e("Diaz", "Colonial marine", "Sent to 'secure an asset' with a mission briefing full of holes."),
    threat: x("The Specimen", "Something the company recovered, quarantined, and absolutely lied about."),
    item: x("The Motion Tracker", "A handheld scanner whose steady ping is the only warning you'll get.")
  },
  Coriolis: {
    premise: "Traders and pilgrims chase fortune among stations in a mystical star cluster.",
    location: x("Kirmala Station", "A bustling bazaar-station where every deck smells of spice and diesel."),
    faction: x("The Merchant Consortium", "Powerful trade houses that treat cargo manifests as scripture."),
    npc: e("Icon-Priest Nadia", "Station cleric", "Blesses ships, reads omens, and knows which docks to avoid tonight."),
    pc: e("Rurik", "Free trader captain", "Owns half a ship, all its debts, and a nose for a risky payday."),
    threat: x("The Dark Between the Stars", "An old dread stirring in the deep, whispering to those who portal too often."),
    item: x("The Portal Key", "An ancient artifact that opens a jump-gate no chart admits exists.")
  },
  "Cyberpunk RED": {
    premise: "Edgerunners hustle to survive in a neon-drenched, corp-run megacity.",
    location: x("The Vault District", "A blackout-zone of squats, night markets, and rooftop gunfire."),
    faction: x("Ferrocybe", "A vicious cyber-gang running chop-shops and the local protection racket."),
    npc: e("Fixer 'Domino'", "Fixer", "Brokers the jobs, takes a cut, and always knows more than she tells."),
    pc: e("Static", "Netrunner", "Jacks into hostile systems from a beat-up van and a worse attitude."),
    threat: x("The Arasch Op", "A megacorp's deniable operation to erase a whole block — and its witnesses."),
    item: x("The Militech Deck", "A prototype cyberdeck hot enough to fry ICE — and get you killed for owning it.")
  },
  Mothership: {
    premise: "Blue-collar spacers face lethal horror and worse contracts in the dark.",
    location: x("The Derelict 'Cygnus'", "A drifting freighter, power flickering, airlocks sealed from the inside."),
    faction: x("Contractor Holdings", "The faceless company that hired you and priced your bonus below your life."),
    npc: e("MU/TH/R Node", "Ship android", "Speaks in policy and protocol while something moves in the vents."),
    pc: e("Kowalski", "Teamster", "A grease-stained hauler who just wants the salvage bonus and out."),
    threat: x("The Thing in the Hold", "A parasite that got aboard with the cargo and is no longer in the cargo."),
    item: x("The Jury-Rigged Cutter", "A plasma torch that opens sealed doors — loudly, and never quietly enough.")
  },
  Starfinder: {
    premise: "A diverse crew adventures across a magitech galaxy of stations and starships.",
    location: x("Waypoint Absalom", "A teeming hub-station where a thousand species trade, scheme, and party."),
    faction: x("The Vanguard Lodge", "Explorer-agents who chart the unknown and recover the dangerous."),
    npc: e("TX-9 'Tock'", "Android mechanic", "Keeps the docks running and collects favours like spare parts."),
    pc: e("Selara", "Lashunta envoy", "A silver-tongued diplomat who talks the crew into (and out of) trouble."),
    threat: x("The Swarm Signal", "A hive-mind incursion homing in on a relic hidden aboard the station."),
    item: x("The Magitech Core", "A humming artifact that powers a starship — or a very large explosion.")
  },
  Traveller: {
    premise: "Free traders and scouts seek fortune and trouble across a subsector of worlds.",
    location: x("Regina Downport", "A busy startown of cargo cranes, dive bars, and expiring visas."),
    faction: x("The Scout Service", "Surveyors and couriers who go first and file the paperwork later."),
    npc: e("Captain Halvorsen", "Free trader", "Owes three mortgages on one ship and always has 'one more job'."),
    pc: e("Renner", "Ex-scout", "Mustered out with piloting skills, a survey scanner, and wanderlust."),
    threat: x("The Border Dispute", "Two neighbouring worlds sliding toward a war that will close the trade lanes."),
    item: x("The Free Trader 'Beowulf'", "A patched-together merchant ship — home, livelihood, and constant headache.")
  },
  "Warhammer 40,000 Roleplay": {
    premise: "The Emperor's servants root out heresy in a vast, cruel, gothic galaxy.",
    location: x("Hive Solara", "A towering hive-city of a billion souls, ash, and whispered blasphemy."),
    faction: x("The Inquisitorial Retinue", "The players' warband, serving an Inquisitor's ruthless mandate."),
    npc: e("Inquisitor Thal", "Ordo agent", "Wields terrifying authority and trusts no one, least of all his own."),
    pc: e("Acolyte Vein", "Inquisitorial acolyte", "A hive-scum survivor elevated to service, expendable and knows it."),
    threat: x("The Cult of the Ashen Star", "A Chaos cult metastasizing through the hive's under-levels."),
    item: x("The Inquisitorial Rosette", "A badge of absolute authority — flashing it is power, and a death sentence.")
  },

  // ------------------------------- Generic -------------------------------
  "Fate Core": {
    premise: "Proactive, competent heroes drive a story defined by bold aspects.",
    location: x("The Crossroads", "A genre-flexible hub — port, station, or waystation — where trouble finds heroes."),
    faction: x("The Syndicate", "An organization whose aspect, 'We Own This Town', shapes every scene."),
    npc: e("Vaughn", "Broker", "Aspect: 'A Favour for Every Face.' Knows everyone, trusts no one."),
    pc: e("Sam Okoro", "The reformed rogue", "High concept: 'Ex-Thief With a Conscience.' Trouble: 'Old Debts Come Calling.'"),
    threat: x("The Looming Deal", "A dangerous bargain that will reshape the region if it closes."),
    item: x("The MacGuffin", "An aspected object — 'Everyone Wants It' — that drives the whole scenario.")
  },
  "Savage Worlds": {
    premise: "Fast, furious, pulp-flavoured heroes leap from one two-fisted set piece to the next.",
    location: x("Peril Point", "A rugged frontier outpost where the action never waits for permission."),
    faction: x("The Crimson Circle", "A pulp secret society scheming for a relic of impossible power."),
    npc: e("Rocky Malone", "Two-fisted ally", "A grinning brawler who's your best friend and worst bar tab."),
    pc: e("Ace Calloway", "Pulp hero", "A daring troubleshooter with a lucky coin and a knack for the impossible."),
    threat: x("Baron Vex", "A monologuing villain with henchmen, a doomsday scheme, and terrible aim."),
    item: x("The Lightning Gadget", "A crackling invention that does something amazing — usually at the worst moment.")
  },
  Custom: {
    premise: "A ready-made starter scenario you can reskin to any world you like.",
    location: x("Millhaven", "A small starting town at the edge of the map, where every campaign begins."),
    faction: x("The Wayfarers' Guild", "A local guild that posts the jobs, pays the coin, and knows the gossip."),
    npc: e("Mentor Alden", "Guild mentor", "The wise, weary guide who points new heroes toward their first quest."),
    pc: e("The Newcomer", "Sample hero", "A blank-slate protagonist ready to be made your own."),
    threat: x("The Rising Danger", "A vague, gathering menace waiting for you to give it a name and a face."),
    item: x("The Quest Token", "A mysterious object that kicks off the adventure the moment it's picked up.")
  }
};

/** The demo kit for a game, falling back to the generic Custom kit. */
export function demoKitFor(gameType: GameType): DemoKit {
  const base = DEMO_KITS[gameType] || DEMO_KITS.Custom;
  const research = demoResearchFor(gameType, {
    premise: base.premise,
    pcRole: base.pc.role,
    locationName: base.location.name,
    factionName: base.faction.name
  });
  return {
    ...base,
    concept: base.concept || research.concept,
    sheet: base.sheet || demoSheetMarkdown(gameType, research.sheetBrief),
    lists: [...(base.lists || []), ...research.lists],
    researchStatus: research.status,
    sheetBrief: research.sheetBrief
  };
}

/** Render a game's demo kit into a uniform set of cross-linked wiki pages. */
export function demoPagesFor(gameType: GameType): DemoPage[] {
  const kit = demoKitFor(gameType);
  const { location: loc, faction: fac, npc, pc, threat, item } = kit;
  const tag = "demo";

  const pages: DemoPage[] = [
    {
      slug: demoSlug(loc.name),
      name: loc.name,
      category: "location",
      visibility: "players",
      summary: kit.premise,
      tags: [tag, "location"],
      body: `# ${loc.name}\n\n> ${kit.premise}\n\n## Overview\n\n${loc.blurb}\n\n## Who You'll Meet Here\n\n- [[${npc.name}]] — ${npc.role}\n- [[${fac.name}]]\n\n## Threads\n\n- Rumors circle [[${threat.name}]].\n- More than one party covets the [[${item.name}]].\n\n_Demo content — edit or delete freely._\n`
    },
    {
      slug: demoSlug(fac.name),
      name: fac.name,
      category: "organization",
      visibility: "players",
      summary: fac.blurb,
      tags: [tag, "faction"],
      body: `# ${fac.name}\n\n> ${fac.blurb}\n\n## Goals\n\n- \n\n## Notable Members\n\n- [[${npc.name}]] — ${npc.role}\n\n## Reach\n\n- Operates out of [[${loc.name}]].\n\n## Complications\n\n- Entangled with [[${threat.name}]].\n\n_Demo content — edit or delete freely._\n`
    },
    {
      slug: demoSlug(npc.name),
      name: npc.name,
      category: "npc",
      visibility: "players",
      summary: `${npc.role}. ${npc.blurb}`,
      tags: [tag, "npc"],
      body: `# ${npc.name}\n\n> ${npc.role}\n\n## Public Face\n\n${npc.blurb}\n\n## Ties\n\n- Aligned with [[${fac.name}]].\n- Usually found at [[${loc.name}]].\n\n:::gm\nDemo secret: ${npc.name} knows more about [[${threat.name}]] than they admit.\n:::\n`
    },
    {
      slug: demoSlug(pc.name),
      name: pc.name,
      category: "character",
      visibility: "players",
      summary: `${pc.role}. A sample player character.`,
      tags: [tag, "pc"],
      body: `# ${pc.name}\n\n> ${pc.role} — a sample player character.\n\n## Concept\n\n${pc.blurb}\n\n## Hooks\n\n- Has unfinished business with [[${fac.name}]].\n- Is chasing the [[${item.name}]].\n- Crossed paths once with [[${npc.name}]].\n${kit.sheet ? `\n${kit.sheet}\n` : ""}\n_Demo player character — edit or delete freely._\n`
    },
    {
      slug: demoSlug(threat.name),
      name: threat.name,
      category: "lore",
      visibility: "gm",
      summary: threat.blurb,
      tags: [tag, "threat"],
      body: `# ${threat.name}\n\n> The looming danger of this demo.\n\n## What It Is\n\n${threat.blurb}\n\n## Signs & Portents\n\n- Felt most strongly at [[${loc.name}]].\n\n## The Stakes\n\n- [[${fac.name}]] may be complicit.\n- The [[${item.name}]] is somehow the key.\n\n:::gm\nDemo content — this page is GM-only. Edit or delete freely.\n:::\n`
    },
    {
      slug: demoSlug(item.name),
      name: item.name,
      category: "item",
      visibility: "players",
      summary: item.blurb,
      tags: [tag, "item"],
      body: `# ${item.name}\n\n> ${item.blurb}\n\n## Description\n\n${item.blurb}\n\n## Provenance\n\n- Coveted by [[${fac.name}]].\n- Last seen near [[${loc.name}]].\n\n_Demo content — edit or delete freely._\n`
    }
  ];

  // Optional researched primer: concept + reference lists for the system.
  if (kit.concept || (kit.lists && kit.lists.length)) {
    const listMd = (kit.lists || [])
      .map((l) => `## ${l.title}\n\n${l.items.map((i) => `- ${i}`).join("\n")}`)
      .join("\n\n");
    pages.push({
      slug: demoSlug(`${gameType} Primer`),
      name: `${gameType} — Player Primer`,
      category: "lore",
      visibility: "players",
      summary: kit.concept ? `${kit.concept.split(". ")[0]}.` : `Quick reference for ${gameType}.`,
      tags: [tag, "reference"],
      body: `# ${gameType} — Player Primer\n\n> A quick reference for this system: concept, and the lists you'll reach for most.\n\n## Concept\n\n${kit.concept || kit.premise}\n\n${listMd}\n\n_Demo content — edit or delete freely._\n`
    });
  }

  return pages;
}

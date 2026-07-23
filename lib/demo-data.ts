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
  /** True when `sheet` is a generated design brief (GM/dev-facing), not a real filled-in sheet. */
  sheetIsBrief?: boolean;
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
    item: x("The Cortex Key", "A brass-and-bone rod that briefly opens a spirit well — everyone wants it, no one should hold it."),
    sheet: `## Character Sheet

\`\`\`blades-sheet
name: Quill
alias: The Listening Girl
playbook: Whisper
heritage: Akoros
background: Labour
vice: Obligation
purveyor: A shrine she maintains for a ghost nobody else remembers
coin: 3
stash: 8
stress: 4
trauma:
  - haunted
harm:
  lesser:
    - "Rattled (-1d to Resolve)"
healing: 1
armor: Normal
actions:
  hunt: 0
  study: 2
  survey: 1
  tinker: 0
  finesse: 1
  prowl: 1
  skirmish: 0
  wreck: 0
  attune: 3
  command: 0
  consort: 1
  sway: 1
abilities:
  - "Compel — you can force a nearby ghost to obey a command."
  - "Ritual — you can perform experimental summoning and bindings."
friends:
  - name: Setarra (a demon)
    standing: "+1 close"
  - name: Madame Sévrin
    standing: "neutral"
  - name: Bell, a bluecoat
    standing: "-1 rival"
load: Normal (5)
items:
  - Fine spirit mask
  - Ghost key
  - Spirit bottles (2)
  - Documents
notes: Hears the city's dead constantly. Tells the crew it is a gift. It is not.
\`\`\``
  },
  "Burning Wheel": {
    premise: "Ambition and belief collide in a low-magic realm on the edge of civil war.",
    location: x("The Graymarch", "A contested borderland of stone keeps, muddy roads, and old grievances."),
    faction: x("The Iron Covenant", "A sworn brotherhood of knights bound by oaths older than the current king."),
    npc: e("Ser Aldous", "Oathbound knight", "Honourable to a fault, and quietly certain the crown has lost its way."),
    pc: e("Bram", "Hedge-priest", "A wandering cleric with a beggar's coat and a scholar's stubborn faith."),
    threat: x("The Succession", "Two claimants, one throne, and a war that will be paid for in villages."),
    item: x("The Broken Charter", "A torn founding document whose missing half could legitimize a rebellion."),
    sheet: `## Character Sheet

**Name:** Aldrick Stonewend
**Stock:** Man
**Lifepaths:** Born Villager → Conscript → Foot Soldier → Bandit

### Beliefs

1. *The Baron takes and takes; I will take back what he owes my village.*
2. *Wenna trusts me and I have not earned it — I will.*
3. *If it comes to blood, let it be mine and not the crew's.*

### Instincts

1. *Always check the road behind us.*
2. *Never draw first in a crowd.*
3. *When someone lies to me, say nothing and remember.*

### Traits

*Cynical* (Char) · *Thick Skinned* (Die) · *Bloody Minded* (Call-on)

### Stats

| Stat | Exponent | Stat | Exponent |
| --- | --- | --- | --- |
| Will | B4 | Power | B5 |
| Perception | B4 | Forte | B5 |
| Agility | B4 | Speed | B4 |

**Health:** B5 · **Steel:** B4 · **Reflexes:** B4 · **Mortal Wound:** B10
**Circles:** B2 · **Resources:** B1 · **Stride:** 7

### Skills

| Skill | Exponent | Skill | Exponent |
| --- | --- | --- | --- |
| Sword | B4 | Soldiering | B3 |
| Bow | B3 | Foraging | B2 |
| Brawling | B3 | Intimidation | B3 |
| Riding | B2 | Haggling | B2 |

### Artha

**Fate:** 2 · **Persona:** 1 · **Deeds:** 0

### Gear

Sword, gambeson, bow and a dozen arrows, a stolen signet he cannot sell.`
  },
  "Dark Ages: Fae": {
    premise: "Medieval changelings guard the Dreaming as cold Banality creeps across the land.",
    location: x("The Hollow of Thornwake", "A freehold hidden in a briar-choked barrow, warm with old glamour."),
    faction: x("The Court of Silver Thorns", "A prickly noble court that prizes beauty, oaths, and elaborate grudges."),
    npc: e("Lord Bramblefast", "Sidhe noble", "Gracious host, ruthless schemer, and utterly bound by his own promises."),
    pc: e("Pell", "Commoner changeling", "A miller's daughter who dreams too vividly and pays for it."),
    threat: x("The Banality Frost", "A creeping numbness that turns wonder to ash and freeholds to ruins."),
    item: x("The Dreaming Glass", "A cracked mirror that shows the fae truth beneath any mortal face."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: generic-wod
name: Pell
group: Commoner Changeling (Boggan)
road: Banality
nature: Caregiver
demeanor: Survivor
concept: Miller's daughter whose dreams refuse to stay asleep
chronicle: The Court of Silver Thorns
attributes:
  strength: 2
  dexterity: 3
  stamina: 3
  charisma: 3
  manipulation: 2
  appearance: 2
  perception: 4
  intelligence: 3
  wits: 3
abilities:
  - Alertness: 3
  - Empathy: 3
  - Crafts: 3
  - Etiquette: 1
  - Stealth: 2
  - Survival: 2
  - Enigmas: 2
  - Lore (Faerie): 2
powers:
  - name: "Primal (Cantrip)"
    score: 2
  - name: "Legerdemain (Cantrip)"
    score: 2
  - name: "Wayfare (Cantrip)"
    score: 1
backgrounds:
  - Holdings: 1
  - Mentor: 2
  - Remembrance: 2
virtues:
  conscience: 4
  self_control: 3
  courage: 2
willpower: 4
willpower_current: 4
merits:
  - Fae Eternity: 0
flaws:
  - Banality's Mark: 0
history:
  - "Saw the Silver Thorns' procession as a child and has been useless at ordinary life ever since."
notes: Feeds the freehold, mends what breaks, and is never once invited to sit at the high table.
\`\`\``
  },
  "Dark Ages: Inquisitor": {
    premise: "Church-sanctioned hunters root out the supernatural in a fearful medieval world.",
    location: x("The Cloister of Saint Aldhelm", "A fortified monastery whose crypts hold both relics and prisoners."),
    faction: x("The Shadow Congregation", "A secret order of monster-hunters who answer to a hidden cardinal."),
    npc: e("Mother Ysolde", "Inquisitor", "Iron-willed and quietly terrified of how much she has come to know."),
    pc: e("Brother Anselm", "Warrior-monk", "A former soldier who took vows to atone and now hunts worse than men."),
    threat: x("The Whispering Heresy", "A cult that speaks with the voices of the damned and grows within the flock."),
    item: x("The Reliquary of Ash", "A blessed casket said to bind any spirit sealed within it."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: generic-wod
name: Brother Anselm
group: The Shadow Congregation
road: Faith
nature: Penitent
demeanor: Judge
concept: Soldier who took vows to atone and found worse things than men
chronicle: The Shadow Congregation
attributes:
  strength: 4
  dexterity: 3
  stamina: 4
  charisma: 2
  manipulation: 2
  appearance: 2
  perception: 3
  intelligence: 3
  wits: 3
abilities:
  - Alertness: 3
  - Athletics: 2
  - Brawl: 2
  - Dodge: 2
  - Intimidation: 3
  - Melee: 4
  - Ride: 2
  - Stealth: 1
  - Investigation: 3
  - Occult: 2
  - Theology: 3
powers:
  - name: "True Faith"
    score: 3
    descriptions:
      - "Repel the unclean"
  - name: "Rite of Warding"
    score: 1
backgrounds:
  - Allies: 2
  - Influence (Church): 2
  - Resources: 1
virtues:
  conscience: 4
  self_control: 3
  courage: 4
willpower: 6
willpower_current: 5
merits:
  - Iron Will: 0
flaws:
  - Haunted by the Sack: 0
weapons:
  - name: Arming Sword
    damage: "Str+2 (lethal)"
  - name: Blessed Stake
    damage: "Str+1 (lethal)"
history:
  - "Took vows after a siege he will not describe. Mother Ysolde is the only one who has asked twice."
notes: Prays before violence and after it, and is no longer sure which prayer is honest.
\`\`\``
  },
  "Dark Ages: Mage": {
    premise: "Sorcerers of rival traditions duel over the fate of reality in a superstitious age.",
    location: x("The Tower of Astara", "A hidden chantry of astrolabes and forbidden libraries above a plague town."),
    faction: x("The Ninefold Circle", "An order of hermetic mages who guard their formulae as jealously as gold."),
    npc: e("Magister Corvinus", "Archmage", "Brilliant, paranoid, and convinced the stars themselves are turning."),
    pc: e("Ilsa", "Apprentice mage", "Gifted, impatient, and one bad decision from a very public burning."),
    threat: x("The Sundering", "A widening crack between the world and the divine that magic keeps worsening."),
    item: x("The Codex of Spheres", "A living grimoire whose pages rewrite themselves for the worthy — and the doomed."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: mage-ascension
name: Ilsa
tradition: Order of Hermes
essence: Dynamic
concept: Apprentice who reads faster than her master permits
chronicle: The Ninefold Circle
attributes:
  strength: 2
  dexterity: 3
  stamina: 2
  charisma: 3
  manipulation: 3
  appearance: 2
  perception: 4
  intelligence: 4
  wits: 3
abilities:
  - Alertness: 2
  - Awareness: 3
  - Subterfuge: 2
  - Stealth: 2
  - Crafts: 1
  - Academics: 3
  - Occult: 3
  - Linguistics: 2
  - Medicine: 1
spheres:
  - name: Forces
    score: 2
  - name: Correspondence
    score: 2
  - name: Prime
    score: 1
  - name: Matter
    score: 1
backgrounds:
  - Mentor: 3
  - Library: 2
  - Sanctum: 1
virtues:
  conscience: 3
  self_control: 2
  courage: 3
willpower: 5
willpower_current: 4
arete: 3
quintessence: 6
quintessence_current: 4
paradox: 2
resonance:
  - Impatient: 2
merits:
  - Prodigy: 0
flaws:
  - Overconfident: 0
history:
  - "Corrected Magister Corvinus's formula in front of the whole Circle. She was right. He has not forgiven it."
notes: One public working away from a very public burning, and she knows it.
\`\`\``
  },
  "Dark Ages: Vampire": {
    premise: "Immortal Cainites plot beneath a medieval domain as the Long Night deepens.",
    location: x("The Domain of Greywater", "A fog-bound river city ruled after dark by the undead."),
    faction: x("The Court of Ashes", "A brittle vampiric court where every courtesy hides a centuries-old debt."),
    npc: e("Prince Aldric the Grey", "Cainite prince", "Ancient, weary, and willing to burn the city to keep his throne."),
    pc: e("Mireille", "Fledgling Cainite", "Newly embraced, still half-mortal in her sympathies, and dangerous for it."),
    threat: x("The Long Night", "A rising tide of superstition and fire that hunts the sleeping dead."),
    item: x("The Charter of Caine", "A blood-sealed writ that names the rightful ruler of the domain."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: dark-ages-vampire
name: Mireille
clan: Toreador
generation: 11
sire: Lord Sauveterre
sect: Cainite Court of Ashes
road: Road of Humanity
nature: Caregiver
demeanor: Gallant
concept: Vintner's daughter Embraced for her voice, not her wits
chronicle: The Long Night
attributes:
  strength: 2
  dexterity: 3
  stamina: 2
  charisma: 4
  manipulation: 3
  appearance: 4
  perception: 3
  intelligence: 2
  wits: 2
abilities:
  - Alertness: 2
  - Empathy: 3
  - Expression: 3
  - Subterfuge: 2
  - Etiquette: 2
  - Melee: 1
  - Performance: 3
  - Ride: 1
  - Stealth: 1
  - Academics: 1
  - Seneschal: 1
disciplines:
  - name: Auspex
    score: 2
    descriptions:
      - "Heightened Senses"
      - "Aura Perception"
  - name: Presence
    score: 2
    descriptions:
      - "Awe"
  - name: Celerity
    score: 1
backgrounds:
  - Mentor: 2
  - Retainers: 1
  - Status: 1
virtues:
  conscience: 4
  self_control: 2
  courage: 3
willpower: 5
willpower_current: 4
blood: 12
blood_current: 7
humanity: 7
merits:
  - Beautiful: 0
flaws:
  - Sire's Resentment: 0
weapons:
  - name: Hidden Dagger
    damage: "Str+1 (lethal)"
history:
  - "Embraced at a harvest feast because Lord Sauveterre could not bear the thought of her voice ageing."
notes: Still sends coin to her mortal family through an intermediary who thinks she is a widow.
\`\`\``
  },
  "Dark Ages: Werewolf": {
    premise: "Shapeshifter warriors defend a sacred wild against corruption in a dark age.",
    location: x("The Ashenmoon Sept", "A hidden caern in old-growth forest where the spirit-world bleeds through."),
    faction: x("The Greymane Pack", "A proud war-pack sworn to hold the last wild places against the blight."),
    npc: e("Elder Greymane", "Sept elder", "Scarred, slow to trust, and the only one who remembers the old treaties."),
    pc: e("Fenn", "Garou cub", "Newly Changed, full of fury, and still learning what the rage costs."),
    threat: x("The Creeping Blight", "A rot that fouls the land and turns spirits feral and hungry."),
    item: x("The Fetish of the First Howl", "A carved bone talisman that calls kin across any distance — once."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: werewolf-apocalypse
name: Fenn
tribe: Fianna
rank: Cliath
auspice: Ahroun
breed: Homid
concept: Village smith's apprentice who Changed during a winter raid
chronicle: The Greymane Wild
attributes:
  strength: 4
  dexterity: 3
  stamina: 4
  charisma: 2
  manipulation: 1
  appearance: 2
  perception: 3
  intelligence: 2
  wits: 3
abilities:
  - Alertness: 2
  - Athletics: 3
  - Brawl: 3
  - Dodge: 2
  - Intimidation: 2
  - Primal-Urge: 3
  - Melee: 2
  - Survival: 3
  - Crafts: 2
  - Occult: 1
gifts:
  - name: "Razor Claws (Rank 1)"
    score: 1
  - name: "Persuasion (Rank 1)"
    score: 1
  - name: "Inspiration (Rank 1)"
    score: 1
backgrounds:
  - Kinfolk: 2
  - Pure Breed: 2
virtues:
  conscience: 3
  self_control: 1
  courage: 5
willpower: 4
willpower_current: 3
rage: 6
rage_current: 6
gnosis: 3
gnosis_current: 3
renown: 2
weapons:
  - name: Smith's Hammer
    damage: "Str+2 (bashing)"
  - name: Claws
    damage: "Str+1 (aggravated)"
history:
  - "Changed mid-raid with a hammer still in his hand; the pack found him afterward, shaking, surrounded."
notes: Elder Greymane keeps telling him to wait. Fenn has never once wanted to wait.
\`\`\``
  },
  Dragonbane: {
    premise: "Plucky heroes brave dungeons and dragons in a bright, deadly fairy-tale world.",
    location: x("Oakhollow", "A cozy village of thatched roofs and tall tales, one road from real danger."),
    faction: x("The Thistlebrook Guild", "A ragtag adventurers' guild that pays in coin, rumours, and hot stew."),
    npc: e("Torun", "Dwarf smith", "Grumbles constantly, forges beautifully, and secretly loves the company."),
    pc: e("Pib", "Mallard rogue", "A dapper, feathered thief with light fingers and an even lighter conscience."),
    threat: x("Cinderwing", "A young dragon whose raids have emptied three farmsteads and one guild treasury."),
    item: x("The Everfull Flask", "A dented flask that refills with whatever the holder needs most — usually soup."),
    sheet: `## Character Sheet

\`\`\`dragonbane-sheet
name: Pib
kin: Mallard
age: Young
profession: Thief
weakness: Cannot walk past an unattended purse without at least considering it
appearance: Dapper waistcoat, one bent tail feather, permanently innocent expression
attributes:
  str: 8
  con: 10
  agl: 16
  int: 13
  wil: 11
  cha: 14
conditions:
  exhausted: false
  sickly: false
  dazed: false
  angry: false
  scared: true
  disheartened: false
damage_bonus_str: "—"
damage_bonus_agl: D4
movement: 12
encumbrance_limit: 4
hp: 7
hp_max: 10
wp: 9
wp_max: 11
death_successes: 0
death_failures: 0
skills:
  acrobatics: 12
  awareness: 10
  bartering: 14
  beast_lore: 5
  bluffing: 16
  bushcraft: 5
  crafting: 4
  evade: 14
  healing: 5
  hunting_fishing: 8
  languages: 10
  myths_legends: 5
  performance: 7
  persuasion: 12
  riding: 8
  seamanship: 6
  sleight_of_hand: 18
  sneaking: 16
  spot_hidden: 13
  swimming: 12
weapon_skills_note: Knives is Pib's only trained weapon skill
skills_weapons:
  knives: 14
secondary_skills:
  - name: Pick Locks
    value: 15
abilities:
  - "Backstabbing — deal extra damage when striking an unaware target."
  - "Webbed Feet (Mallard) — swim without penalty, waddle with dignity."
gold: 2
silver: 14
copper: 31
armor: Padded jerkin
armor_rating: 1
helmet: None
weapons:
  - name: Dagger
    grip: 1H
    range: 2
    damage: D8
    durability: 8
    features: "Subtle"
  - name: Sling
    grip: 1H
    range: 20
    damage: D6
    durability: 6
    features: "Loading"
inventory:
  - Lockpicks
  - 10 metres of rope
  - Tinderbox
  - Half a pie, wrapped
memento: A playing card from a game he definitely cheated at
\`\`\``
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
    sheet: `## Character Sheet

\`\`\`dnd-sheet
system: dnd5e
name: Rilla Windmere
race: Half-Elf
class: Ranger
subclass: Hunter
level: 5
background: Outlander
alignment: Neutral Good
xp: 6500
inspiration: false
personality_traits: "Watches the treeline even indoors. Speaks little, and only when it matters."
ideals: "The wild does not forgive carelessness, and neither do I."
bonds: "The war-band that burned Thornwatch still rides. I will find them."
flaws: "I trust animals long before I trust people."
age: "27"
eyes: Grey
hair: Chestnut

ability_scores:
  str: 12
  dex: 17
  con: 14
  int: 10
  wis: 15
  cha: 11

saving_throw_proficiencies: [str, dex]
skill_proficiencies: [Perception, Survival, Stealth, Nature, Animal Handling, Insight]

ac: 15
speed: 30
hp_max: 44
hp_current: 44
hit_dice: "5d10"

attacks:
  - name: Longbow
    bonus: "+6"
    damage: "1d8+3 piercing"
  - name: Shortsword
    bonus: "+6"
    damage: "1d6+3 piercing"

spellcasting:
  ability: wis
  spell_save_dc: 13
  spell_attack: "+5"
  spells:
    - level: 1
      slots: 4
      list: [Hunter's Mark, Cure Wounds, Longstrider]
    - level: 2
      slots: 2
      list: [Pass without Trace, Spike Growth]

features:
  - Favored Enemy (Orcs)
  - Natural Explorer (Forest)
  - Fighting Style (Archery)
  - Primeval Awareness
  - Extra Attack
  - "Hunter: Colossus Slayer"
  - "Half-Elf: Darkvision, Fey Ancestry, Skill Versatility"
languages: [Common, Elvish, Sylvan]
equipment:
  - name: Studded leather armor
  - name: Longbow
  - name: Arrows
    quantity: 20
  - name: Shortsword
    quantity: 2
  - name: Explorer's pack
  - name: Hunting trap
coins:
  gp: 42
backstory: "Rilla tracked the war-band that razed Thornwatch for two winters before the trail went cold at Redhollow."
\`\`\``,
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
    item: x("The Aether Shard", "A sliver of living crystal that answers to the courage of whoever bears it."),
    sheet: `## Character Sheet

**Name:** Sera Vell
**Identity:** *The Last Apprentice of a Burned Academy*
**Theme:** Justice · **Origin:** Ashfall Quarter

### Attributes

| Attribute | Die |
| --- | --- |
| Dexterity | d8 |
| Insight | d10 |
| Might | d6 |
| Willpower | d10 |

**HP:** 34 / 42 · **MP:** 28 / 40 · **IP:** 5 / 6
**Defense:** 11 · **Magic Defense:** 13 · **Initiative:** +2

### Classes

- **Elementalist** (Lv 3) — Spellblade, Elemental Magic
- **Guardian** (Lv 2) — Fortress, Protect

### Bonds

- **Master Orin** — *Loyalty · Admiration* (2)
- **The Academy's Ashes** — *Mistrust · Inferiority* (2)
- **Kess, fellow survivor** — *Trust · Affection* (3)

### Spells

- **Flare** (MP 10) — ranged fire damage, may target multiple.
- **Barrier** (MP 15) — grant a creature resistance for one scene.
- **Aura** (MP 20) — imbue an ally's weapon with an element.

### Equipment

Apprentice's rod (magic, d8), academy robes (DEF +1), sealed letter never delivered.`
  },
  "Mörk Borg": {
    premise: "Doomed wretches scavenge a dying world as prophesied miseries unfold.",
    location: x("Sallow", "An ash-choked town of grey mud and greyer prayers, waiting for the end."),
    faction: x("The Heretical Priesthood", "Fanatics who preach the world's death as a mercy and hasten it gladly."),
    npc: e("Vsen", "Plague-prophet", "Rings a cracked bell and screams the next misery to anyone too slow to leave."),
    pc: e("Grit", "Wretched scum", "A knife, a grudge, and just enough luck to still be breathing."),
    threat: x("The Seventh Misery", "A prophesied calamity that curdles the sky and the minds beneath it."),
    item: x("The Rust-Eaten Blade", "A ruined sword that cuts true exactly once before it crumbles."),
    sheet: `## Character Sheet

\`\`\`osr-sheet
name: Grisha the Unclean
class: Heretical Priest
level: 1
abilities:
  agility: 1
  presence: 2
  strength: -1
  toughness: 0
hp: 6
hp_max: 8
armor_class: "Tier 1 (d2 protection)"
omens: 2
silver: 37
weapons:
  - name: Rusted Femur
    damage: d4
    notes: "Taken from something that still had a use for it"
talents:
  - "Unclean Scrolls — may carry and read two profane scrolls."
  - "Palms Open to the Filth — heal d4 by drinking something terrible."
gear:
  - Waterskin (brackish)
  - Rope, 10ft, fraying
  - A tooth that is not yours
  - Lantern and three hours of oil
notes: The world is ending and Grisha is, on balance, in favour.
\`\`\``
  },
  "Old-School Essentials": {
    premise: "Classic dungeon-delvers plunder a monster-haunted underworld for gold and glory.",
    location: x("The Moldering Keep", "A half-ruined border fort perched over stairs that go down forever."),
    faction: x("The Restwell Guild", "Fences, guides, and rope-sellers who profit from every doomed expedition."),
    npc: e("Old Castellan Voss", "Keep warden", "Sells maps of dubious accuracy and warns you not to go — for a fee."),
    pc: e("Dain", "Fighting-man", "Sturdy, plainspoken, and here strictly for the treasure."),
    threat: x("The Goblin Warren", "A sprawling nest in the keep's lower halls, better organized than it should be."),
    item: x("The Bag of Holding", "A humble sack that swallows a room's worth of loot — mind what else you drop in."),
    sheet: `## Character Sheet

\`\`\`osr-sheet
name: Brick Hollowell
class: Fighter
ancestry: Human
level: 2
xp: 2400
abilities:
  strength: 15
  intelligence: 9
  wisdom: 10
  dexterity: 12
  constitution: 14
  charisma: 8
hp: 9
hp_max: 13
armor_class: 4
saves:
  death_ray: 12
  magic_wands: 13
  paralysis: 14
  breath_attacks: 15
  spells: 16
gold: 118
weapons:
  - name: Longsword
    damage: d8
    notes: ""
  - name: Shortbow
    damage: d6
    notes: "Range 50/100/150"
talents:
  - "Fighter — attacks on the best table, may use any armour."
gear:
  - Chainmail and shield
  - Backpack, rations (5 days)
  - Torches (6), tinderbox
  - 50ft rope, iron spikes
notes: Two levels deep and already reconsidering the whole enterprise.
\`\`\``
  },
  Pathfinder: {
    premise: "Bold adventurers unravel an ancient conspiracy at a busy crossroads of the realm.",
    location: x("Havenreach", "A bustling coastal town of festivals, feuds, and inconvenient old ruins."),
    faction: x("The Wayfarers' Lodge", "Explorer-scholars who fund expeditions in exchange for what they dig up."),
    npc: e("Oracle Sabine", "Varisian oracle", "Reads fortunes that are always true and never quite what you wanted."),
    pc: e("Doran Vex", "Human wizard", "Ambitious evoker chasing a rune he glimpsed in a very bad dream."),
    threat: x("The Rune-Bound Giant", "A slumbering colossus a cult means to wake beneath the town."),
    item: x("The Wayfinder", "A brass compass that points not north, but toward the nearest unsolved mystery."),
    sheet: `## Character Sheet

\`\`\`dnd-sheet
system: pf2
name: Sister Yrsa Falk
ancestry: Dwarf
background: Emissary
class: Champion
level: 3
alignment: LG
deity: Torag
abilities:
  strength: 18
  dexterity: 12
  constitution: 16
  intelligence: 10
  wisdom: 14
  charisma: 14
ac: 21
hp: 34
hp_max: 45
speed: 20
perception_rank: E
saves:
  fortitude: E
  reflex: T
  will: E
skills:
  athletics: E
  diplomacy: T
  religion: T
  society: T
  medicine: T
attacks:
  - name: Warhammer
    bonus: "+11"
    damage: "1d8+4 B"
  - name: Steel shield (bash)
    bonus: "+11"
    damage: "1d4+4 B"
feats:
  - "Retributive Strike — punish an enemy that harms an ally in your aura."
  - "Shield Block"
  - "Dwarven Lore"
gear:
  - Splint mail and steel shield
  - Religious symbol of Torag
  - Repair kit
notes: Sent as an emissary and quietly certain it was to get her out of the way.
\`\`\``
  },
  Pendragon: {
    premise: "Knights pursue glory, love, and honour across a legendary Arthurian Britain.",
    location: x("Ambrose Manor", "A modest knightly holding of fields, feuds, and one very old hall."),
    faction: x("The Order of the Hawk", "A fellowship of knights sworn to defend the shire and outshine each other."),
    npc: e("Steward Cadoc", "Manor steward", "Keeps the accounts, the secrets, and a low opinion of hasty young knights."),
    pc: e("Sir Gareth", "Knight of Salisbury", "Earnest, brave, and desperate to prove his family's honour."),
    threat: x("The Saxon Incursion", "Raiders pressing the borders while the great lords bicker over precedence."),
    item: x("Ancestral Blade Dawnkeeper", "A knight's heirloom sword said to have never been drawn in a dishonourable cause."),
    sheet: `## Character Sheet

\`\`\`pendragon-sheet
name: Sir Gareth
homeland: Salisbury
lord: Earl Roderick
culture: Cymric
religion: British Christian
glory: 1240
honor: 12
characteristics:
  siz: 13
  dex: 12
  str: 14
  con: 14
  app: 13
hp: 27
hp_max: 27
major_wound: 14
healing_rate: 2
movement: 18
armor_total: 12
traits:
  chaste: 13
  energetic: 14
  forgiving: 9
  generous: 15
  honest: 16
  just: 13
  merciful: 12
  modest: 11
  prudent: 8
  spiritual: 12
  temperate: 12
  trusting: 13
  valorous: 16
passions:
  - name: Loyalty (Lord Roderick)
    value: 16
  - name: Love (Family)
    value: 15
  - name: Hospitality
    value: 13
  - name: Honour
    value: 15
combat_skills:
  battle: 12
  horsemanship: 14
  sword: 15
  charge: 12
  spear: 10
  brawling: 8
  bow: 6
skills:
  awareness: 8
  courtesy: 10
  first_aid: 8
  folklore: 6
  hunting: 9
  orate: 5
  recognize: 7
  religion: 6
  singing: 4
  stewardship: 5
attacks:
  - name: Sword (Dawnkeeper)
    value: 15
    damage: 4D6
  - name: Lance (charge)
    value: 12
    damage: 6D6
  - name: Dagger
    value: 8
    damage: 2D6
notes: Desperate to prove his family's honour, and young enough to mistake recklessness for valour.
\`\`\``
  },
  Reign: {
    premise: "Founders build a company — a guild, gang, or fledgling nation — against rising rivals.",
    location: x("The Free City of Heluso", "A crossroads city-state where every guild is one bad season from ruin."),
    faction: x("The Founders' Company", "The player-run organization: small, hungry, and full of promise."),
    npc: e("Rival Captain Isadora", "Company rival", "Runs the older, larger company and would love to buy — or bury — yours."),
    pc: e("Casimir", "Company founder", "A charismatic schemer who has bet everything on this venture."),
    threat: x("The Coming War", "A neighbouring power eyeing the city, and everyone in it, for the taking."),
    item: x("The Founding Charter", "A signed writ granting your company legal existence — and a target on its back."),
    sheet: `## Character Sheet

**Name:** Ilaya Sarn
**Role:** Company Negotiator · **Company:** The Ninth Ledger

### Stats & Skills (One Roll Engine)

Rolls are Stat + Skill in d10s; matching dice set the width and height.

| Stat | Rating | Key Skills |
| --- | --- | --- |
| Body | 2 | Endurance 1 |
| Coordination | 2 | Dodge 1 |
| Sense | 3 | Perceive 2, Scrutinize 3 |
| Mind | 4 | Knowledge (Trade) 3, Language 2 |
| Charm | 4 | Persuasion 4, Lie 3, Perform 1 |
| Command | 3 | Leadership 3, Interrogate 2 |

### Passions

- **Loyalty:** The Ninth Ledger, even when it is wrong.
- **Duty:** Never let a contract go unread.
- **Craving:** To be the one who writes the terms.

### Company Role

**Esteem:** 3 · **Territory:** 1 · **Might:** 2 · **Treasure:** 4
Ilaya's negotiations feed the Company's Treasure die directly.

### Notes

Reads every clause aloud. It is not a courtesy; it is a trap she is setting.`
  },
  "Shadowdark RPG": {
    premise: "Torchbearers plumb a lethal dark where light is life and time is running out.",
    location: x("The Gloaming Deep", "A drowned labyrinth beneath a dead city, where the dark eats flame."),
    faction: x("The Torchbearers' Guild", "Guides and lamplighters who rent light at ruinous, life-saving prices."),
    npc: e("Mad Wizard Oleth", "Ruin-dweller", "Lives in the depths, trades cryptic help, and has forgotten his own name."),
    pc: e("Wick", "Thief", "Fast, quiet, and acutely aware that every torch is a countdown."),
    threat: x("The Hungry Dark", "A living blackness that snuffs light and swallows anyone it touches."),
    item: x("The Everburning Brand", "A torch that never dies — which is why three factions want to steal it."),
    sheet: `## Character Sheet

\`\`\`osr-sheet
name: Wren
class: Thief
ancestry: Halfling
level: 1
xp: 3
abilities:
  strength: 9
  dexterity: 16
  constitution: 12
  intelligence: 11
  wisdom: 10
  charisma: 13
hp: 5
hp_max: 6
armor_class: 13
luck: 1
torches: 3
gold: 22
weapons:
  - name: Dagger
    damage: d4
    notes: "Thrown, near"
  - name: Shortbow
    damage: d4
    notes: "Far"
talents:
  - "Backstab — +1 damage die when attacking an unaware foe."
  - "Stealthy — twice per day, become invisible for three rounds."
gear:
  - Leather armour
  - Thieves' tools
  - Rope, 60ft
  - Torch x3 (one hour of real time each)
notes: Counts the torches obsessively. Everyone else has stopped teasing her about it.
\`\`\``
  },
  "Sword Chronicle": {
    premise: "Noble houses scheme, marry, and go to war over a contested succession.",
    location: x("Blackmyre Holdfast", "A grim keep on the marshes, ancestral seat of an ambitious minor house."),
    faction: x("House Vaelor", "The player house — proud, cash-poor, and one good marriage from greatness."),
    npc: e("Maester Corwin", "House maester", "Loyal counsel, keeper of secrets, and quietly playing his own long game."),
    pc: e("Lady Elyse Vaelor", "House heir", "Sharp-tongued heir balancing duty, ambition, and a dangerous betrothal."),
    threat: x("The War of Succession", "A dead king, three claimants, and every house forced to choose a side."),
    item: x("Winter's Tooth", "The house's ancestral blade — losing it would shame the line for generations."),
    sheet: `## Character Sheet

\`\`\`sword-chronicle-sheet
name: Lady Elyse Vaelor
age: 22
gender: Female
house: House Vaelor
motto: We Do Not Kneel
destiny: 4
destinySpent: 1
abilities:
  Awareness: 4
  Cunning: 4
  Deception: 3
  Persuasion: 4
  Status: 5
  Will: 4
  Knowledge: 3
  Fighting:
    rating: 3
    specialties: [Long Blades 1]
  Endurance: 3
  Agility: 3
  Athletics: 2
armor:
  name: Riding Leathers
  rating: 2
  penalty: 0
attacks:
  - name: Winter's Tooth (ancestral longsword)
    test: Fighting (Long Blades)
    dice: 3D + 1B
    damage: Agility + 3
    qualities: Vicious
qualities: [Blood of the Vaelors]
benefits:
  - Heir
  - Sworn Sword (her shield, Ser Domeric)
  - Silver Tongue
drawbacks:
  - Betrothed (to a rival house)
appearance:
  mannerisms: Never raises her voice; the quieter she gets, the more danger you are in.
  features: Vaelor grey eyes, a duelist's callused hands.
history: Raised to rule a house that cannot afford her ambitions — and betrothed to seal a peace she never agreed to.
\`\`\``
  },
  "The One Ring": {
    premise: "Wanderers brave the Wild as a long shadow lengthens over the North.",
    location: x("Stonebridge", "A weathered village of hardy folk at the last safe ford before the wilds."),
    faction: x("The Woodmen's Council", "Free folk of the forest who trust slowly and remember every debt."),
    npc: e("Haldric the Host", "Village elder", "Offers hearth and warning in equal measure to any traveller who'll listen."),
    pc: e("Brand of the Dale-lands", "Wandering adventurer", "A trader's son who took up a bow when the roads grew dark."),
    threat: x("The Shadow in the Wood", "A spreading dread that fouls the forest and stirs old, patient evils."),
    item: x("The Heirloom of the North", "An ancestral token that heartens the weary and marks its bearer as trustworthy."),
    sheet: `## Character Sheet

**Name:** Beran of the Beornings
**Culture:** Beorning
**Calling:** Wanderer
**Shadow Path:** Lure of Power

### Attributes

| Attribute | Rating | TN |
| --- | --- | --- |
| Strength | 7 | 13 |
| Heart | 4 | 16 |
| Wits | 3 | 17 |

**Endurance:** 24 / 28 · **Fatigue:** 9
**Hope:** 10 / 12 · **Shadow:** 3 (Dread)
**Parry:** 3 · **Armour:** 4d · **Headgear:** 2

### Valour & Wisdom

**Valour:** 2 — *Reward:* Close-fitting mail
**Wisdom:** 1 — *Virtue:* Beorning Skin-Coat

### Skills

| Skill | Rank | Skill | Rank |
| --- | --- | --- | --- |
| Awe | 2 | Craft | 1 |
| Athletics | 3 | Battle | 1 |
| Awareness | 2 | Lore | 0 |
| Explore | 3 | Insight | 1 |
| Hunting | 3 | Healing | 2 |
| Song | 1 | Courtesy | 0 |
| Riddle | 0 | Stealth | 2 |
| Travel | 3 | Enhearten | 1 |

### Combat Proficiencies

- **Axes** 2 — Great axe (Damage 7, Injury 18, Heavy)
- **Bows** 1 — Bow (Damage 5, Injury 14)

### Distinctive Features

*Bold* · *Generous* · *Wary*

### Rewards & Notes

Travels the Vales alone by choice. Tells himself it is by choice.`
  },
  "Warhammer Fantasy Roleplay": {
    premise: "Ordinary folk stumble into grim intrigue and corruption in the crumbling Old World.",
    location: x("Grünburg", "A rotting river town of guild feuds, cheap ale, and things beneath the streets."),
    faction: x("The Purple Hand", "A hidden Chaos cult worming its way into the town's guilds and watch."),
    npc: e("Witch Hunter Kessler", "Templar of Sigmar", "Zealous, humourless, and not always wrong about who to burn."),
    pc: e("Otto", "Rat catcher", "Knows the sewers better than anyone — which is exactly the problem."),
    threat: x("The Skaven Below", "Ratmen tunnelling beneath Grünburg, whom the authorities insist do not exist."),
    item: x("Sigmar's Blessed Hammer", "A warrior-priest's relic that smites the unnatural and terrifies the corrupt."),
    sheet: `## Character Sheet

\`\`\`warhammer-sheet
system: wfrp
name: Grizel Vantt
species: Human (Reiklander)
career: Witch Hunter
rank: Interrogator (Brass 3)
characteristics:
  ws: 44
  bs: 35
  s: 38
  t: 41
  i: 39
  ag: 36
  dex: 30
  int: 42
  wp: 48
  fel: 33
wounds: 9
wounds_max: 13
fate: 2
resilience: 3
advantage: 0
skills:
  intimidate: 55
  intuition: 49
  lore_witches: 52
  melee_basic: 54
  perception: 47
  ranged_blackpowder: 45
  religion: 40
talents:
  - "Menacing — +1 SL on Intimidate."
  - "Sharp — +1 SL on Perception."
  - "Read/Write"
weapons:
  - name: Rapier
    damage: "+SB 4"
    qualities: "Fast"
  - name: Pistol
    damage: "+9"
    qualities: "Damaging, Reload 2"
armor: Leather jack (1 AP body, arms)
trappings:
  - Warrant of investigation, sealed
  - Manacles and a brand
  - Copy of the Sigmarite catechism
  - Lantern, oil, and tinder
notes: Has burned four people. Is certain about three of them.
\`\`\``
  },

  // ------------------------------- Modern --------------------------------
  "Call of Cthulhu": {
    premise: "Investigators in the 1920s uncover cosmic horror beneath a quiet town.",
    location: x("Ashwick", "A cramped New England harbour town of salt fog, old money, and older secrets."),
    faction: x("The Brine Congregation", "A furtive coastal cult that gathers where the tide comes in."),
    npc: e("Professor Elias Crane", "Antiquarian", "Nervous scholar who found something in the archives he can't unsee."),
    pc: e("Dr. Mara Finch", "Alienist", "A physician of the mind, about to meet things no diagnosis covers."),
    threat: x("The Thing Beneath the Harbour", "Something vast and patient stirs in the deep water off Ashwick."),
    item: x("The Ashwick Codex", "A water-stained tome whose reading rearranges the reader's certainties."),
    sheet: `## Character Sheet

\`\`\`coc-sheet
name: Dr. Mara Finch
occupation: Alienist
era: 1920s Era Investigator
age: 38
residence: Ashwick, Massachusetts
birthplace: Providence, Rhode Island
characteristics:
  str: 45
  con: 60
  siz: 50
  dex: 55
  app: 60
  int: 75
  pow: 70
  edu: 85
hp: 9
hp_max: 11
mp: 14
mp_max: 14
sanity: 63
sanity_max: 99
luck: 55
move: 8
build: 0
damage_bonus: "0"
temporary_insanity: false
indefinite_insanity: false
major_wound: false
unconscious: false
dying: false
skills:
  psychoanalysis: 65
  psychology: 60
  medicine: 55
  first_aid: 45
  library_use: 70
  spot_hidden: 50
  listen: 45
  persuade: 50
  charm: 35
  occult: 15
  history: 30
  law: 20
  drive_auto: 30
  dodge: 27
  cthulhu_mythos: 3
weapons:
  - name: Brawl
    skill: "25%"
    damage: 1D3
    range: "—"
    ammo: "—"
  - name: .32 Revolver
    skill: "20%"
    damage: 1D8
    range: 15 yds
    ammo: 6
personal_description: Careful, soft-spoken, and never without a notebook.
ideology: The mind can be understood. It has to be. The alternative is unbearable.
significant_people: Professor Elias Crane, a colleague whose letters have turned strange.
meaningful_locations: The Ashwick asylum ward where she does her rounds at night.
treasured_possessions: Her father's fountain pen, refilled more often than replaced.
traits: Listens far longer than most people can stand to be listened to.
injuries_scars: None yet.
phobias_manias: None diagnosed. She is professionally aware of how that can change.
arcane_tomes: The Ashwick Codex — read once, briefly, and closed again.
encounters: None she is willing to write in a case file.
gear: Medical bag, notebook and pen, pocket torch, letters of introduction
\`\`\``
  },
  "Candela Obscura": {
    premise: "A circle of investigators contains supernatural bleed in a gaslit city.",
    location: x("The Marrow Quarter", "A gaslamp district of narrow canals where the veil runs thin."),
    faction: x("Circle of the Guttering Flame", "The players' chapter of investigators, sworn to hold back the dark."),
    npc: e("The Lightkeeper", "Circle handler", "Assigns the cases, hides the worst files, and grieves every loss quietly."),
    pc: e("Iris Vane", "Face (investigator)", "A former stage magician who now debunks the fake to fight the real."),
    threat: x("The Bleed at Marrow Bridge", "A widening wound in reality leaking nightmares into the fog."),
    item: x("The Warding Candle", "A blessed flame that reveals — and briefly repels — what shouldn't be there."),
    sheet: `## Character Sheet

**Name:** Dr. Wilhelmina Roe
**Role:** Face · **Style:** Lucky
**Circle:** The Ashcroft Chapter

### Actions

| Drive | Actions |
| --- | --- |
| **Physical** (Resistance 2) | Force 1 · Move 1 · Strike 0 · Control 1 |
| **Presence** (Resistance 3) | Sway 3 · Read 2 · Hide 0 · Focus 1 |
| **Quick** (Resistance 2) | Fix 0 · Rig 1 · Sneak 1 · Tinker 0 |
| **Intuition** (Resistance 3) | Study 3 · Survey 2 · Sense 1 · Discern 2 |

### Resistances & Marks

**Bleed:** 1 mark · **Brittle:** 0 · **Bent:** 2 marks
**Scars:** *"I no longer trust a locked door."*

### Gilded Die

Available — spend for an extra die on one roll per session.

### Abilities

- **A Way With Words** — take +1d when Swaying someone who wants to believe you.
- **Bedside Manner** — clear a teammate's Bleed mark between scenes.

### Items

Medical bag · Chapter credentials · A patient's letter she should have burned`
  },
  "Changeling: The Dreaming": {
    premise: "Modern faerie souls chase wonder while cold reason drains the world of magic.",
    location: x("The Glimmerloft", "A hidden freehold above a city bookshop, thick with music and glamour."),
    faction: x("The Seelie Court", "Idealist fae who cling to hope, honour, and the old chivalric dream."),
    npc: e("Duke Aurelian", "Sidhe noble", "Radiant, romantic, and slowly hardening under the weight of the mundane."),
    pc: e("Robin", "Commoner changeling", "A barista pooka whose small kindnesses keep a whole freehold aloft."),
    threat: x("The Grey Tide", "Banality made civic policy — rezoning, foreclosure, and forgetting."),
    item: x("The Dross Locket", "A trinket humming with stored Glamour, enough to spark one true miracle."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: generic-wod
name: Robin
group: Commoner Changeling (Pooka)
road: Banality
nature: Trickster
demeanor: Caregiver
concept: Barista whose small kindnesses hold a freehold together
chronicle: The Seelie Court
attributes:
  strength: 2
  dexterity: 3
  stamina: 2
  charisma: 4
  manipulation: 3
  appearance: 3
  perception: 3
  intelligence: 2
  wits: 4
abilities:
  - Alertness: 2
  - Empathy: 4
  - Expression: 3
  - Subterfuge: 3
  - Streetwise: 2
  - Drive: 1
  - Performance: 2
  - Enigmas: 2
  - Lore (Dreaming): 2
powers:
  - name: "Chicanery (Cantrip)"
    score: 2
  - name: "Wayfare (Cantrip)"
    score: 2
  - name: "Soothsay (Cantrip)"
    score: 1
backgrounds:
  - Contacts: 3
  - Holdings: 2
  - Dreamers: 2
virtues:
  conscience: 4
  self_control: 2
  courage: 3
willpower: 4
willpower_current: 4
merits:
  - Lucky: 0
flaws:
  - Compulsive Honesty (inverted - cannot lie outright): 0
history:
  - "Keeps a freehold alive on free refills, remembered names, and an uncanny sense of who is about to break."
notes: Everyone assumes the pooka is lying. Robin mostly isn't, which is far more useful.
\`\`\``
  },
  "Delta Green": {
    premise: "Burned-out agents cover up the unnatural at unbearable personal cost.",
    location: x("Rural Route 9, Kettle County", "A nowhere stretch of farmland with a decommissioned government site."),
    faction: x("The Program", "The illegal network of agents who know, and wish they didn't."),
    npc: e("Handler CROW", "Case officer", "Gives the orders from a burner phone and never says his real name."),
    pc: e("Agent REED", "Federal agent", "A by-the-book investigator whose book has no chapter for this."),
    threat: x("The Kettle County Incident", "An unnatural incursion the Program needs buried before dawn."),
    item: x("The Green Box", "A dead agent's cache of evidence, weapons, and one very dangerous file."),
    sheet: `## Character Sheet

\`\`\`delta-green-sheet
name: Agent REED
profession: Special Agent (FBI)
employer: Federal Bureau of Investigation
nationality: USA
statistics:
  str: 12
  con: 13
  dex: 12
  int: 15
  pow: 14
  cha: 11
hp: 13
hp_max: 13
wp: 14
wp_max: 14
san: 51
san_max: 70
breaking_point: 51
bonds:
  - name: Spouse (Dana)
    score: 11
  - name: Sister
    score: 11
  - name: Field Office Partner
    score: 10
motivations:
  - "Believes the record should be complete, even when it cannot be filed."
  - "Cannot leave a missing-person case open."
adaptation:
  violence: 1
  helplessness: 0
skills:
  alertness: 50
  athletics: 40
  bureaucracy: 50
  criminology: 60
  drive: 40
  firearms: 50
  first_aid: 30
  humint: 60
  law: 40
  occult: 10
  persuade: 40
  search: 60
  stealth: 30
  unarmed_combat: 40
  unnatural: 3
weapons:
  - name: Glock 17
    skill: "50%"
    damage: 1D10
    lethality: "—"
    ammo: 17
  - name: Combat Knife
    skill: "40%"
    damage: 1D4+2
    lethality: "—"
    ammo: "—"
armor: Kevlar vest (Armor 3)
notes: Has not told the Bureau what happened on Route 9. Has not told Dana either.
\`\`\``
  },
  "Demon: The Fallen": {
    premise: "Fallen angels reawaken in the modern world, torn between wrath and redemption.",
    location: x("The Rust District", "A dying industrial quarter where the faithless outnumber the streetlights."),
    faction: x("The Luciferan Circle", "Fallen who still believe their rebellion was righteous — and unfinished."),
    npc: e("Thomas Pike", "Mortal thrall", "Bound by a pact, adoring and terrified of the thing wearing his friend."),
    pc: e("Azrael-in-Marcus", "Fallen in a host", "An angel of death inhabiting a paramedic, hoarding scraps of faith to survive."),
    threat: x("The Earthbound", "An ancient fallen, buried and worshipped, waking beneath the city."),
    item: x("The Reliquary of Faith", "A vessel storing human devotion — sustenance and temptation both."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: generic-wod
name: Azrael-in-Marcus
group: Devourer (Fallen)
road: Torment
nature: Judge
demeanor: Caregiver
concept: Angel of death riding a paramedic, hoarding scraps of faith
chronicle: The Luciferan Circle
attributes:
  strength: 3
  dexterity: 3
  stamina: 3
  charisma: 3
  manipulation: 3
  appearance: 2
  perception: 4
  intelligence: 3
  wits: 3
abilities:
  - Alertness: 3
  - Athletics: 2
  - Empathy: 3
  - Intimidation: 2
  - Drive: 2
  - Medicine: 4
  - Investigation: 2
  - Occult: 2
  - Science: 1
powers:
  - name: "Lore of the Flesh"
    score: 3
    descriptions:
      - "Mend the wounded"
  - name: "Lore of Death"
    score: 2
  - name: "Lore of the Celestials"
    score: 1
backgrounds:
  - Contacts: 2
  - Resources: 1
  - Thralls: 2
virtues:
  conscience: 3
  self_control: 3
  courage: 4
willpower: 6
willpower_current: 5
faith: 4
torment: 4
history:
  - "Fell for pity, was bound for millennia, and woke inside a man who was already dying on the job."
notes: Saves more lives than the host ever did. Cannot say whether that is atonement or appetite.
\`\`\``
  },
  "Hunter: The Reckoning": {
    premise: "Ordinary people, suddenly able to see monsters, decide what to do about it.",
    location: x("Maple Court", "A tired suburb where too many neighbours have gone missing too quietly."),
    faction: x("The Maple Court Cell", "The players' scratch team of imbued hunters, armed mostly with resolve."),
    npc: e("The Messenger", "Imbued visionary", "Speaks in warnings from the unseen source that Chose the hunters."),
    pc: e("Dana Reyes", "Imbued hunter", "A nurse who now recognizes what's been feeding on the night shift."),
    threat: x("The Nest on Elm Street", "A quiet vampire brood that has run the suburb for a decade."),
    item: x("The Edged Relic", "A blessed blade that bites the unnatural far deeper than steel should."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: generic-wod
name: Dana Reyes
group: Defender (Imbued)
road: Conviction
nature: Caregiver
demeanor: Bravo
concept: Night-shift nurse who finally saw what was feeding
chronicle: The Maple Court Cell
attributes:
  strength: 2
  dexterity: 3
  stamina: 3
  charisma: 3
  manipulation: 2
  appearance: 2
  perception: 4
  intelligence: 3
  wits: 4
abilities:
  - Alertness: 4
  - Athletics: 2
  - Dodge: 3
  - Empathy: 3
  - Intimidation: 1
  - Drive: 2
  - Firearms: 1
  - Medicine: 4
  - Investigation: 3
  - Occult: 1
powers:
  - name: "Ward (Defense)"
    score: 2
  - name: "Rejuvenate (Defense)"
    score: 2
  - name: "Burden (Defense)"
    score: 1
backgrounds:
  - Allies: 2
  - Contacts: 2
  - Resources: 1
virtues:
  conscience: 5
  self_control: 3
  courage: 3
willpower: 5
willpower_current: 4
conviction: 4
merits:
  - Calm Heart: 0
flaws:
  - Cannot Walk Away: 0
weapons:
  - name: Trauma Shears
    damage: "Str+1 (lethal)"
history:
  - "Watched a patient's chart stop making sense, then watched the visitor who kept coming back at 3 a.m."
notes: Still clocks in. Still charts everything. The Messenger says that is exactly why she was Chosen.
\`\`\``
  },
  "Mage: The Ascension": {
    premise: "Reality-benders wage a secret war over what humanity is allowed to believe.",
    location: x("The Loft Chantry", "A warehouse sanctum humming with impossible machines and hand-drawn sigils."),
    faction: x("The Traditions", "A fractious alliance of mystics defending wonder from grey conformity."),
    npc: e("Cypher", "Void Engineer defector", "Fled the Technocracy with its secrets and a target on her back."),
    pc: e("Jax", "Virtual Adept", "A hacker-mage who edits reality like unsecured code."),
    threat: x("The Technocracy", "An order enforcing a rational world, one erased miracle at a time."),
    item: x("The Talisman Drive", "An enchanted device storing a paradigm-shaking working — if it doesn't backfire."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: mage-ascension
name: Jax
tradition: Virtual Adepts
affiliation: The Traditions
essence: Dynamic
nature: Visionary
demeanor: Rebel
concept: Hacker who found the source code of reality and started committing patches
chronicle: The Loft Chantry
attributes:
  strength: 2
  dexterity: 3
  stamina: 2
  charisma: 3
  manipulation: 3
  appearance: 2
  perception: 3
  intelligence: 4
  wits: 3
abilities:
  - Alertness: 2
  - Awareness: 2
  - Dodge: 2
  - Subterfuge: 2
  - Drive: 1
  - Technology: 4
  - Academics: 2
  - Computer: 4
  - Enigmas: 2
  - Investigation: 2
  - Occult: 2
  - Science: 3
spheres:
  - name: Correspondence
    score: 3
  - name: Forces
    score: 2
  - name: Mind
    score: 2
  - name: Data
    score: 3
  - name: Prime
    score: 1
backgrounds:
  - Arcane: 2
  - Node: 2
  - Library: 2
  - Contacts: 3
virtues:
  conscience: 3
  self_control: 2
  courage: 3
willpower: 5
willpower_current: 5
arete: 3
quintessence: 5
quintessence_current: 5
paradox: 0
focus:
  - Cybernetic ritual (code as incantation)
  - Belief that reality is an editable system
rotes:
  - name: Ping of Presence
    notes: "Correspondence 2 — sense anyone on the network"
  - name: Hotfix
    notes: "Forces 2, Prime 1 — reroute power around a lock"
notes: Talks to the Digital Web like it talks back. Sometimes it does.
\`\`\``
  },
  "Mummy: The Resurrection": {
    premise: "Deathless immortals pursue ancient purpose across recurring lifetimes.",
    location: x("The Antiquities Wing", "A museum gallery where the exhibits remember being alive."),
    faction: x("The Reborn Amenti", "A fellowship of resurrected immortals guarding secrets from before history."),
    npc: e("Dr. Halloway", "Grave-robbing dealer", "Sells relics to the wrong people and never asks what they're for."),
    pc: e("Nefer-Ka", "Returned mummy", "Awake again in a new age, bearing memories older than the city."),
    threat: x("The Devouring Cult", "Soul-eaters seeking the immortals' secret of return for themselves."),
    item: x("The Canopic Jar", "A sealed vessel holding a piece of a soul — and the key to a resurrection."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: generic-wod
name: Nefer-Ka
group: Reborn Amenti
road: Balance
nature: Architect
demeanor: Traditionalist
concept: Immortal awake in a century that has forgotten her language
chronicle: The Reborn Amenti
real_age: "3,400 years"
apparent_age: "Late thirties"
attributes:
  strength: 3
  dexterity: 3
  stamina: 4
  charisma: 3
  manipulation: 3
  appearance: 3
  perception: 3
  intelligence: 4
  wits: 3
abilities:
  - Alertness: 2
  - Empathy: 2
  - Expression: 2
  - Etiquette: 2
  - Melee: 2
  - Crafts: 3
  - Academics: 4
  - Linguistics: 4
  - Occult: 4
  - Medicine: 2
powers:
  - name: "Necromancy (Hekau)"
    score: 3
  - name: "Alchemy (Hekau)"
    score: 2
  - name: "Amulets (Hekau)"
    score: 2
backgrounds:
  - Memory: 4
  - Resources: 2
  - Allies: 1
virtues:
  conscience: 4
  self_control: 4
  courage: 3
willpower: 7
willpower_current: 6
balance: 6
sekhem: 5
history:
  - "Has died and returned enough times to treat this life as a chapter rather than an existence."
notes: Buys back her own grave goods from Dr. Halloway, politely, one relic at a time.
\`\`\``
  },
  "The King in Yellow RPG": {
    premise: "A cursed play spreads madness through those who read too far.",
    location: x("The Thespian Theatre", "A gilded, rotting playhouse whose final production was never officially staged."),
    faction: x("The Audience of the Sign", "Devotees who have seen the second act and smile too much."),
    npc: e("Gideon Marsh", "Haunted playwright", "Adapted the forbidden script and now can't stop hearing the applause."),
    pc: e("Cora Ellison", "Theatre critic", "Investigating a rash of 'suicides' among the play's cast and crew."),
    threat: x("The Second Act", "The point in the play past which nothing is ever the same."),
    item: x("The Yellow Manuscript", "A slim script bound in pale leather — reading it is the whole danger."),
    sheet: `## Character Sheet

**Name:** Amélie Duclos
**Occupation:** Theatre critic, *Le Réveil*
**Age:** 34 · **Residence:** Montmartre, Paris

### Characteristics

| Stat | Value | Half | Fifth |
| --- | --- | --- | --- |
| STR | 45 | 22 | 9 |
| CON | 55 | 27 | 11 |
| SIZ | 50 | 25 | 10 |
| DEX | 60 | 30 | 12 |
| APP | 65 | 32 | 13 |
| INT | 80 | 40 | 16 |
| POW | 60 | 30 | 12 |
| EDU | 75 | 37 | 15 |

**Hit Points:** 8 / 10 · **Magic Points:** 12 · **Sanity:** 54 / 99 · **Luck:** 50

### Skills

Art (Criticism) 70% · Library Use 65% · Persuade 55% · Psychology 45%
Spot Hidden 50% · Listen 45% · History 40% · Occult 20% · Language (French) 75%
Language (English) 40% · Dodge 30% · Stealth 25%

### The Play

**Performances attended:** 1 · **Act II read:** No
Each exposure to *The King in Yellow* demands a Sanity roll and offers knowledge no one should want.

### Backstory

**Ideology:** Art should disturb. She is about to learn the price of being right.
**Significant person:** Her editor, who assigned the review.
**Treasured possession:** A first-edition programme from the Paris premiere.`
  },
  "Twilight: 2000": {
    premise: "Stranded soldiers survive the aftermath of a war that shattered the world.",
    location: x("The Ruins of Kalisz", "A bombed-out town of rubble, refugees, and rationed hope."),
    faction: x("The Iron Column", "A brutal scavenger militia that taxes the roads in fuel and blood."),
    npc: e("Warlord Bortko", "Militia boss", "Controls the only working fuel depot for fifty kilometres."),
    pc: e("Sgt. Marta Kane", "Stranded soldier", "Holding her squad together on grit, memory, and dwindling ammo."),
    threat: x("The Long Winter", "Fuel, food, and medicine running out faster than anyone will admit."),
    item: x("The Running Truck", "A fuel-hauling 4x4 that actually starts — worth more than gold out here."),
    sheet: `## Character Sheet

**Name:** Sgt. Danil Kovach
**Nationality:** Polish · **Branch:** Mechanised Infantry
**Rank:** Sergeant · **Career terms:** 3

### Attributes

| Attribute | Die | Damage |
| --- | --- | --- |
| Strength | B (d10) | 3 |
| Agility | C (d8) | — |
| Intelligence | C (d8) | 2 (stress) |
| Empathy | C (d8) | — |

**Hit Capacity:** 3 / 5 · **Stress Capacity:** 2 / 4
**Coolness Under Fire:** C · **Radiation:** 2 rads

### Skills

| Skill | Die | Skill | Die |
| --- | --- | --- | --- |
| Close Combat | C | Ranged Combat | B |
| Heavy Weapons | D | Stamina | B |
| Driving | C | Mobility | C |
| Recon | C | Survival | C |
| Tech | D | Command | C |
| Medical Aid | D | Persuasion | D |

### Specialties

*Rifleman* · *Combat Awareness* · *Quartermaster*

### Gear & Ammunition

AKM (4 mags) · Entrenching tool · Radiation dosimeter · 2 days rations
**Encumbrance:** 8 / 10

### Notes

Has not seen his unit in nine weeks. Still wears the patch.`
  },
  "Vampire: The Masquerade": {
    premise: "Newly-embraced vampires navigate deadly undead politics in a modern city.",
    location: x("The City of Ashford by Night", "A rain-slick metropolis carved into invisible vampiric fiefdoms."),
    faction: x("The Prince's Court", "The Camarilla establishment that keeps the Masquerade — and its own power."),
    npc: e("Prince Valindra", "Camarilla prince", "Rules the city's undead with poise, patience, and utter ruthlessness."),
    pc: e("Nico Alvarez", "Neonate", "A freshly-embraced fledgling still clinging to a mortal conscience."),
    threat: x("The Second Inquisition", "Mortal agents who have learned vampires are real — and how to hunt them."),
    item: x("The Prince's Edict", "A signed decree of vampiric law; defying it is a death sentence."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: vampire-masquerade
name: Nico Alvarez
clan: Brujah
generation: 12
sire: Marisol
sect: Anarch
nature: Rebel
demeanor: Caregiver
concept: Community organizer who woke up dead and angry
chronicle: Ashford by Night
attributes:
  strength: 3
  dexterity: 3
  stamina: 3
  charisma: 3
  manipulation: 2
  appearance: 2
  perception: 2
  intelligence: 2
  wits: 3
abilities:
  - Alertness: 2
  - Brawl: 3
  - Dodge: 2
  - Empathy: 2
  - Intimidation: 2
  - Streetwise: 3
  - Subterfuge: 1
  - Drive: 1
  - Firearms: 1
  - Leadership: 2
  - Academics: 1
  - Politics: 2
disciplines:
  - name: Potence
    score: 2
    descriptions:
      - "Prowess"
  - name: Celerity
    score: 1
  - name: Presence
    score: 1
    descriptions:
      - "Awe"
backgrounds:
  - Allies: 2
  - Contacts: 2
  - Herd: 1
virtues:
  conscience: 4
  self_control: 2
  courage: 4
willpower: 5
willpower_current: 5
blood: 11
blood_current: 6
humanity: 7
merits:
  - Fifth-Generation Loyalist: 0
flaws:
  - Short Fuse: 0
weapons:
  - name: Fists
    damage: "Str (bashing)"
  - name: Tire Iron
    damage: "Str+2 (bashing)"
history:
  - "Embraced three months ago after a protest turned into a massacre he was never meant to survive."
notes: Still pays his mortal sister's rent. Still believes the living are worth protecting.
\`\`\``
  },
  "Werewolf: The Apocalypse": {
    premise: "Shapeshifter warriors defend a wounded Earth against corporate corruption.",
    location: x("The Riverside Caern", "A sacred grove in a city park where the spirit-world still breathes."),
    faction: x("The Riverside Sept", "The players' pack and its allies, sworn to hold this last wild place."),
    npc: e("Elder Stone-Sings", "Theurge elder", "Speaks with spirits and despairs at how few of them remain."),
    pc: e("Ash Redhand", "Young Garou", "New to the rage, quick to fight, slow to see the bigger war."),
    threat: x("Vyre Corporation", "A polluting conglomerate that is far more than it appears — and far worse."),
    item: x("The Klaive Fetish", "A silver war-blade housing a bound spirit that hungers for the Wyrm's servants."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: werewolf-apocalypse
name: Ash Redhand
tribe: Get of Fenris
rank: Cliath
auspice: Ahroun
breed: Homid
concept: Factory-town kid who Changed the night the river caught fire
chronicle: The Riverside Caern
attributes:
  strength: 4
  dexterity: 3
  stamina: 3
  charisma: 2
  manipulation: 2
  appearance: 2
  perception: 3
  intelligence: 2
  wits: 3
abilities:
  - Alertness: 2
  - Athletics: 2
  - Brawl: 3
  - Dodge: 2
  - Intimidation: 2
  - Primal-Urge: 2
  - Melee: 2
  - Survival: 2
  - Occult: 1
  - Rituals: 1
gifts:
  - name: "Razor Claws (Rank 1)"
    score: 1
  - name: "Falling Touch (Rank 1)"
    score: 1
  - name: "Master of Fire (Rank 1)"
    score: 1
backgrounds:
  - Kinfolk: 2
  - Fetish: 1
  - Pure Breed: 1
virtues:
  conscience: 3
  self_control: 2
  courage: 4
willpower: 4
willpower_current: 4
rage: 5
rage_current: 5
gnosis: 4
gnosis_current: 4
renown: 3
weapons:
  - name: Klaive (silver)
    damage: "Str+3 (aggravated)"
  - name: Claws
    damage: "Str+1 (aggravated)"
history:
  - "First Changed the night Vyre's runoff set the Riverside on fire; the pack found him standing in it, unburned."
notes: Quick to the rage, slow to trust the elders who keep telling him to wait.
\`\`\``
  },
  "Wraith: The Oblivion": {
    premise: "The restless dead cling to memory in a decaying land beyond life.",
    location: x("The Shadowlands of Ironport", "A grey death-mirror of a harbour city, eroding into the Void."),
    faction: x("The Iron Legion", "A grim Hierarchy legion that polices the dead and conscripts the lost."),
    npc: e("The Ferryman", "Psychopomp", "Guides souls across the deadly waters — for a memory, or a favour."),
    pc: e("Vera Cole", "Newly dead wraith", "Struggling to matter to the living she can no longer touch."),
    threat: x("The Whisper of Oblivion", "The pull of nothingness, echoed by the dark Shadow inside every wraith."),
    item: x("The Fetter", "A cherished object that anchors a wraith to the living world — and to its pain."),
    sheet: `## Character Sheet

\`\`\`wod-sheet
system: generic-wod
name: Vera Cole
group: The Iron Legion (Renegade sympathies)
road: Pathos
nature: Survivor
demeanor: Caregiver
concept: Newly dead, still trying to matter to the living
chronicle: The Shadowlands
attributes:
  strength: 2
  dexterity: 3
  stamina: 3
  charisma: 3
  manipulation: 2
  appearance: 3
  perception: 4
  intelligence: 3
  wits: 3
abilities:
  - Alertness: 3
  - Awareness: 3
  - Empathy: 3
  - Expression: 2
  - Subterfuge: 1
  - Stealth: 3
  - Investigation: 3
  - Occult: 2
  - Enigmas: 2
powers:
  - name: "Argos (Arcanos)"
    score: 2
  - name: "Keening (Arcanos)"
    score: 2
  - name: "Embody (Arcanos)"
    score: 1
backgrounds:
  - Memoriam: 3
  - Haunt: 2
  - Contacts: 1
virtues:
  conscience: 4
  self_control: 2
  courage: 3
willpower: 5
willpower_current: 3
pathos: 5
pathos_current: 3
corpus: 8
angst: 3
history:
  - "Died in an ordinary accident and has spent every night since trying to move one object in her sister's kitchen."
notes: Her Shadow whispers that being forgotten would hurt less. It is not entirely wrong.
\`\`\``
  },

  // ------------------------------- Sci-Fi --------------------------------
  "2300AD": {
    premise: "Explorers and colonists push humanity's frontier along the near-future stars.",
    location: x("Colony Aurelis", "A young settlement on a marginal world, one supply-drop from crisis."),
    faction: x("The Meridian Charter", "A corporate consortium that funds — and quietly owns — the colony."),
    npc: e("Administrator Voss", "Colony director", "Balances survival, quotas, and secrets she was paid not to share."),
    pc: e("Scout Devi Rao", "Frontier scout", "Maps the wilds beyond the perimeter and trusts her instruments more than people."),
    threat: x("The Biosphere Anomaly", "The planet's ecology is adapting to the colony — and it isn't friendly."),
    item: x("The Survey Drone 'Kite'", "A rugged recon drone carrying data three factions would kill to read."),
    sheet: `## Character Sheet

**Name:** Scout Devi Rao
**Career:** Colonial Survey Service (4 terms) · **Nationality:** Manchurian Commonwealth
**Homeworld:** Aurelis, near-frontier

### Characteristics

| Stat | Value | Mod |
| --- | --- | --- |
| STR | 8 | 0 |
| DEX | 11 | +1 |
| END | 10 | +1 |
| INT | 12 | +2 |
| EDU | 10 | +1 |
| SOC | 6 | -1 |

**Hits:** 18 / 18 · **Armour:** 4 (survey suit)

### Skills

Survey 3 · Recon 2 · Navigation 2 · Vacc Suit 2 · Sensors 2
Science (Planetology) 2 · Pilot (Small Craft) 1 · Comms 1 · Medic 1
Gun Combat (Slug) 1 · Survival 2 · Athletics (Dexterity) 1

### Equipment

Survey scanner · Core sampler · Vacc suit (patched twice) · Emergency beacon
Sidearm, rarely loaded · Field notebook, handwritten · Drone control slate

### Notes

Trusts her instruments more than the people who read them.
Has named four landforms after colleagues who never wrote back.`
  },
  "Alien RPG": {
    premise: "Working-class crews face corporate greed and a perfect organism in cold space.",
    location: x("Halcyon Station", "A rust-streaked refinery station on the edge of regulated space."),
    faction: x("Halcyon Corp", "The company that owns the station, the air, and your contract."),
    npc: e("APOLLO Unit 7", "Synthetic", "Helpful, unfailingly calm, and following priorities you were never shown."),
    pc: e("Diaz", "Colonial marine", "Sent to 'secure an asset' with a mission briefing full of holes."),
    threat: x("The Specimen", "Something the company recovered, quarantined, and absolutely lied about."),
    item: x("The Motion Tracker", "A handheld scanner whose steady ping is the only warning you'll get."),
    sheet: `## Character Sheet

\`\`\`alien-sheet
name: Diaz
career: Colonial Marine
appearance: Buzzcut, burn scar along the jaw, sleeves always rolled
agenda: Get every one of your people off this rock — the contract said nothing about dying for cargo.
buddy: APOLLO Unit 7
rival: Halcyon Corp liaison
experience: 3
story_points: 1
health: 4
health_max: 4
stress: 2
radiation: 0
attributes:
  strength: 5
  agility: 4
  wits: 3
  empathy: 2
skills:
  close_combat: 2
  heavy_machinery: 1
  stamina: 3
  ranged_combat: 3
  mobility: 2
  piloting: 0
  observation: 2
  survival: 1
  comtech: 0
  command: 1
  manipulation: 0
  medical_aid: 1
talents:
  - "Banter — shrug off stress by cracking wise when it is least appropriate."
  - "Nerves of Steel — keep it together when the tracker starts pinging."
weapons:
  - name: M41A Pulse Rifle
    bonus: "+2"
    damage: 3
    range: Long
  - name: Combat Knife
    bonus: "+1"
    damage: 2
    range: Engaged
armor: M3 Personnel Armor
armor_rating: 6
conditions:
  starving: false
  dehydrated: false
  exhausted: true
  freezing: false
consumables:
  air: 4
  food: 3
  power: 2
  water: 3
gear:
  - Motion tracker
  - Cutting torch
  - Personal locator
  - Two spare magazines
signature_item: A creased unit photo with three faces scratched out
critical_injuries:
  - "Cracked rib (−1 to Close Combat until treated)"
notes: Has read the mission briefing four times. The holes have not filled themselves in.
\`\`\``
  },
  Coriolis: {
    premise: "Traders and pilgrims chase fortune among stations in a mystical star cluster.",
    location: x("Kirmala Station", "A bustling bazaar-station where every deck smells of spice and diesel."),
    faction: x("The Merchant Consortium", "Powerful trade houses that treat cargo manifests as scripture."),
    npc: e("Icon-Priest Nadia", "Station cleric", "Blesses ships, reads omens, and knows which docks to avoid tonight."),
    pc: e("Rurik", "Free trader captain", "Owns half a ship, all its debts, and a nose for a risky payday."),
    threat: x("The Dark Between the Stars", "An old dread stirring in the deep, whispering to those who portal too often."),
    item: x("The Portal Key", "An ancient artifact that opens a jump-gate no chart admits exists."),
    sheet: `## Character Sheet

\`\`\`coriolis-sheet
name: Rurik
concept: Free trader captain
background: Stationary
home_system: Kirmala
icon: The Merchant
reputation: 4
birr: 1200
hp: 8
hp_max: 10
mp: 7
mp_max: 10
radiation: 1
experience: 3
attributes:
  strength: 3
  agility: 4
  wits: 4
  empathy: 3
skills:
  force: 1
  melee: 1
  dexterity: 2
  infiltration: 0
  range: 2
  pilot: 3
  observation: 2
  survival: 1
  data_djinn: 1
  medicurgy: 0
  technology: 2
  science: 0
  manipulation: 3
  command: 2
  culture: 2
  mystic: 0
talents:
  - "Bargainer — reroll a failed Manipulation test when haggling."
  - "Void Hardened — ignore the first point of radiation each session."
  - "Licensed — your papers survive an inspection they should not."
personal_problem: Half his ship is owned by a creditor who has stopped sending polite reminders.
group_concept: A free-trader crew working the Kirmala run
group_talent: "Ship's Fortune — once per session, reroll a ship test."
critical_wounds: []
weapons:
  - name: Accelerator Pistol
    bonus: "+2"
    damage: 1
    crit: 3
    range: Short
  - name: Vibroknife
    bonus: "+1"
    damage: 1
    crit: 2
    range: Melee
armor: Light Padding
armor_value: 3
equipment:
  - Comm unit
  - Cargo manifest slate (partly forged)
  - Spice sample case
  - Icon amulet of the Merchant
notes: Blesses the ship before every run. Tells the crew it is tradition, not superstition.
\`\`\``
  },
  "Cyberpunk RED": {
    premise: "Edgerunners hustle to survive in a neon-drenched, corp-run megacity.",
    location: x("The Vault District", "A blackout-zone of squats, night markets, and rooftop gunfire."),
    faction: x("Ferrocybe", "A vicious cyber-gang running chop-shops and the local protection racket."),
    npc: e("Fixer 'Domino'", "Fixer", "Brokers the jobs, takes a cut, and always knows more than she tells."),
    pc: e("Static", "Netrunner", "Jacks into hostile systems from a beat-up van and a worse attitude."),
    threat: x("The Arasch Op", "A megacorp's deniable operation to erase a whole block — and its witnesses."),
    item: x("The Militech Deck", "A prototype cyberdeck hot enough to fry ICE — and get you killed for owning it."),
    sheet: `## Character Sheet

\`\`\`cyberpunk-sheet
handle: Static
role: Netrunner
role_ability: Interface 4
cash: 640
rep: 3
stats:
  int: 8
  ref: 6
  dex: 5
  tech: 7
  cool: 5
  will: 6
  luck: 6
  move: 5
  body: 4
  emp: 4
hp: 22
hp_max: 30
humanity: 34
humanity_max: 40
armor_sp: 7
armor: Light Armorjack (SP 11, worn thin)
skills:
  perception: 4
  concentration: 4
  athletics: 2
  stealth: 3
  education: 4
  cryptography: 6
  deduction: 4
  streetslang: 3
  tactics: 2
  handgun: 3
  evasion: 3
  brawling: 2
  conversation: 2
  streetwise: 4
  persuasion: 2
  basic_tech: 5
  cybertech: 5
  electronics_sectech: 6
  first_aid: 2
weapons:
  - name: Medium Pistol
    damage: 2d6
    rof: 2
    mag: 12
    notes: "Concealable"
  - name: Cyberdeck (7 slots)
    damage: "—"
    rof: "—"
    mag: "—"
    notes: "Interface 4, 3 attackers loaded"
cyberware:
  - name: Neural Link
    hl: 2
  - name: Interface Plugs
    hl: 2
  - name: Cybereye (Low Light)
    hl: 3
  - name: Chipware Socket
    hl: 2
gear:
  - Beat-up van (mobile netrun rig)
  - Agent (cracked)
  - Medscanner
  - Three burner shards
lifestyle: Kibble and a mattress in the van. Rent is technically zero.
notes: Owes Domino for the deck. Domino has not asked for payment yet, which is worse.
\`\`\``
  },
  "Dune: Adventures in the Imperium": {
    premise: "A minor House plays for survival among sietches, spice, and Landsraad knives.",
    location: x("Arrakeen Residency", "A wind-scoured House holding where every servant reports to someone else."),
    faction: x("House Reval", "The player House — newly granted, badly funded, and watched by everyone."),
    npc: e("Mentat Sorel", "House Mentat", "Calculates loyalties as precisely as budgets, and rarely likes the answers."),
    pc: e("Lady Ysera Reval", "House heir", "Trained by the Bene Gesserit, bound by duty, and quietly furious about both."),
    threat: x("The Harkonnen Audit", "A rival House's 'routine inspection' that everyone knows is a knife being sharpened."),
    item: x("The Water Ledger", "The true accounting of the House's water debt — ruinous if it ever leaves the vault."),
    sheet: `## Character Sheet

**Name:** Lady Ysera Reval
**House:** House Reval (Minor House, newly granted)
**Homeworld:** Arrakis — Arrakeen Residency
**Archetype:** Noble (Bene Gesserit training)
**Ambition:** See House Reval outlive the people who granted it.

### Skills

| Skill | Rating | Focuses |
| --- | --- | --- |
| Battle | 5 | — |
| Communicate | 8 | Court Intrigue, Voice |
| Discipline | 7 | Prana-Bindu Control |
| Move | 6 | Stillsuit Discipline |
| Understand | 7 | Observation, House Finance |

### Drives & Statements

| Drive | Rating | Statement |
| --- | --- | --- |
| Duty | 8 | "The House comes before the woman who wears its name." |
| Faith | 5 | "The Sisterhood taught me. It does not own me." |
| Justice | 6 | "Debts are paid — in the order I choose." |
| Power | 7 | "Better to be underestimated than unarmed." |
| Truth | 4 | "Some ledgers should never be read aloud." |

**Determination:** 2

### Talents

- **The Voice** — command obedience with a single spoken order.
- **Read the Room** — sense the shape of a negotiation before it begins.
- **Trained Observer** — notice the tell that betrays a lie.

### Assets

- Mentat Sorel (House Mentat, reluctant confidant)
- A modest but real spice allotment
- Bene Gesserit contacts who expect a favour someday

### Traits

- *Heir to a House That Cannot Afford Her*
- *Trained by the Sisterhood*
- *Watched by the Harkonnen Audit*`
  },
  Mothership: {
    premise: "Blue-collar spacers face lethal horror and worse contracts in the dark.",
    location: x("The Derelict 'Cygnus'", "A drifting freighter, power flickering, airlocks sealed from the inside."),
    faction: x("Contractor Holdings", "The faceless company that hired you and priced your bonus below your life."),
    npc: e("MU/TH/R Node", "Ship android", "Speaks in policy and protocol while something moves in the vents."),
    pc: e("Kowalski", "Teamster", "A grease-stained hauler who just wants the salvage bonus and out."),
    threat: x("The Thing in the Hold", "A parasite that got aboard with the cargo and is no longer in the cargo."),
    item: x("The Jury-Rigged Cutter", "A plasma torch that opens sealed doors — loudly, and never quietly enough."),
    sheet: `## Character Sheet

\`\`\`mothership-sheet
name: Kowalski
class: Teamster
pronouns: he/him
stats:
  strength: 35
  speed: 30
  intellect: 30
  combat: 25
saves:
  sanity: 30
  fear: 25
  body: 40
health: 14
health_max: 18
wounds: 1
wounds_max: 2
stress: 4
credits: 180
armor_points: 3
trained:
  - Industrial Equipment
  - Zero-G
  - Jury-Rigging
  - Rimwise
expert:
  - Mechanical Repair
master: []
trauma_response: "Once per session, may take Advantage on a Panic Check."
loadout:
  - Vaccsuit (patched twice)
  - Cutting torch
  - Magnetic boots
  - Salvage tags
conditions:
  - "Cracked helmet seal — Body save at Disadvantage in vacuum."
trinket: A child's drawing, laminated
patch: "I'M NOT PAID ENOUGH FOR THIS"
notes: Wants the salvage bonus and the next shuttle out, in that order.
\`\`\``
  },
  Starfinder: {
    premise: "A diverse crew adventures across a magitech galaxy of stations and starships.",
    location: x("Waypoint Absalom", "A teeming hub-station where a thousand species trade, scheme, and party."),
    faction: x("The Vanguard Lodge", "Explorer-agents who chart the unknown and recover the dangerous."),
    npc: e("TX-9 'Tock'", "Android mechanic", "Keeps the docks running and collects favours like spare parts."),
    pc: e("Selara", "Lashunta envoy", "A silver-tongued diplomat who talks the crew into (and out of) trouble."),
    threat: x("The Swarm Signal", "A hive-mind incursion homing in on a relic hidden aboard the station."),
    item: x("The Magitech Core", "A humming artifact that powers a starship — or a very large explosion."),
    sheet: `## Character Sheet

\`\`\`dnd-sheet
name: Tavik Oreth
ancestry: Lashunta
background: Icon
class: Technomancer
level: 4
alignment: CG
abilities:
  strength: 10
  dexterity: 14
  constitution: 12
  intelligence: 18
  wisdom: 12
  charisma: 14
ac: 17
hp: 22
hp_max: 30
speed: 30
saves:
  fortitude: "+3"
  reflex: "+6"
  will: "+5"
skills:
  computers: "+12"
  engineering: "+11"
  mysticism: "+8"
  piloting: "+9"
  culture: "+8"
attacks:
  - name: Tactical semi-auto pistol
    bonus: "+6"
    damage: "1d6+2 P"
  - name: Static arc pistol
    bonus: "+6"
    damage: "1d6+2 E"
feats:
  - "Spell Focus"
  - "Skill Synergy (Computers, Engineering)"
gear:
  - Second Skin armour
  - Datapad and hacking kit
  - Serum of healing (2)
notes: Famous on three stations for a broadcast he now wishes he had not made.
\`\`\``
  },
  Traveller: {
    premise: "Free traders and scouts seek fortune and trouble across a subsector of worlds.",
    location: x("Regina Downport", "A busy startown of cargo cranes, dive bars, and expiring visas."),
    faction: x("The Scout Service", "Surveyors and couriers who go first and file the paperwork later."),
    npc: e("Captain Halvorsen", "Free trader", "Owes three mortgages on one ship and always has 'one more job'."),
    pc: e("Renner", "Ex-scout", "Mustered out with piloting skills, a survey scanner, and wanderlust."),
    threat: x("The Border Dispute", "Two neighbouring worlds sliding toward a war that will close the trade lanes."),
    item: x("The Free Trader 'Beowulf'", "A patched-together merchant ship — home, livelihood, and constant headache."),
    sheet: `## Character Sheet

\`\`\`traveller-sheet
header:
  left: Scout Service
  center: Discharge File
  right: TAS-Regina
name: Renner
species: Human
age: 34
homeworld: Regina (A788899-C)
career: Scout
rank: Ex-Scout
dossier: Detached Duty — Survey & Courier
status: Active
characteristics:
  STR: 7
  DEX: 9
  END: 8
  INT: 10
  EDU: 9
  SOC: 6
skills:
  "Pilot (Small Craft)": 2
  "Astrogation": 1
  "Sensors": 2
  "Vacc Suit": 1
  "Gun Combat (Slug)": 1
  "Recon": 2
  "Survival": 1
  "Mechanic": 1
  "Comms": 1
weapons:
  Snub Pistol: 3D, Close, sidearm
armour:
  Vacc Suit: 6, patched
equipment:
  Survey Scanner: 1, mustering-out benefit
  Hand Computer: 1, loaded with subsector charts
holdings:
  Ship Share: one share in the Beowulf
people:
  Captain Halvorsen: former crewmate, still calls in favours
credits: 4200
notes: Detached-duty scout with a scanner, a grudge against paperwork, and nowhere he has to be.
\`\`\``
  },
  "Warhammer 40,000 Roleplay": {
    premise: "The Emperor's servants root out heresy in a vast, cruel, gothic galaxy.",
    location: x("Hive Solara", "A towering hive-city of a billion souls, ash, and whispered blasphemy."),
    faction: x("The Inquisitorial Retinue", "The players' warband, serving an Inquisitor's ruthless mandate."),
    npc: e("Inquisitor Thal", "Ordo agent", "Wields terrifying authority and trusts no one, least of all his own."),
    pc: e("Acolyte Vein", "Inquisitorial acolyte", "A hive-scum survivor elevated to service, expendable and knows it."),
    threat: x("The Cult of the Ashen Star", "A Chaos cult metastasizing through the hive's under-levels."),
    item: x("The Inquisitorial Rosette", "A badge of absolute authority — flashing it is power, and a death sentence."),
    sheet: `## Character Sheet

\`\`\`warhammer-sheet
system: 40k
name: Interrogator Vex Talleran
archetype: Acolyte (Imperial Scholar)
rank: Interrogator
characteristics:
  ws: 32
  bs: 38
  s: 30
  t: 34
  ag: 36
  int: 45
  per: 42
  wp: 40
  fel: 35
wounds: 8
wounds_max: 11
fate: 3
corruption: 6
insanity: 12
skills:
  awareness: 42
  common_lore_imperium: 45
  forbidden_lore_heresy: 35
  inquiry: 40
  logic: 45
  scholastic_lore_occult: 38
  scrutiny: 42
talents:
  - "Peer (Adeptus Administratum)"
  - "Sound Constitution"
  - "Melee Weapon Training (Primitive)"
weapons:
  - name: Laspistol
    damage: "1d10+2 E"
    qualities: "Reliable, Clip 15"
  - name: Mono-knife
    damage: "1d5+3 R"
    qualities: "Mono"
armor: Flak cloak (AP 3 body, arms)
trappings:
  - Inquisitorial rosette (borrowed, unauthorised)
  - Data-slate of forbidden citations
  - Vial of sacred unguent
notes: Reads what he is forbidden to read. Records what he is forbidden to record.
\`\`\``
  },

  // ------------------------------- Generic -------------------------------
  "Fate Core": {
    premise: "Proactive, competent heroes drive a story defined by bold aspects.",
    location: x("The Crossroads", "A genre-flexible hub — port, station, or waystation — where trouble finds heroes."),
    faction: x("The Syndicate", "An organization whose aspect, 'We Own This Town', shapes every scene."),
    npc: e("Vaughn", "Broker", "Aspect: 'A Favour for Every Face.' Knows everyone, trusts no one."),
    pc: e("Sam Okoro", "The reformed rogue", "High concept: 'Ex-Thief With a Conscience.' Trouble: 'Old Debts Come Calling.'"),
    threat: x("The Looming Deal", "A dangerous bargain that will reshape the region if it closes."),
    item: x("The MacGuffin", "An aspected object — 'Everyone Wants It' — that drives the whole scenario."),
    sheet: `## Character Sheet

\`\`\`fate-sheet
name: Sam Okoro
description: Lean, quick-handed, dressed a little better than the job requires
fate_points: 3
refresh: 3
aspects:
  high_concept: Ex-Thief With a Conscience
  trouble: Old Debts Come Calling
  other:
    - "I Know Every Door in The Crossroads"
    - "Vaughn Owes Me One (And Resents It)"
    - "Never Steal From Someone Who Can't Afford It"
skills:
  burglary: 5
  notice: 4
  contacts: 4
  athletics: 3
  deceive: 3
  rapport: 3
  stealth: 2
  will: 2
  investigate: 2
  fight: 1
  physique: 1
  resources: 1
stress:
  physical: 3
  physical_used: 1
  mental: 3
  mental_used: 0
consequences:
  mild: "Wrenched Shoulder"
stunts:
  - "Nimble Fingers — +2 to Burglary when picking a lock under time pressure."
  - "The Old Crew — once per session, declare that a Crossroads fixer owes Sam a favour."
  - "Casing the Joint — use Burglary instead of Notice to spot a building's weak point."
\`\`\``
  },
  "Savage Worlds": {
    premise: "Fast, furious, pulp-flavoured heroes leap from one two-fisted set piece to the next.",
    location: x("Peril Point", "A rugged frontier outpost where the action never waits for permission."),
    faction: x("The Crimson Circle", "A pulp secret society scheming for a relic of impossible power."),
    npc: e("Rocky Malone", "Two-fisted ally", "A grinning brawler who's your best friend and worst bar tab."),
    pc: e("Ace Calloway", "Pulp hero", "A daring troubleshooter with a lucky coin and a knack for the impossible."),
    threat: x("Baron Vex", "A monologuing villain with henchmen, a doomsday scheme, and terrible aim."),
    item: x("The Lightning Gadget", "A crackling invention that does something amazing — usually at the worst moment."),
    sheet: `## Character Sheet

\`\`\`savage-sheet
name: Cass Ryder
concept: Frontier scout turned reluctant guide
rank: Seasoned
ancestry: Human
bennies: 3
attributes:
  agility: d8
  smarts: d6
  spirit: d8
  strength: d6
  vigor: d8
pace: 6
parry: 6
toughness: 7
armor_value: 2
wounds: 1
fatigue: 0
skills:
  athletics: d8
  common_knowledge: d6
  fighting: d8
  notice: d8
  persuasion: d4
  shooting: d10
  stealth: d8
  survival: d8
  riding: d6
edges:
  - "Marksman — ignore up to 2 points of penalties when shooting."
  - "Woodsman — +2 to Survival and Stealth in the wild."
hindrances:
  - "Loyal (Minor) — will not abandon a friend."
  - "Stubborn (Minor) — always wants their own way."
weapons:
  - name: Lever-action rifle
    damage: 2d8
    range: "24/48/96"
    notes: "ROF 1"
  - name: Bowie knife
    damage: "Str+d4+1"
    range: "—"
    notes: ""
armor: Reinforced duster (+2)
gear:
  - Bedroll and trail rations
  - Spyglass
  - 40ft rope
  - Horse (saddled)
notes: Took the job to get out of town. The town is following.
\`\`\``
  },
  Custom: {
    premise: "A ready-made starter scenario you can reskin to any world you like.",
    location: x("Millhaven", "A small starting town at the edge of the map, where every campaign begins."),
    faction: x("The Wayfarers' Guild", "A local guild that posts the jobs, pays the coin, and knows the gossip."),
    npc: e("Mentor Alden", "Guild mentor", "The wise, weary guide who points new heroes toward their first quest."),
    pc: e("The Newcomer", "Sample hero", "A blank-slate protagonist ready to be made your own."),
    threat: x("The Rising Danger", "A vague, gathering menace waiting for you to give it a name and a face."),
    item: x("The Quest Token", "A mysterious object that kicks off the adventure the moment it's picked up."),
    // Deliberately system-neutral: the Custom kit is meant to be reskinned, so
    // this sheet names the slots every system has rather than any one system's.
    sheet: `## Character Sheet

**Name:** The Newcomer
**Role / Class:** _whatever your system calls it_
**Origin:** Millhaven
**Player:**

### Traits

| Trait | Rating |
| --- | --- |
| _Physical_ | |
| _Mental_ | |
| _Social_ | |
| _Other_ | |

> Replace these with your system's attributes — abilities, characteristics,
> approaches, stats. Add or remove rows freely.

### Skills & Training

- _Skill_ — rating
- _Skill_ — rating
- _Skill_ — rating

### Health & Resources

**Health / Hit Points:** ____ / ____
**Resource** (mana, stress, luck, fate): ____ / ____
**Defence / Armour:** ____

### Abilities & Gear

- **Ability** — what it lets you do.
- **Item** — what it is and why it matters.

### Ties

- [[Mentor Alden]] — the guild mentor who pointed you here.
- [[The Wayfarers' Guild]] — who pays and who asks questions.

### Notes

Swap in your own system's terms and delete the rest. If your system has a
renderer here — D&D, Traveller, Sword Chronicle, World of Darkness, ALIEN,
Dragonbane, Call of Cthulhu, Pendragon, Fate, Mothership, Delta Green,
Cyberpunk RED, Blades, Coriolis, OSR, Warhammer, or Savage Worlds — use its
fenced block instead and the sheet will render properly.`
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
    sheetBrief: research.sheetBrief,
    sheetIsBrief: !base.sheet
  };
}

function mdList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function demoStoryBeats(kit: DemoKit) {
  const { location: loc, faction: fac, npc, pc, threat, item } = kit;
  return {
    locationDetails: [
      `A public landmark points visitors toward [[${npc.name}]] before they know why.`,
      `A private room, alley, shrine, dock, vault, or back office links [[${loc.name}]] to [[${fac.name}]].`,
      `A visible clue hints that [[${threat.name}]] is already closer than anyone admits.`
    ],
    sceneStarters: [
      `[[${npc.name}]] asks [[${pc.name}]] to deliver a warning and refuses to say who is listening.`,
      `Agents of [[${fac.name}]] move openly through [[${loc.name}]] while pretending nothing is wrong.`,
      `The [[${item.name}]] appears in the wrong hands for one tense scene, then vanishes again.`
    ],
    factionGoals: [
      `Secure influence over [[${loc.name}]] before rivals realize what is at stake.`,
      `Control access to the [[${item.name}]] without being blamed for the fallout.`,
      `Use [[${npc.name}]] as an asset, scapegoat, or bargaining chip.`,
      `Keep the truth of [[${threat.name}]] contained until containment stops being possible.`
    ],
    factionMethods: [
      "Offer useful favors with hooks in them.",
      "Control information before controlling territory.",
      "Put a friendly face between the party and the ugly order.",
      "Escalate quietly first, then publicly once leverage is secure."
    ],
    npcSecrets: [
      `${npc.name} has already seen proof of [[${threat.name}]].`,
      `${npc.name} knows one safe way to approach the [[${item.name}]], but using it costs a relationship.`,
      `${npc.name} is less loyal to [[${fac.name}]] than everyone assumes.`
    ],
    pcPrompts: [
      `What does [[${pc.name}]] need from [[${loc.name}]] right now?`,
      `Why does [[${fac.name}]] think [[${pc.name}]] can be pressured?`,
      `What did [[${npc.name}]] once do that [[${pc.name}]] has not forgiven?`,
      `What rumor about the [[${item.name}]] does [[${pc.name}]] hope is false?`
    ],
    countdown: [
      `1. A strange sign appears at [[${loc.name}]].`,
      `2. [[${fac.name}]] suppresses witnesses or buys their silence.`,
      `3. [[${npc.name}]] disappears, defects, or is publicly discredited.`,
      `4. The [[${item.name}]] is activated, stolen, broken, or revealed.`,
      `5. [[${threat.name}]] becomes impossible to ignore.`
    ],
    itemQuestions: [
      `Who made the [[${item.name}]], and what did they sacrifice?`,
      `Why does [[${fac.name}]] believe they have a right to it?`,
      `What does [[${npc.name}]] know about its last owner?`,
      `What changes at [[${loc.name}]] when it is used?`
    ]
  };
}

/** Render a game's demo kit into a uniform set of cross-linked wiki pages. */
export function demoPagesFor(gameType: GameType): DemoPage[] {
  const kit = demoKitFor(gameType);
  const { location: loc, faction: fac, npc, pc, threat, item } = kit;
  const beats = demoStoryBeats(kit);
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
      body: `# ${pc.name}\n\n> ${pc.role} — a sample player character.\n\n## Concept\n\n${pc.blurb}\n\n## Hooks\n\n- Has unfinished business with [[${fac.name}]].\n- Is chasing the [[${item.name}]].\n- Crossed paths once with [[${npc.name}]].\n${kit.sheet ? (kit.sheetIsBrief ? `\n:::gm\n${kit.sheet}\n:::\n` : `\n${kit.sheet}\n`) : ""}\n_Demo player character — edit or delete freely._\n`
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

  pages.push({
    slug: demoSlug(`${gameType} Opening Situation`),
    name: `${gameType} Opening Situation`,
    category: "event",
    visibility: "gm",
    summary: `A ready-to-run first situation for the ${gameType} demo.`,
    tags: [tag, "opening", "gm"],
    body: `# ${gameType} Opening Situation

> A first playable scene tying the sample pages together.

## Start Here

The party arrives at [[${loc.name}]] because [[${npc.name}]] sent a warning, a job offer, a confession, or a plea for help. [[${fac.name}]] is already moving, the [[${item.name}]] has become dangerous, and [[${threat.name}]] is still deniable for one more scene.

## Immediate Questions

- Why is [[${pc.name}]] the person who cannot ignore this?
- What does [[${npc.name}]] refuse to say in public?
- What does [[${fac.name}]] offer that is genuinely useful?
- What sign of [[${threat.name}]] proves this is more than local trouble?

## First Three Scenes

1. **Public pressure:** something obvious happens at [[${loc.name}]] while witnesses are present.
2. **Private ask:** [[${npc.name}]] explains just enough to make refusal costly.
3. **Complication:** [[${fac.name}]] arrives, claims authority, or reveals they are already one step ahead.

## Outcomes To Track

- Who leaves with the [[${item.name}]]?
- Who learns the first real truth about [[${threat.name}]]?
- Which relationship is strained before the next session?
- What page should be created next: a map, a quest, a rival, or a secret history?

:::gm
Use this page as scaffolding, not canon. Rewrite the facts after session one and keep the links; the graph will immediately show how the demo is growing.
:::
`
  });

  for (const page of pages) {
    if (page.slug === demoSlug(loc.name)) {
      page.body += `\n## Demo Expansion Notes\n\n${mdList(beats.locationDetails)}\n\n## Scene Starters\n\n${mdList(beats.sceneStarters)}\n`;
    }
    if (page.slug === demoSlug(fac.name)) {
      page.body = page.body.replace("## Goals\n\n- \n", `## Goals\n\n${mdList(beats.factionGoals)}\n`);
      page.body += `\n## Methods\n\n${mdList(beats.factionMethods)}\n`;
    }
    if (page.slug === demoSlug(npc.name)) {
      page.body += `\n## Wants\n\n- To survive the next move by [[${fac.name}]].\n- To keep [[${threat.name}]] from becoming public knowledge.\n- To learn whether [[${pc.name}]] can be trusted with the [[${item.name}]].\n\n:::gm\n## Additional Secrets\n\n${mdList(beats.npcSecrets)}\n:::\n`;
    }
    if (page.slug === demoSlug(pc.name)) {
      page.body += `\n## Player Prompts\n\n${mdList(beats.pcPrompts)}\n`;
    }
    if (page.slug === demoSlug(threat.name)) {
      page.body += `\n## Countdown\n\n${beats.countdown.join("\n")}\n`;
    }
    if (page.slug === demoSlug(item.name)) {
      page.body += `\n## Questions To Answer In Play\n\n${mdList(beats.itemQuestions)}\n\n:::gm\nThe [[${item.name}]] can delay, reveal, redirect, or worsen [[${threat.name}]]. Pick the exact truth after the first session so it fits the table's choices.\n:::\n`;
    }
  }

  // Optional researched primer: concept + reference lists for the system.
  if (kit.concept || (kit.lists && kit.lists.length)) {
    const listMd = (kit.lists || [])
      .map((l) => `## ${l.title}\n\n${l.items.map((i) => `- ${i}`).join("\n")}`)
      .join("\n\n");
    pages.push({
      slug: demoSlug(`${gameType} Primer`),
      name: `${gameType} — GM Primer & Checklist`,
      category: "lore",
      visibility: "gm",
      summary: kit.concept ? `${kit.concept.split(". ")[0]}.` : `Quick reference for ${gameType}.`,
      tags: [tag, "reference"],
      body: `# ${gameType} — GM Primer & Checklist\n\n> GM-side reference for this system: the concept, the reformatting checklist, and the lists you'll reach for most.\n\n## Concept\n\n${kit.concept || kit.premise}\n\n${listMd}\n\n_Demo content — edit or delete freely._\n`
    });
  }

  const primer = pages.find((page) => page.slug === demoSlug(`${gameType} Primer`));
  if (primer) {
    primer.body += `\n## Suggested First Click\n\nStart with [[${gameType} Opening Situation]], then follow links to [[${loc.name}]], [[${fac.name}]], and [[${pc.name}]].\n`;
  }

  return pages;
}

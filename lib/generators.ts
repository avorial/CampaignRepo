// Deterministic random-table generators. No AI required.

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Simple seeded PRNG (mulberry32)
export function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── NPC ──────────────────────────────────────────────────────────────

const NPC_FIRST = [
  "Aldric","Brina","Corvin","Dessa","Elara","Fenn","Grasha","Holt","Isara","Joven",
  "Kalis","Lorra","Marek","Nira","Oswin","Petra","Quell","Ratha","Solan","Teva",
  "Udo","Venna","Wren","Xariel","Yori","Zain","Amara","Bex","Callum","Drina",
  "Elen","Fionn","Gavin","Hana","Idris","Jorin","Kessa","Liram","Mira","Nevin",
  "Oana","Pell","Quinn","Riol","Serene","Tobin","Ulara","Varric","Wyla","Xeven"
];
const NPC_LAST = [
  "Ashwood","Blackthorn","Coldwater","Dunmore","Embervale","Frostholm","Greymoor",
  "Harwick","Ironside","Jannsen","Kettleworth","Larkmoor","Millhaven","Northwall",
  "Orvyn","Pallister","Quarry","Ravenwood","Saltmere","Tindell","Underhill","Vane",
  "Wychwood","Ysern","Zorwick","Amberton","Briar","Copperfield","Duskhollow","Edgecliff"
];
const NPC_OCCUPATION = [
  "innkeeper","blacksmith","merchant","herbalist","guard captain","spice trader",
  "caravan master","debt collector","scribe","retired soldier","hedge wizard",
  "bounty hunter","beggar with a past","court functionary","travelling bard",
  "undertaker","apothecary","fisherman","landowner","messenger","fence","spy",
  "healer","tax assessor","shipwright","cult recruiter","wandering monk"
];
const NPC_TRAIT = [
  "speaks only in whispers","never makes eye contact","laughs nervously when nervous",
  "obsessively tidy","always chewing something","taps fingers when thinking",
  "finishes others' sentences","quotes proverbs constantly","unusually direct",
  "never asks questions, only makes statements","smells faintly of sulphur",
  "has a distinctive scar they won't explain","refers to themselves in third person",
  "always late but with elaborate excuses","unusually cheerful about grim topics"
];
const NPC_SECRET = [
  "owes a large debt to a dangerous person","witnessed a murder last winter",
  "is not who they claim to be","has an estranged child they've never met",
  "sold information that got people killed","is being blackmailed",
  "knows where something valuable is hidden","belongs to a banned organization",
  "is desperately in love with someone forbidden","has been lying about their past for years"
];
const NPC_GOAL = [
  "repay a debt before the creditor finds them","protect a family member at any cost",
  "earn enough to leave this town forever","find someone who disappeared years ago",
  "prove their innocence of a past accusation","gain enough influence to change a local law",
  "complete one last job and then retire","discover what happened to their mentor",
  "acquire a specific rare item or text","keep a dangerous secret buried"
];

export type GeneratedNPC = {
  name: string; occupation: string; trait: string; secret: string; goal: string;
};

export function generateNPC(seed: number): GeneratedNPC {
  const rng = seededRng(seed);
  return {
    name: `${pick(NPC_FIRST, rng)} ${pick(NPC_LAST, rng)}`,
    occupation: pick(NPC_OCCUPATION, rng),
    trait: pick(NPC_TRAIT, rng),
    secret: pick(NPC_SECRET, rng),
    goal: pick(NPC_GOAL, rng)
  };
}

// ── Settlement ───────────────────────────────────────────────────────

const SETT_ADJ = ["Old","New","High","Low","Dark","Bright","Iron","Silver","Red","White","Black","Golden","Stone","Lost","Hidden"];
const SETT_NOUN = ["Haven","Crossing","Mill","Hold","Bridge","Ford","Rock","Well","Gate","Watch","Moor","Fall","Creek","Ridge","Port"];
const SETT_SIZE = ["hamlet","village","market town","walled town","large city","fortified citadel","sprawling port"];
const SETT_TYPE = [
  "trading crossroads","religious pilgrimage site","military garrison","mining settlement",
  "agricultural community","fishing port","noble estate","river crossing","frontier outpost"
];
const SETT_AUTHORITY = [
  "a hereditary lord who rarely appears in public","an elected merchant council",
  "a military governor appointed by a distant power","an ancient religious order",
  "a notoriously corrupt sheriff","a council of guild masters","a reclusive and paranoid regent",
  "no central authority — powerful factions compete","a popular but aging mayor"
];
const SETT_PROBLEM = [
  "a blight destroying the harvest","an increase in disappearances at night",
  "rising tension between two powerful families","a demand for tribute from a bandit lord",
  "a strange sickness spreading through the lower districts","contested ownership of a vital resource",
  "refugees arriving from somewhere worse","a local official who has gone too far",
  "a legal dispute blocking essential repairs","something old has awakened nearby"
];
const SETT_FEATURE = [
  "a famous market that draws traders from three regions","ruins of a much older structure at its heart",
  "an unusual tower that no one can explain","a guild hall that controls more than it should",
  "a district that outsiders are discouraged from entering","an annual festival with strange traditions",
  "a river that sometimes runs red","an unusually large and well-stocked library",
  "a bridge that has never once needed repair","a shrine attended by a suspiciously large number of pilgrims"
];

export type GeneratedSettlement = {
  name: string; size: string; type: string; authority: string; problem: string; feature: string;
};

export function generateSettlement(seed: number): GeneratedSettlement {
  const rng = seededRng(seed);
  return {
    name: `${pick(SETT_ADJ, rng)} ${pick(SETT_NOUN, rng)}`,
    size: pick(SETT_SIZE, rng),
    type: pick(SETT_TYPE, rng),
    authority: pick(SETT_AUTHORITY, rng),
    problem: pick(SETT_PROBLEM, rng),
    feature: pick(SETT_FEATURE, rng)
  };
}

// ── Faction ──────────────────────────────────────────────────────────

const FACTION_ADJ = ["Crimson","Silver","Iron","Shadow","Golden","Ashen","Hidden","Broken","Eternal","Pale","Scarlet","Black","Ancient","Hollow","Bound"];
const FACTION_NOUN = ["Hand","Circle","Chain","Veil","Thorn","Eye","Key","Fist","Crown","Seal","Flame","Bell","Coin","Mask","Blade"];
const FACTION_TYPE = ["Brotherhood","Syndicate","Order","Covenant","Guild","Circle","Society","Conclave","Assembly","Lodge"];
const FACTION_GOAL = [
  "seize control of a key institution","restore a fallen dynasty or faith",
  "accumulate enough wealth to buy political immunity","prevent an ancient power from returning",
  "expose corruption at the highest level","expand their influence into a new region",
  "find and destroy a specific artifact","build a network of informants across every district",
  "establish a protected homeland for their members","monopolize a vital trade or resource"
];
const FACTION_METHOD = [
  "through bribery and blackmail","via charity and public service that masks other aims",
  "by violent enforcement","through carefully arranged marriages and alliances",
  "via control of information and secrets","by recruiting the desperate and the talented",
  "through shell organizations and false fronts","by exploiting existing tensions between rivals",
  "through ritual and mystical pressure","by patient long-term infiltration"
];
const FACTION_RESOURCE = [
  "a network of safe houses and messengers","leverage over key officials",
  "a cache of dangerous knowledge","significant financial reserves",
  "access to restricted places or people","the loyalty of a particular underclass",
  "an old legal claim that hasn't been enforced yet","rare materials or arcane components",
  "a powerful artifact they keep hidden","intelligence gathered over decades"
];

export type GeneratedFaction = {
  name: string; goal: string; method: string; resource: string;
};

export function generateFaction(seed: number): GeneratedFaction {
  const rng = seededRng(seed);
  return {
    name: `The ${pick(FACTION_ADJ, rng)} ${pick(FACTION_NOUN, rng)} ${pick(FACTION_TYPE, rng)}`,
    goal: pick(FACTION_GOAL, rng),
    method: pick(FACTION_METHOD, rng),
    resource: pick(FACTION_RESOURCE, rng)
  };
}

// ── Rumor ────────────────────────────────────────────────────────────

const RUMOR_SUBJ = [
  "a local merchant","the governor's secretary","a recently arrived stranger","a guard captain",
  "the old healer","the innkeeper's wife","a traveling monk","a member of the merchant council",
  "a well-known criminal","the mayor's youngest child","a retired soldier"
];
const RUMOR_VERB = [
  "was seen meeting with known enemies","has been paying bribes","disappeared briefly last month",
  "has been buying large quantities of a specific item","has connections to an outlawed group",
  "was overheard speaking a forbidden language","is not who they claim to be",
  "recently came into unexpected wealth","sold something they shouldn't have owned"
];
const RUMOR_TWIST = [
  "but the source is known to lie for profit","but no one can produce a witness",
  "but several people who investigated have since gone quiet","though the accused seems genuinely unaware of it",
  "and those who spread it have been quietly warned off","which might explain recent events no one can account for"
];
const RUMOR_SOURCE = [
  "overheard at the tavern","passed between market stalls","confided by a dying informant",
  "written in a letter that was intercepted","spoken by someone who then vanished",
  "from multiple sources who don't know each other","on the lips of every child in the district"
];

export type GeneratedRumor = {
  text: string; twist: string; source: string;
};

export function generateRumor(seed: number): GeneratedRumor {
  const rng = seededRng(seed);
  const text = `${pick(RUMOR_SUBJ, rng)} ${pick(RUMOR_VERB, rng)}`;
  return {
    text,
    twist: pick(RUMOR_TWIST, rng),
    source: pick(RUMOR_SOURCE, rng)
  };
}

// ── Encounter ────────────────────────────────────────────────────────

const ENC_TYPE = ["ambush","tense negotiation","chance meeting","pursuit","standoff","discovery","confrontation"];
const ENC_TERRAIN = [
  "narrow alley","crowded market","collapsed bridge","dense forest","underground chamber",
  "tavern common room","throne room","ship's deck","burnt-out building","mountain pass"
];
const ENC_ACTOR = [
  "a desperate bandit with a reluctant crew","a merchant with something to hide",
  "a messenger carrying documents they haven't read","an off-duty soldier with a grudge",
  "a creature that is not attacking, but watching","a group of refugees with useful information",
  "a rival faction enforcer","a child who saw something they shouldn't have",
  "someone who recognizes a party member","an official with dubious authority"
];
const ENC_COMPLICATION = [
  "bystanders who will not stay out of it","a time limit: something is about to go badly wrong",
  "a piece of information that changes everything partway through","one of the antagonists wants to defect",
  "the environment is actively hazardous","reinforcements are minutes away",
  "the real threat is someone the party trusts","the goal can be achieved but not without a cost"
];

export type GeneratedEncounter = {
  type: string; terrain: string; actor: string; complication: string;
};

export function generateEncounter(seed: number): GeneratedEncounter {
  const rng = seededRng(seed);
  return {
    type: pick(ENC_TYPE, rng),
    terrain: pick(ENC_TERRAIN, rng),
    actor: pick(ENC_ACTOR, rng),
    complication: pick(ENC_COMPLICATION, rng)
  };
}

// ── Format as wiki markdown ──────────────────────────────────────────

export function npcToMarkdown(npc: GeneratedNPC): { name: string; category: "npc"; content: string } {
  return {
    name: npc.name,
    category: "npc",
    content: `## ${npc.name}\n\n**Occupation:** ${npc.occupation}\n\n**Personality:** ${npc.trait}\n\n**Secret:** ${npc.secret}\n\n**Current goal:** ${npc.goal}\n`
  };
}

export function settlementToMarkdown(s: GeneratedSettlement): { name: string; category: "location"; content: string } {
  return {
    name: s.name,
    category: "location",
    content: `## ${s.name}\n\nA ${s.size} that functions as a ${s.type}.\n\n**Authority:** ${s.authority}\n\n**Notable feature:** ${s.feature}\n\n**Current problem:** ${s.problem}\n`
  };
}

export function factionToMarkdown(f: GeneratedFaction): { name: string; category: "organization"; content: string } {
  return {
    name: f.name,
    category: "organization",
    content: `## ${f.name}\n\n**Goal:** ${f.goal}\n\n**Method:** ${f.method}\n\n**Key resource:** ${f.resource}\n`
  };
}

export function rumorToMarkdown(r: GeneratedRumor): { name: string; category: "lore"; content: string } {
  return {
    name: "Rumor",
    category: "lore",
    content: `*${r.text} — ${r.twist}.*\n\n**Source:** ${r.source}\n`
  };
}

export function encounterToMarkdown(e: GeneratedEncounter): { name: string; category: "event"; content: string } {
  return {
    name: `${e.type.charAt(0).toUpperCase() + e.type.slice(1)} encounter`,
    category: "event",
    content: `## Encounter: ${e.type}\n\n**Setting:** ${e.terrain}\n\n**Who's involved:** ${e.actor}\n\n**Complication:** ${e.complication}\n`
  };
}

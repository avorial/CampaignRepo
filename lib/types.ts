export type WorldDate = { year: number; month: number; day: number };

export type GameType =
  // Fantasy
  | "Blades in the Dark"
  | "Burning Wheel"
  | "Dark Ages: Fae"
  | "Dark Ages: Inquisitor"
  | "Dark Ages: Mage"
  | "Dark Ages: Vampire"
  | "Dark Ages: Werewolf"
  | "Dragonbane"
  | "Dungeons & Dragons"
  | "Fabula Ultima"
  | "Mörk Borg"
  | "Old-School Essentials"
  | "Pathfinder"
  | "Pendragon"
  | "Reign"
  | "Shadowdark RPG"
  | "Sword Chronicle"
  | "The One Ring"
  | "Warhammer Fantasy Roleplay"
  // Modern
  | "Call of Cthulhu"
  | "Candela Obscura"
  | "Changeling: The Dreaming"
  | "Delta Green"
  | "Demon: The Fallen"
  | "Hunter: The Reckoning"
  | "Mage: The Ascension"
  | "Mummy: The Resurrection"
  | "The King in Yellow RPG"
  | "Twilight: 2000"
  | "Vampire: The Masquerade"
  | "Werewolf: The Apocalypse"
  | "Wraith: The Oblivion"
  // Sci-Fi
  | "2300AD"
  | "Alien RPG"
  | "Coriolis"
  | "Cyberpunk RED"
  | "Mothership"
  | "Starfinder"
  | "Traveller"
  | "Warhammer 40,000 Roleplay"
  // Generic
  | "Fate Core"
  | "Savage Worlds"
  | "Custom";
export type DefaultCategory = "character" | "npc" | "location" | "event" | "game" | "organization" | "species" | "item" | "lore" | "spell" | "religion" | "vehicle";
export type Category = DefaultCategory | (string & {});
export type Visibility = "gm" | "players";
export type ApprovalStatus = "approved" | "unapproved" | "rejected";
export type CampaignRole = "owner" | "gm" | "player";

export type User = {
  id: number;
  email: string;
  name: string;
  githubToken?: string | null;
  mustChangePassword: boolean;
  isAdmin: boolean;
  disabled: boolean;
  createdAt: string;
};

export type Campaign = {
  id: number;
  userId: number;
  name: string;
  owner: string;
  repo: string;
  branch: string;
  gameType: GameType;
  storageBackend: "github" | "local";
  localPath?: string | null;
  forkOf?: string | null;
  role?: CampaignRole;
  createdAt: string;
};

export type ApiToken = {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type CampaignMembership = {
  id: number;
  campaignId: number;
  userId: number;
  role: CampaignRole;
  email: string;
  name: string;
  groups?: string[];
  createdAt: string;
};

export type CampaignInvite = {
  id: number;
  campaignId: number;
  token: string;
  role: Exclude<CampaignRole, "owner">;
  createdBy: number;
  createdByName?: string;
  revokedAt?: string | null;
  acceptedAt?: string | null;
  acceptedBy?: number | null;
  createdAt: string;
};

export type WikiRelationship = {
  type: string;
  target: string;
  label?: string;
  notes?: string;
  since?: string;
  until?: string;
  hidden?: boolean;
};

export type WikiPageFrontmatter = {
  category: Category;
  type: string;
  name: string;
  summary: string;
  tags: string[];
  visibility: Visibility;
  approvalStatus: ApprovalStatus;
  knownToPlayers: boolean;
  keyLinks: string[];
  aliases: string[];
  relationships?: WikiRelationship[];
  parent?: string;
  cover?: string;
  foundryLink?: string;
  sourceImport?: string;
  status?: string;
  eventDate?: string;
  timelineDate?: string;
  era?: string;
  track?: string;
  uwp?: string;
  allegiance?: string;
  tradeCodes?: string[];
  subsector?: string;
  patron?: string;
  techLevel?: string;
  worldDate?: WorldDate;
  birthdate?: WorldDate;
  lastEditedBy?: string;
  assignee?: string;
  sheet?: TravellerSheet;
  inventory?: Array<{ name: string; qty?: number; value?: string; notes?: string }>;
  abilities?: Array<{ name: string; description?: string; type?: string; notes?: string }>;
  resources?: Array<{ name: string; current: number; max: number; notes?: string }>;
};

export type TravellerSkill = { name: string; level?: number; speciality?: string };
export type TravellerCharacteristics = { STR?: number; DEX?: number; END?: number; INT?: number; EDU?: number; SOC?: number };
export type TravellerSheet = {
  system: "traveller";
  characteristics: TravellerCharacteristics;
  skills: TravellerSkill[];
  header?: [string, string, string];
  portrait?: string;
  age?: number;
  species?: string;
  homeworld?: string;
  uwp?: string;
  career?: string;
  rank?: string;
  dossier?: string;
  status?: string;
  conditions?: string[];
  speciesTraits?: string[];
  credits?: number;
  armour?: { name: string; protection?: string; notes?: string }[];
  weapons?: { name: string; damage?: string; range?: string; notes?: string }[];
  equipment?: { name: string; quantity?: number; notes?: string }[];
  holdings?: { name: string; notes?: string }[];
  contacts?: { name: string; notes?: string }[];
  psionics?: { name: string; level?: number; notes?: string }[];
  notes?: string;
};

export type DnDAbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type DnDSheet = {
  system: "dnd5e" | "pathfinder2";
  name?: string;
  class?: string;
  subclass?: string;
  level?: number;
  race?: string;
  background?: string;
  alignment?: string;
  xp?: number;
  player?: string;
  portrait?: string;
  ability_scores?: Partial<Record<DnDAbilityKey, number>>;
  proficiency_bonus?: number;
  saving_throw_proficiencies?: string[];
  skill_proficiencies?: string[];
  skill_expertise?: string[];
  ac?: number;
  initiative?: number;
  speed?: number;
  hp_max?: number;
  hp_current?: number;
  hp_temp?: number;
  hit_dice?: string;
  death_saves?: { successes?: number; failures?: number };
  passive_perception?: number;
  attacks?: { name: string; bonus?: string; damage?: string; notes?: string }[];
  spellcasting?: {
    ability?: string;
    spell_save_dc?: number;
    spell_attack?: string;
    spells?: { level: number; slots?: number; used?: number; list?: string[] }[];
  };
  features?: string[];
  languages?: string[];
  proficiencies?: string[];
  equipment?: { name: string; quantity?: number; notes?: string }[];
  notes?: string;
};

export type WoDSystem = "vampire-masquerade" | "dark-ages-vampire" | "werewolf-apocalypse" | "mage-ascension" | "generic-wod";
export type WoDRated = { name: string; score: number; notes?: string; descriptions?: string[] };
export type WoDSheet = {
  system: WoDSystem;
  name?: string;
  clan?: string;
  chronicle?: string;
  generation?: number;
  sire?: string;
  nature?: string;
  demeanor?: string;
  concept?: string;
  sect?: string;
  real_age?: string;
  apparent_age?: string;
  road?: string;
  portrait?: string;
  attributes?: {
    strength?: number; dexterity?: number; stamina?: number;
    charisma?: number; manipulation?: number; appearance?: number;
    perception?: number; intelligence?: number; wits?: number;
  };
  abilities?: WoDRated[];
  powers?: WoDRated[];
  backgrounds?: WoDRated[];
  merits?: WoDRated[];
  flaws?: WoDRated[];
  virtues?: { first?: number; second?: number; third?: number };
  willpower?: number;
  willpower_current?: number;
  blood?: number;
  blood_current?: number;
  humanity?: number;
  health?: {
    bruised?: boolean; hurt?: boolean; injured?: boolean;
    wounded?: boolean; mauled?: boolean; crippled?: boolean;
    incapacitated?: boolean;
  };
  weapons?: { name: string; damage?: string; notes?: string }[];
  equipment?: { name: string; notes?: string }[];
  notes?: string;
};

export type WikiPage = {
  slug: string;
  sha?: string;
  frontmatter: WikiPageFrontmatter;
  content: string;
  raw: string;
  outgoingLinks: WikiLink[];
  backlinks: string[];
};

export type WikiLink = {
  target: string;
  label: string;
};

export type WikiTemplate = {
  slug: string;
  path: string;
  sha?: string;
  gameType: GameType;
  category: Category;
  name: string;
  summary: string;
  content: string;
};

export type CampaignMedia = {
  name: string;
  path: string;
  sha: string;
  size?: number;
  downloadUrl?: string;
  mediaType: "image" | "pdf" | "audio" | "other";
  alt?: string;
  caption?: string;
  tags?: string[];
  markdown: string;
};

export type CampaignGraphNode = {
  slug: string;
  name: string;
  category: Category;
  summary: string;
  tags: string[];
  visibility: Visibility;
  approvalStatus: ApprovalStatus;
  keyLinks: string[];
  outgoingLinks: string[];
  backlinks: string[];
};

export type CampaignGraphEdge = {
  source: string;
  target: string;
  label: string;
  missing: boolean;
  relType?: string;
};

export type CampaignTimelineItem = {
  slug: string;
  name: string;
  summary: string;
  eventDate?: string;
  era?: string;
  track?: string;
  tags: string[];
  visibility: Visibility;
  approvalStatus: ApprovalStatus;
};

export type SearchDocument = {
  id: string;
  campaignId: number;
  campaignName: string;
  slug: string;
  title: string;
  category: Category | "media" | string;
  summary: string;
  tags: string[];
  aliases: string[];
  visibility: Visibility;
  approvalStatus: ApprovalStatus;
  text: string;
  playerText: string;
  links: string[];
  backlinks: string[];
  keyLinks: string[];
};

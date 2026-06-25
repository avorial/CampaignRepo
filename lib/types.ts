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
export type Category = "character" | "npc" | "location" | "event" | "game" | "organization" | "species" | "item" | "lore";
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
  lastEditedBy?: string;
  sheet?: TravellerSheet;
};

export type TravellerSkill = { name: string; level?: number; speciality?: string };
export type TravellerSheet = {
  system: "traveller";
  characteristics: { STR: number; DEX: number; END: number; INT: number; EDU: number; SOC: number };
  skills: TravellerSkill[];
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

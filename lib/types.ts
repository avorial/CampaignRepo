export type GameType = "Sword Chronicle" | "Dungeons & Dragons" | "World of Darkness" | "Traveller" | "Custom";
export type Category = "character" | "npc" | "location" | "event" | "game";
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
  foundryLink?: string;
  sourceImport?: string;
  status?: string;
  eventDate?: string;
  timelineDate?: string;
  uwp?: string;
  allegiance?: string;
  tradeCodes?: string[];
  subsector?: string;
  patron?: string;
  techLevel?: string;
  lastEditedBy?: string;
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

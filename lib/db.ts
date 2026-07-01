import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { slugify } from "@/lib/slug";
import type { ApiToken, Campaign, CampaignInvite, CampaignMembership, CampaignRole, SearchDocument, User } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
// CAMPAIGNREPO_DB lets tests point at an in-memory (":memory:") database.
const dbPath = process.env.CAMPAIGNREPO_DB || path.join(dataDir, "campaignrepo.sqlite");

if (dbPath !== ":memory:" && !fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath, { timeout: 10000 });
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 10000");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  githubToken TEXT,
  mustChangePassword INTEGER NOT NULL DEFAULT 0,
  isAdmin INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId INTEGER NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiresAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  gameType TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, owner, repo),
  FOREIGN KEY (userId) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS campaign_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaignId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'gm', 'player')),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaignId, userId),
  FOREIGN KEY (campaignId) REFERENCES campaigns(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS campaign_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaignId INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('gm', 'player')),
  createdBy INTEGER NOT NULL,
  revokedAt TEXT,
  acceptedAt TEXT,
  acceptedBy INTEGER,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaignId) REFERENCES campaigns(id),
  FOREIGN KEY (createdBy) REFERENCES users(id),
  FOREIGN KEY (acceptedBy) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaignId INTEGER NOT NULL,
  source TEXT NOT NULL,
  sourceId TEXT NOT NULL,
  pageSlug TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS api_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  tokenHash TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastUsedAt TEXT,
  FOREIGN KEY (userId) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public_sites (
  campaignId INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaignId) REFERENCES campaigns(id)
);
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  id UNINDEXED,
  campaignId UNINDEXED,
  campaignName,
  slug UNINDEXED,
  title,
  category,
  summary,
  tags,
  aliases,
  visibility UNINDEXED,
  approvalStatus UNINDEXED,
  text,
  playerText,
  links,
  backlinks,
  keyLinks,
  tokenize='porter'
);
CREATE TABLE IF NOT EXISTS campaign_page_cache (
  campaignId INTEGER NOT NULL,
  slug TEXT NOT NULL,
  sha TEXT NOT NULL,
  pageJson TEXT NOT NULL,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (campaignId, slug),
  FOREIGN KEY (campaignId) REFERENCES campaigns(id)
);
CREATE TABLE IF NOT EXISTS campaign_page_cache_state (
  campaignId INTEGER PRIMARY KEY,
  refreshedAt TEXT,
  refreshError TEXT,
  FOREIGN KEY (campaignId) REFERENCES campaigns(id)
);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
if (!userColumns.some((column) => column.name === "mustChangePassword")) {
  db.exec("ALTER TABLE users ADD COLUMN mustChangePassword INTEGER NOT NULL DEFAULT 0");
}
if (!userColumns.some((column) => column.name === "isAdmin")) {
  db.exec("ALTER TABLE users ADD COLUMN isAdmin INTEGER NOT NULL DEFAULT 0");
}
if (!userColumns.some((column) => column.name === "disabled")) {
  db.exec("ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0");
}

const campaignColumns = db.prepare("PRAGMA table_info(campaigns)").all() as Array<{ name: string }>;
if (!campaignColumns.some((c) => c.name === "storageBackend")) {
  db.exec("ALTER TABLE campaigns ADD COLUMN storageBackend TEXT NOT NULL DEFAULT 'github'");
}
if (!campaignColumns.some((c) => c.name === "localPath")) {
  db.exec("ALTER TABLE campaigns ADD COLUMN localPath TEXT");
}

const publicSiteColumns = db.prepare("PRAGMA table_info(public_sites)").all() as Array<{ name: string }>;
if (!publicSiteColumns.some((column) => column.name === "clones")) {
  db.exec("ALTER TABLE public_sites ADD COLUMN clones INTEGER NOT NULL DEFAULT 0");
}

const adminHash = bcrypt.hashSync("admin", 12);
db.prepare(
  `INSERT OR IGNORE INTO users (email, name, passwordHash, mustChangePassword, isAdmin, disabled)
   VALUES ('admin@example.local', 'admin', ?, 1, 1, 0)`
).run(adminHash);
db.prepare("UPDATE users SET isAdmin = 1, disabled = 0 WHERE email = 'admin@example.local'").run();

db.exec(`
INSERT OR IGNORE INTO campaign_memberships (campaignId, userId, role)
SELECT id, userId, 'owner' FROM campaigns;
`);

// Notifications table
db.exec(`
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  campaignId INTEGER,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  readAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);
`);

// Migrations — safe to run on every start (errors mean column already exists)
try { db.exec("ALTER TABLE campaign_memberships ADD COLUMN groups TEXT NOT NULL DEFAULT '[]'"); } catch { /* already migrated */ }

export function getDb() {
  return db;
}

export function getAppSetting(key: string) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value || "";
}

export function setAppSettings(settings: Record<string, string | undefined | null>) {
  const stmt = db.prepare(
    `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`
  );
  const write = db.transaction((items: Array<[string, string]>) => {
    for (const [key, value] of items) stmt.run(key, value);
  });
  write(Object.entries(settings).map(([key, value]) => [key, value || ""]));
}

export function publicUser(row: any): User | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    githubToken: row.githubToken,
    mustChangePassword: Boolean(row.mustChangePassword),
    isAdmin: Boolean(row.isAdmin),
    disabled: Boolean(row.disabled),
    createdAt: row.createdAt
  };
}

export function getUserById(id: number) {
  return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function hashApiToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Mint a personal access token for MCP/API use. Returns the plaintext once. */
export function createApiToken(userId: number, name: string): { id: number; name: string; token: string } {
  const label = name.trim() || "MCP token";
  const token = `crepo_${crypto.randomBytes(24).toString("hex")}`;
  const info = db.prepare("INSERT INTO api_tokens (userId, name, tokenHash) VALUES (?, ?, ?)").run(userId, label, hashApiToken(token));
  return { id: Number(info.lastInsertRowid), name: label, token };
}

export function listApiTokens(userId: number): ApiToken[] {
  return db.prepare("SELECT id, name, createdAt, lastUsedAt FROM api_tokens WHERE userId = ? ORDER BY createdAt DESC").all(userId) as ApiToken[];
}

export function revokeApiToken(userId: number, id: number) {
  db.prepare("DELETE FROM api_tokens WHERE id = ? AND userId = ?").run(id, userId);
}

export function getUserByApiToken(token: string): User | null {
  const hash = hashApiToken(token);
  const row = db.prepare("SELECT users.* FROM api_tokens JOIN users ON users.id = api_tokens.userId WHERE api_tokens.tokenHash = ? AND users.disabled = 0").get(hash);
  if (!row) return null;
  db.prepare("UPDATE api_tokens SET lastUsedAt = CURRENT_TIMESTAMP WHERE tokenHash = ?").run(hash);
  return publicUser(row);
}

export type PublicSiteRow = { campaignId: number; slug: string; enabled: boolean; createdAt: string };

function normalizePublicSlug(value?: string | null) {
  const clean = slugify(value || "").toLowerCase();
  if (!clean || clean === "untitled") return "";
  if (clean.length < 3) throw new Error("Public link name must be at least 3 characters.");
  if (clean === "site" || clean === "api" || clean === "dashboard" || clean === "campaigns") {
    throw new Error("That public link name is reserved.");
  }
  return clean;
}

function randomPublicSlug() {
  return `pub_${crypto.randomBytes(9).toString("hex")}`;
}

function assertPublicSlugAvailable(slug: string, campaignId: number) {
  const owner = db.prepare("SELECT campaignId FROM public_sites WHERE lower(slug) = lower(?)").get(slug) as { campaignId: number } | undefined;
  if (owner && owner.campaignId !== campaignId) throw new Error("That public link name is already taken.");
}

/** The published-site record for a campaign, if one has ever been created. */
export function getPublicSite(campaignId: number): PublicSiteRow | null {
  const row = db.prepare("SELECT campaignId, slug, enabled, createdAt FROM public_sites WHERE campaignId = ?").get(campaignId) as
    | { campaignId: number; slug: string; enabled: number; createdAt: string }
    | undefined;
  return row ? { ...row, enabled: Boolean(row.enabled) } : null;
}

/** Resolve a public share slug to its campaign — only when the site is enabled. */
export function getPublicSiteCampaign(slug: string): Campaign | null {
  return (
    (db
      .prepare(
        `SELECT campaigns.* FROM public_sites
         JOIN campaigns ON campaigns.id = public_sites.campaignId
         WHERE public_sites.slug = ? AND public_sites.enabled = 1`
      )
      .get(slug) as Campaign | undefined) || null
  );
}

/** Every enabled public campaign, for the public discovery gallery (no auth). */
export function listPublicSites(): { slug: string; name: string; gameType: string; clones: number; publishedAt: string }[] {
  return db
    .prepare(
      `SELECT public_sites.slug AS slug, campaigns.name AS name, campaigns.gameType AS gameType,
              public_sites.clones AS clones, public_sites.createdAt AS publishedAt
       FROM public_sites
       JOIN campaigns ON campaigns.id = public_sites.campaignId
       WHERE public_sites.enabled = 1
       ORDER BY public_sites.clones DESC, campaigns.name COLLATE NOCASE`
    )
    .all() as { slug: string; name: string; gameType: string; clones: number; publishedAt: string }[];
}

/** Bump a published world's clone counter (drives most-cloned discovery). */
export function incrementCloneCount(campaignId: number) {
  db.prepare("UPDATE public_sites SET clones = clones + 1 WHERE campaignId = ?").run(campaignId);
}

/** Publish (or re-enable) a campaign's public site. Mints a stable random slug on first publish unless a custom slug is requested. */
export function publishCampaign(userId: number, campaignId: number, requestedSlug?: string | null): PublicSiteRow {
  if (!canManageCampaign(userId, campaignId)) throw new Error("Forbidden");
  const existing = getPublicSite(campaignId);
  const slug = normalizePublicSlug(requestedSlug);
  if (slug) assertPublicSlugAvailable(slug, campaignId);
  if (existing) {
    db.prepare("UPDATE public_sites SET slug = ?, enabled = 1 WHERE campaignId = ?").run(slug || existing.slug, campaignId);
    return getPublicSite(campaignId)!;
  }
  db.prepare("INSERT INTO public_sites (campaignId, slug, enabled) VALUES (?, ?, 1)").run(campaignId, slug || randomPublicSlug());
  return getPublicSite(campaignId)!;
}

/** Take a campaign's public site offline without discarding its slug. */
export function unpublishCampaign(userId: number, campaignId: number) {
  if (!canManageCampaign(userId, campaignId)) throw new Error("Forbidden");
  db.prepare("UPDATE public_sites SET enabled = 0 WHERE campaignId = ?").run(campaignId);
}

/** Rotate the share slug, invalidating any previously shared public URL. */
export function rotatePublicSlug(userId: number, campaignId: number, requestedSlug?: string | null): PublicSiteRow {
  if (!canManageCampaign(userId, campaignId)) throw new Error("Forbidden");
  const slug = normalizePublicSlug(requestedSlug) || randomPublicSlug();
  assertPublicSlugAvailable(slug, campaignId);
  const existing = getPublicSite(campaignId);
  if (!existing) return publishCampaign(userId, campaignId, slug);
  db.prepare("UPDATE public_sites SET slug = ? WHERE campaignId = ?").run(slug, campaignId);
  return getPublicSite(campaignId)!;
}

export function listUsers() {
  const users = db
    .prepare(
      `SELECT users.id, users.email, users.name, users.mustChangePassword, users.isAdmin, users.disabled, users.createdAt,
        COUNT(DISTINCT campaign_memberships.campaignId) AS campaignCount
       FROM users
       LEFT JOIN campaign_memberships ON campaign_memberships.userId = users.id
       GROUP BY users.id
       ORDER BY users.createdAt DESC`
    )
    .all() as Array<User & { campaignCount: number }>;
  const campaigns = db
    .prepare(
      `SELECT campaign_memberships.userId, campaign_memberships.role, campaigns.id, campaigns.name, campaigns.owner, campaigns.repo
       FROM campaign_memberships
       JOIN campaigns ON campaigns.id = campaign_memberships.campaignId
       ORDER BY campaigns.name`
    )
    .all() as Array<{ userId: number; role: CampaignRole; id: number; name: string; owner: string; repo: string }>;
  const byUser = new Map<number, Array<{ id: number; name: string; owner: string; repo: string; role: CampaignRole }>>();
  for (const campaign of campaigns) {
    const list = byUser.get(campaign.userId) || [];
    list.push({ id: campaign.id, name: campaign.name, owner: campaign.owner, repo: campaign.repo, role: campaign.role });
    byUser.set(campaign.userId, list);
  }
  return users.map((user) => ({ ...user, campaigns: byUser.get(user.id) || [] }));
}

export function createManualUser(email: string, name: string, passwordHash: string, isAdmin = false) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanEmail || !cleanName) throw new Error("Name and email are required.");
  const existing = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(cleanEmail) as { id: number } | undefined;
  if (existing) throw new Error("An account with that email already exists.");
  const info = db
    .prepare("INSERT INTO users (email, name, passwordHash, mustChangePassword, isAdmin, disabled) VALUES (?, ?, ?, 1, ?, 0)")
    .run(cleanEmail, cleanName, passwordHash, isAdmin ? 1 : 0);
  return Number(info.lastInsertRowid);
}

export function listAllCampaignsForAdmin() {
  return db
    .prepare("SELECT id, name, owner, repo, gameType, createdAt FROM campaigns ORDER BY name, owner, repo")
    .all() as Array<Pick<Campaign, "id" | "name" | "owner" | "repo" | "gameType" | "createdAt">>;
}

export function setUserCampaignMembership(userId: number, campaignId: number, role: Exclude<CampaignRole, "owner"> | null) {
  const existing = getCampaignRole(userId, campaignId);
  if (existing === "owner") throw new Error("Campaign owners cannot be changed from global user editing.");
  if (!role) {
    db.prepare("DELETE FROM campaign_memberships WHERE userId = ? AND campaignId = ?").run(userId, campaignId);
    return;
  }
  db.prepare("INSERT OR REPLACE INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, ?)").run(campaignId, userId, role);
}

export function setUserDisabled(adminUserId: number, userId: number, disabled: boolean) {
  if (adminUserId === userId && disabled) throw new Error("You cannot disable your own account.");
  db.prepare("UPDATE users SET disabled = ? WHERE id = ?").run(disabled ? 1 : 0, userId);
  if (disabled) db.prepare("DELETE FROM sessions WHERE userId = ?").run(userId);
}

export function setUserAdmin(adminUserId: number, userId: number, isAdmin: boolean) {
  if (adminUserId === userId && !isAdmin) throw new Error("You cannot remove your own global admin access.");
  db.prepare("UPDATE users SET isAdmin = ? WHERE id = ?").run(isAdmin ? 1 : 0, userId);
}

export function updateUserIdentity(userId: number, email: string, name: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanEmail || !cleanName) throw new Error("Name and email are required.");
  const existing = db.prepare("SELECT id FROM users WHERE lower(email) = ? AND id != ?").get(cleanEmail, userId) as { id: number } | undefined;
  if (existing) throw new Error("Another user already has that email.");
  const info = db.prepare("UPDATE users SET email = ?, name = ? WHERE id = ?").run(cleanEmail, cleanName, userId);
  if (info.changes === 0) throw new Error("User not found.");
}

export function resetUserPassword(userId: number, passwordHash: string) {
  db.prepare("UPDATE users SET passwordHash = ?, mustChangePassword = 1 WHERE id = ?").run(passwordHash, userId);
  db.prepare("DELETE FROM sessions WHERE userId = ?").run(userId);
  db.prepare("DELETE FROM api_tokens WHERE userId = ?").run(userId);
}

export function getCampaign(userId: number, campaignId: number): Campaign | null {
  return (
    db
      .prepare(
        `SELECT campaigns.*, campaign_memberships.role
         FROM campaigns
         JOIN campaign_memberships ON campaign_memberships.campaignId = campaigns.id
         WHERE campaign_memberships.userId = ? AND campaigns.id = ?`
      )
      .get(userId, campaignId) as Campaign | undefined
  ) || null;
}

export function getCampaignRepositoryToken(campaignId: number) {
  const row = db
    .prepare(
      `SELECT users.githubToken
       FROM campaigns
       JOIN campaign_memberships ON campaign_memberships.campaignId = campaigns.id
       JOIN users ON users.id = campaign_memberships.userId
       WHERE campaigns.id = ?
         AND users.githubToken IS NOT NULL
         AND users.githubToken != ''
         AND campaign_memberships.role IN ('owner', 'gm')
       ORDER BY CASE WHEN users.id = campaigns.userId THEN 0 ELSE 1 END,
         CASE campaign_memberships.role WHEN 'owner' THEN 0 ELSE 1 END,
         users.id
       LIMIT 1`
    )
    .get(campaignId) as { githubToken?: string | null } | undefined;
  return row?.githubToken || null;
}

export function listCampaigns(userId: number): Campaign[] {
  return db
    .prepare(
      `SELECT campaigns.*, campaign_memberships.role
       FROM campaigns
       JOIN campaign_memberships ON campaign_memberships.campaignId = campaigns.id
       WHERE campaign_memberships.userId = ?
       ORDER BY campaigns.createdAt DESC`
    )
    .all(userId) as Campaign[];
}

export function getCampaignRole(userId: number, campaignId: number): CampaignRole | null {
  const row = db.prepare("SELECT role FROM campaign_memberships WHERE userId = ? AND campaignId = ?").get(userId, campaignId) as { role: CampaignRole } | undefined;
  return row?.role || null;
}

export function canManageCampaign(userId: number, campaignId: number) {
  const role = getCampaignRole(userId, campaignId);
  return role === "owner" || role === "gm";
}

/** Disconnect a campaign from CampaignRepo (owner only). The GitHub repo is untouched. */
export function removeCampaign(userId: number, campaignId: number) {
  if (getCampaignRole(userId, campaignId) !== "owner") throw new Error("Only the campaign owner can remove it.");
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM campaign_page_cache WHERE campaignId = ?").run(campaignId);
    db.prepare("DELETE FROM campaign_page_cache_state WHERE campaignId = ?").run(campaignId);
    db.prepare("DELETE FROM search_index WHERE campaignId = ?").run(campaignId);
    db.prepare("DELETE FROM campaign_memberships WHERE campaignId = ?").run(campaignId);
    db.prepare("DELETE FROM imports WHERE campaignId = ?").run(campaignId);
    db.prepare("DELETE FROM campaign_invites WHERE campaignId = ?").run(campaignId);
    db.prepare("DELETE FROM public_sites WHERE campaignId = ?").run(campaignId);
    db.prepare("DELETE FROM campaigns WHERE id = ?").run(campaignId);
  });
  tx();
}

export function listCampaignMembers(userId: number, campaignId: number): CampaignMembership[] {
  if (!canManageCampaign(userId, campaignId)) return [];
  return db
    .prepare(
      `SELECT campaign_memberships.*, users.email, users.name
       FROM campaign_memberships
       JOIN users ON users.id = campaign_memberships.userId
       WHERE campaign_memberships.campaignId = ?
       ORDER BY CASE campaign_memberships.role WHEN 'owner' THEN 0 WHEN 'gm' THEN 1 ELSE 2 END, users.name`
    )
    .all(campaignId) as CampaignMembership[];
}

export function addCampaignMember(adminUserId: number, campaignId: number, email: string, role: CampaignRole) {
  if (!canManageCampaign(adminUserId, campaignId)) throw new Error("Forbidden");
  const user = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(email) as { id: number } | undefined;
  if (!user) throw new Error("No CampaignRepo account exists for that email.");
  db.prepare("INSERT OR REPLACE INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, ?)").run(campaignId, user.id, role);
}

export function updateCampaignMember(adminUserId: number, campaignId: number, memberUserId: number, role: CampaignRole) {
  if (!canManageCampaign(adminUserId, campaignId)) throw new Error("Forbidden");
  const existing = getCampaignRole(memberUserId, campaignId);
  if (existing === "owner" && role !== "owner") throw new Error("Owners cannot be demoted in the MVP.");
  db.prepare("UPDATE campaign_memberships SET role = ? WHERE campaignId = ? AND userId = ?").run(role, campaignId, memberUserId);
}

export function removeCampaignMember(adminUserId: number, campaignId: number, memberUserId: number) {
  if (!canManageCampaign(adminUserId, campaignId)) throw new Error("Forbidden");
  const existing = getCampaignRole(memberUserId, campaignId);
  if (existing === "owner") throw new Error("Owners cannot be removed in the MVP.");
  db.prepare("DELETE FROM campaign_memberships WHERE campaignId = ? AND userId = ?").run(campaignId, memberUserId);
}

export function getMemberGroups(campaignId: number, userId: number): string[] {
  const row = db.prepare("SELECT groups FROM campaign_memberships WHERE campaignId = ? AND userId = ?").get(campaignId, userId) as { groups?: string } | undefined;
  try { return JSON.parse(row?.groups || "[]"); } catch { return []; }
}

export function setMemberGroups(adminUserId: number, campaignId: number, memberUserId: number, groups: string[]) {
  if (!canManageCampaign(adminUserId, campaignId)) throw new Error("Forbidden");
  db.prepare("UPDATE campaign_memberships SET groups = ? WHERE campaignId = ? AND userId = ?").run(JSON.stringify(groups), campaignId, memberUserId);
}

/**
 * Single-owner transfer: make `newOwnerUserId` the campaign owner and demote any
 * current owner to GM. Authorization (current owner OR global admin) is enforced
 * by the caller — never expose this to a plain GM. The new owner must already be
 * a member of the campaign.
 */
export function transferCampaignOwnership(campaignId: number, newOwnerUserId: number) {
  if (!getCampaignRole(newOwnerUserId, campaignId)) {
    throw new Error("The new owner must already be a member of the campaign.");
  }
  const run = db.transaction(() => {
    db.prepare("UPDATE campaign_memberships SET role = 'gm' WHERE campaignId = ? AND role = 'owner'").run(campaignId);
    db.prepare("UPDATE campaign_memberships SET role = 'owner' WHERE campaignId = ? AND userId = ?").run(campaignId, newOwnerUserId);
    db.prepare("UPDATE campaigns SET userId = ? WHERE id = ?").run(newOwnerUserId, campaignId);
  });
  run();
}

export function createCampaignInvite(adminUserId: number, campaignId: number, role: Exclude<CampaignRole, "owner">) {
  if (!canManageCampaign(adminUserId, campaignId)) throw new Error("Forbidden");
  const token = `invite_${crypto.randomBytes(24).toString("hex")}`;
  const info = db
    .prepare("INSERT INTO campaign_invites (campaignId, token, role, createdBy) VALUES (?, ?, ?, ?)")
    .run(campaignId, token, role, adminUserId);
  return db.prepare("SELECT * FROM campaign_invites WHERE id = ?").get(info.lastInsertRowid) as CampaignInvite;
}

export function listCampaignInvites(adminUserId: number, campaignId: number): CampaignInvite[] {
  if (!canManageCampaign(adminUserId, campaignId)) return [];
  return db
    .prepare(
      `SELECT campaign_invites.*, users.name AS createdByName
       FROM campaign_invites
       JOIN users ON users.id = campaign_invites.createdBy
       WHERE campaign_invites.campaignId = ?
       ORDER BY campaign_invites.createdAt DESC`
    )
    .all(campaignId) as CampaignInvite[];
}

export function revokeCampaignInvite(adminUserId: number, campaignId: number, inviteId: number) {
  if (!canManageCampaign(adminUserId, campaignId)) throw new Error("Forbidden");
  db.prepare("UPDATE campaign_invites SET revokedAt = CURRENT_TIMESTAMP WHERE id = ? AND campaignId = ? AND acceptedAt IS NULL").run(inviteId, campaignId);
}

export function getCampaignInvite(token: string) {
  return (
    db
      .prepare(
        `SELECT campaign_invites.*, campaigns.name AS campaignName, campaigns.owner, campaigns.repo, campaigns.gameType
         FROM campaign_invites
         JOIN campaigns ON campaigns.id = campaign_invites.campaignId
         WHERE campaign_invites.token = ?`
      )
      .get(token) as
      | (CampaignInvite & { campaignName: string; owner: string; repo: string; gameType: string })
      | undefined
  );
}

export function acceptCampaignInvite(userId: number, token: string) {
  const invite = getCampaignInvite(token);
  if (!invite || invite.revokedAt || invite.acceptedAt) throw new Error("Invite is no longer active.");
  const tx = db.transaction(() => {
    db.prepare("INSERT OR REPLACE INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, ?)").run(invite.campaignId, userId, invite.role);
    db.prepare("UPDATE campaign_invites SET acceptedAt = CURRENT_TIMESTAMP, acceptedBy = ? WHERE id = ?").run(userId, invite.id);
  });
  tx();
  return invite;
}

export function upsertSearchDocuments(campaignId: number, docs: SearchDocument[]) {
  const deleteStmt = db.prepare("DELETE FROM search_index WHERE campaignId = ?");
  const insertStmt = db.prepare(`
    INSERT INTO search_index (
      id, campaignId, campaignName, slug, title, category, summary, tags, aliases,
      visibility, approvalStatus, text, playerText, links, backlinks, keyLinks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    deleteStmt.run(campaignId);
    for (const doc of docs) {
      insertStmt.run(
        doc.id,
        doc.campaignId,
        doc.campaignName,
        doc.slug,
        doc.title,
        doc.category,
        doc.summary,
        doc.tags.join(" "),
        doc.aliases.join(" "),
        doc.visibility,
        doc.approvalStatus,
        doc.text,
        doc.playerText,
        doc.links.join(" "),
        doc.backlinks.join(" "),
        doc.keyLinks.join(" ")
      );
    }
  });
  tx();
}

export type Notification = {
  id: number;
  userId: number;
  campaignId: number | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export function createNotifications(userIds: number[], campaignId: number | null, type: string, title: string, body: string, link: string) {
  const insert = db.prepare("INSERT INTO notifications (userId, campaignId, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)");
  const tx = db.transaction((ids: number[]) => {
    for (const uid of ids) insert.run(uid, campaignId, type, title, body, link);
  });
  tx(userIds);
}

export function listNotifications(userId: number, limit = 30): Notification[] {
  return db.prepare("SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT ?").all(userId, limit) as Notification[];
}

export function countUnreadNotifications(userId: number): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE userId = ? AND readAt IS NULL").get(userId) as { n: number };
  return row.n;
}

export function markNotificationRead(userId: number, notificationId: number) {
  db.prepare("UPDATE notifications SET readAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?").run(notificationId, userId);
}

export function markAllNotificationsRead(userId: number, campaignId?: number) {
  if (campaignId !== undefined) {
    db.prepare("UPDATE notifications SET readAt = CURRENT_TIMESTAMP WHERE userId = ? AND campaignId = ? AND readAt IS NULL").run(userId, campaignId);
  } else {
    db.prepare("UPDATE notifications SET readAt = CURRENT_TIMESTAMP WHERE userId = ? AND readAt IS NULL").run(userId);
  }
}

export function getCampaignGmUserIds(campaignId: number): number[] {
  const rows = db.prepare("SELECT userId FROM campaign_memberships WHERE campaignId = ? AND role IN ('owner', 'gm')").all(campaignId) as { userId: number }[];
  return rows.map((r) => r.userId);
}

export function searchDocs(userId: number, query: string, campaignId?: number, mode: "gm" | "player" = "gm") {
  const campaigns = listCampaigns(userId);
  const ids = campaignId ? campaigns.filter((c) => c.id === campaignId).map((c) => c.id) : campaigns.map((c) => c.id);
  if (!ids.length) return [];
  const table = query.trim() ? "search_index(?)" : "search_index";
  const params: unknown[] = query.trim() ? [query.trim()] : [];
  const roles = new Map(campaigns.map((campaign) => [campaign.id, campaign.role]));
  const rows = db.prepare(`SELECT * FROM ${table} WHERE campaignId IN (${ids.map(() => "?").join(",")}) ORDER BY rank LIMIT 50`).all(...params, ...ids) as any[];
  return rows.filter((row) => {
    const role = roles.get(Number(row.campaignId));
    const playerSafe = row.visibility === "players" && row.approvalStatus === "approved";
    return mode === "player" || role === "player" ? playerSafe : true;
  });
}


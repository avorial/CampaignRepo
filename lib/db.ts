import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ApiToken, Campaign, CampaignMembership, CampaignRole, SearchDocument, User } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
// CAMPAIGNREPO_DB lets tests point at an in-memory (":memory:") database.
const dbPath = process.env.CAMPAIGNREPO_DB || path.join(dataDir, "campaignrepo.sqlite");

if (dbPath !== ":memory:" && !fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

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

export function getDb() {
  return db;
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

export function listUsers() {
  return db
    .prepare(
      `SELECT users.id, users.email, users.name, users.mustChangePassword, users.isAdmin, users.disabled, users.createdAt,
        COUNT(DISTINCT campaign_memberships.campaignId) AS campaignCount
       FROM users
       LEFT JOIN campaign_memberships ON campaign_memberships.userId = users.id
       GROUP BY users.id
       ORDER BY users.createdAt DESC`
    )
    .all() as Array<User & { campaignCount: number }>;
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

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import type { Campaign, CampaignMembership, CampaignRole, SearchDocument, User } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "campaignrepo.sqlite");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

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

const adminHash = bcrypt.hashSync("admin", 12);
db.prepare(
  `INSERT OR IGNORE INTO users (email, name, passwordHash, mustChangePassword)
   VALUES ('admin@example.local', 'admin', ?, 1)`
).run(adminHash);

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
    createdAt: row.createdAt
  };
}

export function getUserById(id: number) {
  return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
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

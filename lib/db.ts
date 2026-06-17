import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Campaign, SearchDocument, User } from "@/lib/types";

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
    createdAt: row.createdAt
  };
}

export function getUserById(id: number) {
  return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

export function getCampaign(userId: number, campaignId: number): Campaign | null {
  return (db.prepare("SELECT * FROM campaigns WHERE userId = ? AND id = ?").get(userId, campaignId) as Campaign | undefined) || null;
}

export function listCampaigns(userId: number): Campaign[] {
  return db.prepare("SELECT * FROM campaigns WHERE userId = ? ORDER BY createdAt DESC").all(userId) as Campaign[];
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
  const rows = db.prepare(`SELECT * FROM ${table} WHERE campaignId IN (${ids.map(() => "?").join(",")}) ORDER BY rank LIMIT 50`).all(...params, ...ids) as any[];
  return rows.filter((row) => mode === "gm" || (row.visibility === "players" && row.approvalStatus === "approved"));
}

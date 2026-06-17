import { describe, it, expect, beforeAll } from "vitest";
import { getDb, canManageCampaign, searchDocs, upsertSearchDocuments, updateCampaignMember, removeCampaignMember } from "@/lib/db";
import type { SearchDocument } from "@/lib/types";

let gmId: number;
let playerId: number;
let campaignId: number;

function doc(slug: string, visibility: "gm" | "players", approvalStatus: "approved" | "unapproved"): SearchDocument {
  return {
    id: `${campaignId}:${slug}`,
    campaignId,
    campaignName: "Test",
    slug,
    title: slug,
    category: "npc",
    summary: "",
    tags: [],
    aliases: [],
    visibility,
    approvalStatus,
    text: "body",
    playerText: "body",
    links: [],
    backlinks: [],
    keyLinks: []
  };
}

beforeAll(() => {
  const db = getDb();
  gmId = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("gm@test", "GM", "x").lastInsertRowid);
  playerId = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("player@test", "Player", "x").lastInsertRowid);
  campaignId = Number(db.prepare("INSERT INTO campaigns (userId, name, owner, repo, gameType) VALUES (?, ?, ?, ?, ?)").run(gmId, "Test", "o", "r", "Fantasy").lastInsertRowid);
  db.prepare("INSERT INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, ?)").run(campaignId, gmId, "owner");
  db.prepare("INSERT INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, ?)").run(campaignId, playerId, "player");
  upsertSearchDocuments(campaignId, [
    doc("secret-npc", "gm", "unapproved"),
    doc("public-npc", "players", "approved")
  ]);
});

describe("role checks", () => {
  it("treats owner/gm as managers and players as not", () => {
    expect(canManageCampaign(gmId, campaignId)).toBe(true);
    expect(canManageCampaign(playerId, campaignId)).toBe(false);
  });

  it("guards owner demotion and removal", () => {
    expect(() => updateCampaignMember(gmId, campaignId, gmId, "player")).toThrow();
    expect(() => removeCampaignMember(gmId, campaignId, gmId)).toThrow();
  });
});

describe("searchDocs visibility", () => {
  it("returns every doc to a GM in gm mode", () => {
    expect(searchDocs(gmId, "", campaignId, "gm")).toHaveLength(2);
  });

  it("hides gm-only and unapproved docs from players", () => {
    const playerView = searchDocs(playerId, "", campaignId, "gm");
    expect(playerView).toHaveLength(1);
    expect(playerView[0].slug).toBe("public-npc");
  });

  it("hides gm-only and unapproved docs in explicit player mode", () => {
    const safe = searchDocs(gmId, "", campaignId, "player");
    expect(safe).toHaveLength(1);
    expect(safe[0].slug).toBe("public-npc");
  });
});

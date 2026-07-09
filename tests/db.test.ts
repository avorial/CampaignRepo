import { describe, it, expect, beforeAll } from "vitest";
import {
  acceptCampaignInvite,
  canManageCampaign,
  createManualUser,
  createCampaignInvite,
  getCampaignRole,
  getCampaignRepositoryToken,
  getDb,
  getPublicSite,
  getPublicSiteCampaign,
  listAllCampaignsForAdmin,
  listUsers,
  listCampaignInvites,
  publishCampaign,
  removeCampaignMember,
  revokeCampaignInvite,
  rotatePublicSlug,
  setUserCampaignMembership,
  searchDocs,
  unpublishCampaign,
  updateUserIdentity,
  updateCampaignMember,
  upsertSearchDocuments
} from "@/lib/db";
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
  campaignId = Number(db.prepare("INSERT INTO campaigns (userId, name, owner, repo, gameType) VALUES (?, ?, ?, ?, ?)").run(gmId, "Test", "o", "r", "Sword Chronicle").lastInsertRowid);
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

describe("campaign invites", () => {
  it("creates and accepts player invites", () => {
    const db = getDb();
    const invitedId = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("invited@test", "Invited", "x").lastInsertRowid);
    const invite = createCampaignInvite(gmId, campaignId, "player");

    expect(invite.token).toMatch(/^invite_/);
    expect(listCampaignInvites(gmId, campaignId).some((item) => item.id === invite.id)).toBe(true);

    const accepted = acceptCampaignInvite(invitedId, invite.token);
    expect(accepted.campaignId).toBe(campaignId);
    expect(getCampaignRole(invitedId, campaignId)).toBe("player");
    expect(() => acceptCampaignInvite(invitedId, invite.token)).toThrow("Invite is no longer active.");
  });

  it("does not accept revoked invites", () => {
    const db = getDb();
    const invitedId = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("revoked@test", "Revoked", "x").lastInsertRowid);
    const invite = createCampaignInvite(gmId, campaignId, "gm");

    revokeCampaignInvite(gmId, campaignId, invite.id);

    expect(() => acceptCampaignInvite(invitedId, invite.token)).toThrow("Invite is no longer active.");
    expect(getCampaignRole(invitedId, campaignId)).toBeNull();
  });
});

describe("global admin user identity", () => {
  it("creates manual users who must change password", () => {
    const id = createManualUser("manual@test", "Manual User", "hash");
    const user = getDb().prepare("SELECT email, name, mustChangePassword FROM users WHERE id = ?").get(id) as { email: string; name: string; mustChangePassword: number };

    expect(user).toEqual({ email: "manual@test", name: "Manual User", mustChangePassword: 1 });
  });

  it("lists campaign memberships for global admin", () => {
    const users = listUsers();
    const player = users.find((user) => user.id === playerId);

    expect(player?.campaignCount).toBe(1);
    expect(player?.campaigns).toEqual([
      expect.objectContaining({ id: campaignId, name: "Test", role: "player" })
    ]);
  });

  it("finds the campaign owner's GitHub token for shared reads", () => {
    const db = getDb();
    db.prepare("UPDATE users SET githubToken = ? WHERE id = ?").run("owner-token", gmId);

    expect(getCampaignRepositoryToken(campaignId)).toBe("owner-token");
  });

  it("falls back to a GM GitHub token for shared reads", () => {
    const db = getDb();
    const gmHelperId = Number(db.prepare("INSERT INTO users (email, name, passwordHash, githubToken) VALUES (?, ?, ?, ?)").run("token-gm@test", "Token GM", "x", "gm-token").lastInsertRowid);
    db.prepare("UPDATE users SET githubToken = NULL WHERE id = ?").run(gmId);
    db.prepare("INSERT INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, ?)").run(campaignId, gmHelperId, "gm");

    expect(getCampaignRepositoryToken(campaignId)).toBe("gm-token");
  });

  it("lets global admin edit a user's campaign memberships", () => {
    const db = getDb();
    const id = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("member-edit@test", "Member Edit", "x").lastInsertRowid);

    expect(listAllCampaignsForAdmin()).toEqual([
      expect.objectContaining({ id: campaignId, name: "Test" })
    ]);

    setUserCampaignMembership(id, campaignId, "player");
    expect(getCampaignRole(id, campaignId)).toBe("player");

    setUserCampaignMembership(id, campaignId, "gm");
    expect(getCampaignRole(id, campaignId)).toBe("gm");

    setUserCampaignMembership(id, campaignId, null);
    expect(getCampaignRole(id, campaignId)).toBeNull();
  });

  it("updates a user's login email and display name", () => {
    const db = getDb();
    const id = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("rename@test", "Rename", "x").lastInsertRowid);

    updateUserIdentity(id, "renamed@test", "Renamed User");

    const user = db.prepare("SELECT email, name FROM users WHERE id = ?").get(id) as { email: string; name: string };
    expect(user).toEqual({ email: "renamed@test", name: "Renamed User" });
  });

  it("rejects duplicate login emails", () => {
    const db = getDb();
    const id = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("duplicate-source@test", "Source", "x").lastInsertRowid);
    db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("duplicate-target@test", "Target", "x");

    expect(() => updateUserIdentity(id, "duplicate-target@test", "Source")).toThrow("Another user already has that email.");
  });
});

describe("public sites", () => {
  function createOwnedCampaign(name: string) {
    const db = getDb();
    const id = Number(db.prepare("INSERT INTO campaigns (userId, name, owner, repo, gameType) VALUES (?, ?, ?, ?, ?)").run(gmId, name, "o", `repo-${name}`, "Sword Chronicle").lastInsertRowid);
    db.prepare("INSERT INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, ?)").run(id, gmId, "owner");
    return id;
  }

  it("publishes a campaign to a resolvable, enabled share slug", () => {
    const site = publishCampaign(gmId, campaignId);
    expect(site.slug).toMatch(/^pub_/);
    expect(site.enabled).toBe(true);
    const resolved = getPublicSiteCampaign(site.slug);
    expect(resolved?.id).toBe(campaignId);
  });

  it("keeps the same slug across republish and stops resolving when offline", () => {
    const first = publishCampaign(gmId, campaignId);
    unpublishCampaign(gmId, campaignId);
    expect(getPublicSite(campaignId)?.enabled).toBe(false);
    expect(getPublicSiteCampaign(first.slug)).toBeNull();
    const again = publishCampaign(gmId, campaignId);
    expect(again.slug).toBe(first.slug);
    expect(getPublicSiteCampaign(first.slug)?.id).toBe(campaignId);
  });

  it("rotates the slug and invalidates the previous link", () => {
    const before = publishCampaign(gmId, campaignId);
    const after = rotatePublicSlug(gmId, campaignId);
    expect(after.slug).not.toBe(before.slug);
    expect(getPublicSiteCampaign(before.slug)).toBeNull();
    expect(getPublicSiteCampaign(after.slug)?.id).toBe(campaignId);
  });

  it("publishes with a custom URL-safe link name", () => {
    const id = createOwnedCampaign("Custom Public");

    const site = publishCampaign(gmId, id, "Lanterns in the Fog!");

    expect(site.slug).toBe("lanterns-in-the-fog");
    expect(getPublicSiteCampaign("lanterns-in-the-fog")?.id).toBe(id);
  });

  it("can rename an existing public link while republishing", () => {
    const id = createOwnedCampaign("Rename Public");
    const first = publishCampaign(gmId, id, "old-link");

    const renamed = publishCampaign(gmId, id, "new-link");

    expect(first.slug).toBe("old-link");
    expect(renamed.slug).toBe("new-link");
    expect(getPublicSiteCampaign("old-link")).toBeNull();
    expect(getPublicSiteCampaign("new-link")?.id).toBe(id);
  });

  it("rejects custom public link names already owned by another campaign", () => {
    const first = createOwnedCampaign("First Public");
    const second = createOwnedCampaign("Second Public");
    publishCampaign(gmId, first, "shared-link");

    expect(() => publishCampaign(gmId, second, "shared-link")).toThrow("That public link name is already taken.");
  });

  it("forbids players from publishing", () => {
    expect(() => publishCampaign(playerId, campaignId)).toThrow("Forbidden");
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

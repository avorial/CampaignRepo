import { describe, it, expect, beforeAll, vi } from "vitest";

// Keep GitHub and the search rebuild out of the test; the route only needs to
// reach its auth/role logic and the unapproved-status write path.
vi.mock("@/lib/github", () => ({
  getTextFile: vi.fn(async () => ({ sha: "sha", text: "---\nname: Existing\n---\nbody" })),
  putFile: vi.fn(async () => {}),
  listDirectory: vi.fn(async () => [])
}));
vi.mock("@/lib/search", () => ({ scheduleSearchIndexRebuild: vi.fn() }));

import { POST } from "@/app/api/mcp/route";
import { getDb, createApiToken } from "@/lib/db";

let campaignId: number;
let gmToken: string;
let playerToken: string;

function call(body: unknown, token?: string) {
  return POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(body)
    })
  );
}

beforeAll(() => {
  const db = getDb();
  const gmId = Number(db.prepare("INSERT INTO users (email, name, passwordHash, githubToken) VALUES (?, ?, ?, ?)").run("gm@mcp", "GM", "x", "ghp_test").lastInsertRowid);
  const playerId = Number(db.prepare("INSERT INTO users (email, name, passwordHash, githubToken) VALUES (?, ?, ?, ?)").run("player@mcp", "Player", "x", "ghp_test").lastInsertRowid);
  campaignId = Number(db.prepare("INSERT INTO campaigns (userId, name, owner, repo, gameType) VALUES (?, ?, ?, ?, ?)").run(gmId, "C", "o", "r", "Sword Chronicle").lastInsertRowid);
  db.prepare("INSERT INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, ?)").run(campaignId, gmId, "owner");
  db.prepare("INSERT INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, ?)").run(campaignId, playerId, "player");
  gmToken = createApiToken(gmId, "gm").token;
  playerToken = createApiToken(playerId, "player").token;
});

describe("MCP route", () => {
  it("completes the initialize handshake without auth", async () => {
    const res = await call({ jsonrpc: "2.0", id: 0, method: "initialize", params: {} });
    const json = await res.json();
    expect(json.result.serverInfo.name).toContain("CampaignRepo");
    expect(json.result.protocolVersion).toBeTruthy();
  });

  it("creates AI pages as unapproved", async () => {
    const res = await call(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_page", arguments: { campaignId, name: "New NPC" } } },
      gmToken
    );
    const json = await res.json();
    const payload = JSON.parse(json.result.content[0].text);
    expect(payload.approvalStatus).toBe("unapproved");
    expect(payload.slug).toBe("New-NPC");
  });

  it("forbids players from creating pages", async () => {
    await expect(
      call(
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "create_page", arguments: { campaignId, name: "Sneaky" } } },
        playerToken
      )
    ).rejects.toThrow("Forbidden");
  });

  it("rejects data calls with no credentials", async () => {
    const res = await call({ jsonrpc: "2.0", id: 3, method: "resources/list", params: {} });
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error.message).toBe("Unauthorized");
  });
});

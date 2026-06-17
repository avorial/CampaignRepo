import { describe, it, expect, beforeAll } from "vitest";
import { hashPassword, verifyPassword, requireApiUser } from "@/lib/auth";
import { getDb, createApiToken } from "@/lib/db";

let userId: number;
let token: string;

beforeAll(() => {
  const db = getDb();
  userId = Number(db.prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)").run("api@test", "API", "x").lastInsertRowid);
  token = createApiToken(userId, "test client").token;
});

describe("password hashing", () => {
  it("verifies correct passwords and rejects wrong ones", async () => {
    const hash = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("requireApiUser bearer auth", () => {
  it("authenticates a valid bearer token", async () => {
    const req = new Request("http://localhost/api/mcp", { headers: { Authorization: `Bearer ${token}` } });
    const user = await requireApiUser(req);
    expect(user.id).toBe(userId);
  });

  it("rejects an invalid bearer token", async () => {
    const req = new Request("http://localhost/api/mcp", { headers: { Authorization: "Bearer crepo_nope" } });
    await expect(requireApiUser(req)).rejects.toThrow("Unauthorized");
  });
});

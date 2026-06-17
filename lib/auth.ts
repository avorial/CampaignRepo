import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb, publicUser } from "@/lib/db";

const cookieName = "campaignrepo_session";

export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare("SELECT users.* FROM sessions JOIN users ON users.id = sessions.userId WHERE sessions.token = ? AND sessions.expiresAt > CURRENT_TIMESTAMP")
    .get(token);
  return publicUser(row);
}

export async function requireUser(options: { allowPasswordChange?: boolean } = {}) {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  if (user.mustChangePassword && !options.allowPasswordChange) throw new Error("Password change required");
  return user;
}

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  getDb()
    .prepare("INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, datetime('now', '+30 days'))")
    .run(token, userId);
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  (await cookies()).delete(cookieName);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

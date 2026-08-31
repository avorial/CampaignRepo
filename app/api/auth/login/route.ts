import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkLogin, recordFailure, recordSuccess, clientIp } from "@/lib/login-throttle";

export const dynamic = "force-dynamic";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  const input = schema.parse(await req.json());
  const login = input.login.toLowerCase();
  // Throttle by both the account being tried and the client address.
  const keys = [`login:${login}`, `ip:${clientIp(req)}`];

  const gate = checkLogin(keys);
  if (!gate.allowed) {
    const minutes = Math.max(1, Math.ceil(gate.retryAfterSec / 60));
    return NextResponse.json(
      { error: `Too many sign-in attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } }
    );
  }

  const row = getDb().prepare("SELECT * FROM users WHERE lower(email) = ? OR lower(name) = ?").get(login, login) as any;
  if (row?.disabled) {
    return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
  }
  if (!row || !(await verifyPassword(input.password, row.passwordHash))) {
    recordFailure(keys);
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  recordSuccess(keys);
  await createSession(row.id);
  return NextResponse.json({ ok: true, mustChangePassword: Boolean(row.mustChangePassword) });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  const input = schema.parse(await req.json());
  const login = input.login.toLowerCase();
  const row = getDb().prepare("SELECT * FROM users WHERE lower(email) = ? OR lower(name) = ?").get(login, login) as any;
  if (row?.disabled) {
    return NextResponse.json({ error: "This account is disabled." }, { status: 403 });
  }
  if (!row || !(await verifyPassword(input.password, row.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  await createSession(row.id);
  return NextResponse.json({ ok: true, mustChangePassword: Boolean(row.mustChangePassword) });
}

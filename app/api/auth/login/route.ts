import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  const input = schema.parse(await req.json());
  const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(input.email.toLowerCase()) as any;
  if (!row || !(await verifyPassword(input.password, row.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  await createSession(row.id);
  return NextResponse.json({ ok: true });
}

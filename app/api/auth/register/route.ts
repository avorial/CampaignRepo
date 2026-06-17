import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8)
});

export async function POST(req: Request) {
  const input = schema.parse(await req.json());
  const passwordHash = await hashPassword(input.password);
  try {
    const result = getDb()
      .prepare("INSERT INTO users (email, name, passwordHash) VALUES (?, ?, ?)")
      .run(input.email.toLowerCase(), input.name, passwordHash);
    await createSession(Number(result.lastInsertRowid));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 400 });
  }
}

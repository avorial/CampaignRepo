import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getViewer } from "@/lib/github";

const schema = z.object({ token: z.string().min(20) });

export async function POST(req: Request) {
  const user = await requireUser();
  const { token } = schema.parse(await req.json());
  const viewer = await getViewer(token);
  getDb().prepare("UPDATE users SET githubToken = ? WHERE id = ?").run(token, user.id);
  return NextResponse.json({ login: viewer.login });
}

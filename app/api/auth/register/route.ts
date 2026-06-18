import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { acceptCampaignInvite, getDb } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  inviteToken: z.string().optional()
});

export async function POST(req: Request) {
  const input = schema.parse(await req.json());
  const passwordHash = await hashPassword(input.password);
  try {
    const result = getDb()
      .prepare("INSERT INTO users (email, name, passwordHash, mustChangePassword) VALUES (?, ?, ?, 0)")
      .run(input.email.toLowerCase(), input.name, passwordHash);
    const userId = Number(result.lastInsertRowid);
    let campaignId: number | undefined;
    if (input.inviteToken) {
      const invite = acceptCampaignInvite(userId, input.inviteToken);
      campaignId = invite.campaignId;
    }
    await createSession(userId);
    return NextResponse.json({ ok: true, campaignId });
  } catch {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 400 });
  }
}

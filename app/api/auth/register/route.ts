import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { acceptCampaignInvite, getCampaignInvite, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  inviteToken: z.string().optional()
});

/**
 * Registration is invitation-only by default: the operator provisions accounts
 * from the admin panel (like Calibre-Web), and GMs bring players in via campaign
 * invites. An operator who wants an open, public sign-up form can set
 * ALLOW_OPEN_REGISTRATION=1.
 */
const openRegistration = process.env.ALLOW_OPEN_REGISTRATION === "1";

export async function POST(req: Request) {
  const input = schema.parse(await req.json());
  if (input.inviteToken) {
    const invite = getCampaignInvite(input.inviteToken);
    if (!invite || invite.revokedAt || invite.acceptedAt) {
      return NextResponse.json({ error: "Invite is no longer active." }, { status: 400 });
    }
  } else if (!openRegistration) {
    return NextResponse.json(
      { error: "This server is invite-only. Ask your GM for a campaign invite, or the server's admin to create your account." },
      { status: 403 }
    );
  }

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

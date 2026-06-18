import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { acceptCampaignInvite, getCampaignInvite } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = getCampaignInvite(token);
  if (!invite || invite.revokedAt || invite.acceptedAt) {
    return NextResponse.json({ error: "Invite is no longer active." }, { status: 404 });
  }
  return NextResponse.json({ invite });
}

export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await requireUser();
  const { token } = await params;
  try {
    const invite = acceptCampaignInvite(user.id, token);
    return NextResponse.json({ campaignId: invite.campaignId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not accept invite." }, { status: 400 });
  }
}

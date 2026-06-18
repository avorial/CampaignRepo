import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createCampaignInvite, getCampaign, listCampaignInvites, revokeCampaignInvite } from "@/lib/db";

const createSchema = z.object({
  role: z.enum(["gm", "player"])
});

const revokeSchema = z.object({
  inviteId: z.number().int().positive()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const invites = listCampaignInvites(user.id, campaign.id);
  if (!invites.length && campaign.role !== "owner" && campaign.role !== "gm") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ invites });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = createSchema.parse(await req.json());
  try {
    createCampaignInvite(user.id, campaign.id, input.role);
    return NextResponse.json({ invites: listCampaignInvites(user.id, campaign.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create invite." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = revokeSchema.parse(await req.json());
  try {
    revokeCampaignInvite(user.id, campaign.id, input.inviteId);
    return NextResponse.json({ invites: listCampaignInvites(user.id, campaign.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not revoke invite." }, { status: 400 });
  }
}

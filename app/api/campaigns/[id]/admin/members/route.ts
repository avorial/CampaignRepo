import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { addCampaignMember, getCampaign, listCampaignMembers, removeCampaignMember, updateCampaignMember } from "@/lib/db";

const roleSchema = z.enum(["gm", "player"]);

const addSchema = z.object({
  email: z.string().email(),
  role: roleSchema
});

const updateSchema = z.object({
  userId: z.number(),
  role: roleSchema
});

const deleteSchema = z.object({
  userId: z.number()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const members = listCampaignMembers(user.id, campaign.id);
  if (!members.length && campaign.role !== "owner" && campaign.role !== "gm") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ campaign, members });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = addSchema.parse(await req.json());
  try {
    addCampaignMember(user.id, campaign.id, input.email, input.role);
    return NextResponse.json({ ok: true, members: listCampaignMembers(user.id, campaign.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add member." }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = updateSchema.parse(await req.json());
  try {
    updateCampaignMember(user.id, campaign.id, input.userId, input.role);
    return NextResponse.json({ ok: true, members: listCampaignMembers(user.id, campaign.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update member." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = deleteSchema.parse(await req.json());
  try {
    removeCampaignMember(user.id, campaign.id, input.userId);
    return NextResponse.json({ ok: true, members: listCampaignMembers(user.id, campaign.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove member." }, { status: 400 });
  }
}

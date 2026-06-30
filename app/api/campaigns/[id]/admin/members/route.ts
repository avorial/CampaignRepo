import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireUser } from "@/lib/auth";
import { addCampaignMember, createManualUser, getCampaign, listCampaignMembers, removeCampaignMember, setMemberGroups, transferCampaignOwnership, updateCampaignMember } from "@/lib/db";

const roleSchema = z.enum(["gm", "player"]);

const addSchema = z.object({
  email: z.string().email(),
  role: roleSchema,
  name: z.string().trim().min(1).optional(),
  createAccount: z.boolean().optional()
});

const updateSchema = z.object({
  userId: z.number(),
  // "owner" is allowed here but is an ownership transfer, gated separately below.
  role: z.enum(["gm", "player", "owner"]).optional(),
  groups: z.array(z.string()).optional()
});

const deleteSchema = z.object({
  userId: z.number()
});

function temporaryPassword() {
  return `cr-${crypto.randomBytes(9).toString("base64url")}`;
}

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
  if (campaign.role !== "owner" && campaign.role !== "gm") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = addSchema.parse(await req.json());
  try {
    let temporaryPasswordValue: string | undefined;
    if (input.createAccount) {
      if (!input.name) throw new Error("Name is required to create an account.");
      temporaryPasswordValue = temporaryPassword();
      createManualUser(input.email, input.name, await hashPassword(temporaryPasswordValue));
    }
    addCampaignMember(user.id, campaign.id, input.email, input.role);
    return NextResponse.json({ ok: true, members: listCampaignMembers(user.id, campaign.id), temporaryPassword: temporaryPasswordValue });
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
    if (input.groups !== undefined) {
      setMemberGroups(user.id, campaign.id, input.userId, input.groups);
    }
    if (input.role !== undefined) {
      if (input.role === "owner") {
        if (!user.isAdmin && campaign.role !== "owner") {
          return NextResponse.json({ error: "Only the current owner or a global admin can transfer ownership." }, { status: 403 });
        }
        transferCampaignOwnership(campaign.id, input.userId);
      } else {
        updateCampaignMember(user.id, campaign.id, input.userId, input.role);
      }
    }
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

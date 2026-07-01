import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, requireUser } from "@/lib/auth";
import { createManualUser, listAllCampaignsForAdmin, listUsers, resetUserPassword, setUserAdmin, setUserCampaignMembership, setUserDisabled, updateUserIdentity } from "@/lib/db";

export const dynamic = "force-dynamic";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reset-password"),
    userId: z.number().int().positive()
  }),
  z.object({
    action: z.literal("set-disabled"),
    userId: z.number().int().positive(),
    disabled: z.boolean()
  }),
  z.object({
    action: z.literal("set-admin"),
    userId: z.number().int().positive(),
    isAdmin: z.boolean()
  }),
  z.object({
    action: z.literal("update-identity"),
    userId: z.number().int().positive(),
    email: z.string().email(),
    name: z.string().trim().min(1)
  }),
  z.object({
    action: z.literal("set-campaign-membership"),
    userId: z.number().int().positive(),
    campaignId: z.number().int().positive(),
    role: z.enum(["gm", "player"]).nullable()
  })
]);

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1),
  isAdmin: z.boolean().optional()
});

function temporaryPassword() {
  return `cr-${crypto.randomBytes(9).toString("base64url")}`;
}

export async function GET() {
  const user = await requireUser();
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ users: listUsers(), campaigns: listAllCampaignsForAdmin() });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = createSchema.parse(await req.json());
  const password = temporaryPassword();

  try {
    createManualUser(input.email, input.name, await hashPassword(password), Boolean(input.isAdmin));
    return NextResponse.json({ users: listUsers(), campaigns: listAllCampaignsForAdmin(), temporaryPassword: password });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "User creation failed." }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = actionSchema.parse(await req.json());

  try {
    if (input.action === "reset-password") {
      const password = temporaryPassword();
      resetUserPassword(input.userId, await hashPassword(password));
      return NextResponse.json({ users: listUsers(), campaigns: listAllCampaignsForAdmin(), temporaryPassword: password });
    }

    if (input.action === "set-disabled") {
      setUserDisabled(user.id, input.userId, input.disabled);
      return NextResponse.json({ users: listUsers(), campaigns: listAllCampaignsForAdmin() });
    }

    if (input.action === "update-identity") {
      updateUserIdentity(input.userId, input.email, input.name);
      return NextResponse.json({ users: listUsers(), campaigns: listAllCampaignsForAdmin() });
    }

    if (input.action === "set-campaign-membership") {
      setUserCampaignMembership(input.userId, input.campaignId, input.role);
      return NextResponse.json({ users: listUsers(), campaigns: listAllCampaignsForAdmin() });
    }

    setUserAdmin(user.id, input.userId, input.isAdmin);
    return NextResponse.json({ users: listUsers(), campaigns: listAllCampaignsForAdmin() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "User update failed." }, { status: 400 });
  }
}

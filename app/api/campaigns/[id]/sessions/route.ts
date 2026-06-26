import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { createSession, listSessions } from "@/lib/sessions";

const createSchema = z.object({
  title: z.string().trim().min(1),
  date: z.string().trim().optional()
});

async function guard(id: string) {
  const user = await requireUser();
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canManageCampaign(user.id, campaign.id)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, campaign };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, campaign, error } = await guard(id);
  if (error) return error;
  return NextResponse.json({ sessions: await listSessions(campaign, user.githubToken) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, campaign, error } = await guard(id);
  if (error) return error;
  const input = createSchema.parse(await req.json());
  const session = await createSession(campaign, input.title, input.date || undefined, user.githubToken);
  return NextResponse.json({ session });
}

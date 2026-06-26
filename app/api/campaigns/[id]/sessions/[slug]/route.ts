import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { deleteSession, getSession, saveSession } from "@/lib/sessions";
import { isNotFoundError } from "@/lib/storage";

const saveSchema = z.object({
  frontmatter: z.object({
    title: z.string().trim().min(1),
    date: z.string().trim().optional(),
    status: z.string().trim().optional(),
    agenda: z.array(z.object({ text: z.string(), done: z.boolean() })).default([]),
    pinned: z.array(z.string()).default([])
  }),
  notes: z.string().default("")
});

async function guard(id: string) {
  const user = await requireUser();
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canManageCampaign(user.id, campaign.id)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, campaign };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const { user, campaign, error } = await guard(id);
  if (error) return error;
  try {
    return NextResponse.json({ session: await getSession(campaign, slug, user.githubToken) });
  } catch (e) {
    if (isNotFoundError(e)) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    throw e;
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const { user, campaign, error } = await guard(id);
  if (error) return error;
  const input = saveSchema.parse(await req.json());
  const session = await saveSession(campaign, slug, { ...input.frontmatter, date: input.frontmatter.date || undefined }, input.notes, user.githubToken);
  return NextResponse.json({ session });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const { user, campaign, error } = await guard(id);
  if (error) return error;
  await deleteSession(campaign, slug, user.githubToken);
  return NextResponse.json({ ok: true });
}

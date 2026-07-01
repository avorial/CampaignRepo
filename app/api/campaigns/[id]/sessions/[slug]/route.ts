import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { deleteSession, getSession, saveSession } from "@/lib/sessions";
import { isNotFoundError } from "@/lib/storage";

export const dynamic = "force-dynamic";

const attendeeSchema = z.object({
  name: z.string(),
  status: z.enum(["present", "late", "left-early", "absent"])
});

const assetSchema = z.object({
  label: z.string(),
  url: z.string()
});

const saveSchema = z.object({
  frontmatter: z.object({
    title: z.string().trim().min(1),
    number: z.number().int().positive().optional(),
    date: z.string().trim().optional(),
    worldDate: z.object({ year: z.number().int(), month: z.number().int(), day: z.number().int() }).optional(),
    status: z.enum(["planned", "played", "cancelled"]).optional(),
    mood: z.string().trim().optional(),
    arc: z.string().trim().optional(),
    attendees: z.array(attendeeSchema).default([]),
    assets: z.array(assetSchema).default([]),
    agenda: z.array(z.object({ text: z.string(), done: z.boolean() })).default([]),
    summary: z.string().optional(),
    npcs: z.array(z.string()).default([]),
    locations: z.array(z.string()).default([]),
    threads: z.array(z.object({ text: z.string(), done: z.boolean() })).default([]),
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
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  try {
    return NextResponse.json({ session: await getSession(campaign, slug, user.githubToken) });
  } catch (e) {
    if (isNotFoundError(e)) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    throw e;
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  const input = saveSchema.parse(await req.json());
  const fm = input.frontmatter;
  const session = await saveSession(
    campaign,
    slug,
    {
      ...fm,
      date: fm.date || undefined,
      worldDate: fm.worldDate || undefined,
      status: fm.status || undefined,
      mood: fm.mood || undefined,
      arc: fm.arc || undefined,
      number: fm.number || undefined,
      summary: fm.summary || undefined
    },
    input.notes,
    user.githubToken
  );
  return NextResponse.json({ session });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  await deleteSession(campaign, slug, user.githubToken);
  return NextResponse.json({ ok: true });
}

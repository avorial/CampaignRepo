import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { deleteQuest, getQuest, QUEST_STATUSES, saveQuest } from "@/lib/quests";
import { isNotFoundError } from "@/lib/storage";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  frontmatter: z.object({
    title: z.string().trim().min(1),
    status: z.enum(QUEST_STATUSES),
    arc: z.string().trim().optional(),
    reward: z.string().trim().optional(),
    visibility: z.enum(["gm", "players"]),
    objectives: z.array(z.object({ text: z.string(), done: z.boolean() })).default([]),
    participants: z.array(z.string()).default([]),
    locations: z.array(z.string()).default([]),
    clocks: z.array(z.object({ name: z.string(), segments: z.number().int().min(2).max(20), filled: z.number().int().min(0) })).default([]),
    worldDate: z.object({ year: z.number().int().min(1), month: z.number().int().min(1), day: z.number().int().min(1) }).optional()
  }),
  description: z.string().default("")
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
    return NextResponse.json({ quest: await getQuest(campaign, slug, user.githubToken) });
  } catch (e) {
    if (isNotFoundError(e)) return NextResponse.json({ error: "Quest not found" }, { status: 404 });
    throw e;
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  const input = saveSchema.parse(await req.json());
  const quest = await saveQuest(
    campaign,
    slug,
    { ...input.frontmatter, arc: input.frontmatter.arc || undefined, reward: input.frontmatter.reward || undefined },
    input.description,
    user.githubToken
  );
  return NextResponse.json({ quest });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  await deleteQuest(campaign, slug, user.githubToken);
  return NextResponse.json({ ok: true });
}

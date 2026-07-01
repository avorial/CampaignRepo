import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getLexicon, saveLexicon } from "@/lib/lexicon";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const entrySchema = z.object({
  id: z.string().optional(),
  term: z.string().trim().min(1),
  translation: z.string().trim().optional(),
  pronunciation: z.string().trim().optional(),
  wordClass: z.string().trim().optional(),
  etymology: z.string().trim().optional(),
  notes: z.string().trim().optional()
});

const saveSchema = z.object({
  terms: z.array(entrySchema),
  phonemes: z.object({
    vowels: z.array(z.string()).optional(),
    consonants: z.array(z.string()).optional()
  }).optional(),
  patterns: z.array(z.string()).optional()
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
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  const { data } = await getLexicon(campaign, user.githubToken);
  return NextResponse.json({ lexicon: data });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  const input = saveSchema.parse(await req.json());
  const { sha } = await getLexicon(campaign, user.githubToken);
  const terms = input.terms.map((t) => ({
    ...t,
    id: t.id || slugify(t.term) || Math.random().toString(36).slice(2)
  }));
  await saveLexicon(campaign, { terms, phonemes: input.phonemes, patterns: input.patterns }, sha, user.githubToken);
  return NextResponse.json({ ok: true });
}

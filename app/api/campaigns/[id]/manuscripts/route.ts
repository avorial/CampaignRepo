import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { listManuscripts, saveManuscript, manuscriptSlug } from "@/lib/manuscripts";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  visibility: z.enum(["gm", "players"]).default("gm"),
  pages: z.array(z.string()).default([])
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage" }, { status: 400 });
  const manuscripts = await listManuscripts(storage);
  return NextResponse.json({ manuscripts });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage" }, { status: 400 });
  const input = createSchema.parse(await req.json());
  const slug = manuscriptSlug(input.title);
  await saveManuscript(storage, slug, input, undefined, `CampaignRepo: create manuscript "${input.title}"`);
  return NextResponse.json({ slug });
}

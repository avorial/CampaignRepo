import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { getManuscript, saveManuscript, deleteManuscript } from "@/lib/manuscripts";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  visibility: z.enum(["gm", "players"]).default("gm"),
  pages: z.array(z.string()).default([])
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage" }, { status: 400 });
  const manuscript = await getManuscript(storage, slug);
  if (!manuscript) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ manuscript });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage" }, { status: 400 });
  const body = await req.json();
  const input = updateSchema.parse(body);
  const existing = await getManuscript(storage, slug);
  await saveManuscript(storage, slug, input, existing?.sha, `CampaignRepo: update manuscript "${input.title}"`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage" }, { status: 400 });
  const existing = await getManuscript(storage, slug);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteManuscript(storage, slug, existing.sha || "", `CampaignRepo: delete manuscript "${existing.title}"`);
  return NextResponse.json({ ok: true });
}

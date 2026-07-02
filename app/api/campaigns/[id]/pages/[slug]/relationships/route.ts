import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage, serializePage } from "@/lib/markdown";
import { scheduleSearchIndexRebuild } from "@/lib/search";

export const dynamic = "force-dynamic";

const addSchema = z.object({
  type: z.string().min(1).max(60),
  target: z.string().min(1).max(200),
  label: z.string().max(120).optional(),
  notes: z.string().max(500).optional()
});

const removeSchema = z.object({
  type: z.string().min(1),
  target: z.string().min(1)
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage" }, { status: 400 });

  const input = addSchema.parse(await req.json());
  const filePath = `wiki/pages/${slug}.md`;

  const file = await storage.getTextFile(filePath);
  const page = parsePage(slug, file.text, file.sha);

  const existing = page.frontmatter.relationships || [];
  const isDupe = existing.some((r) => r.type === input.type && r.target === input.target);
  if (isDupe) return NextResponse.json({ error: "Relationship already exists." }, { status: 409 });

  const newRel = { type: input.type, target: input.target, ...(input.label ? { label: input.label } : {}), ...(input.notes ? { notes: input.notes } : {}) };
  const updated = { ...page.frontmatter, relationships: [...existing, newRel] };

  await storage.putFile(filePath, serializePage(updated, page.content), `CampaignRepo: add relationship to ${page.frontmatter.name || slug}`, file.sha);
  scheduleSearchIndexRebuild(campaign);
  return NextResponse.json({ ok: true, relationship: newRel });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage" }, { status: 400 });

  const input = removeSchema.parse(await req.json());
  const filePath = `wiki/pages/${slug}.md`;

  const file = await storage.getTextFile(filePath);
  const page = parsePage(slug, file.text, file.sha);

  const filtered = (page.frontmatter.relationships || []).filter((r) => !(r.type === input.type && r.target === input.target));
  if (filtered.length === (page.frontmatter.relationships || []).length) {
    return NextResponse.json({ error: "Relationship not found." }, { status: 404 });
  }

  const updated = { ...page.frontmatter, relationships: filtered };
  await storage.putFile(filePath, serializePage(updated, page.content), `CampaignRepo: remove relationship from ${page.frontmatter.name || slug}`, file.sha);
  scheduleSearchIndexRebuild(campaign);
  return NextResponse.json({ ok: true });
}

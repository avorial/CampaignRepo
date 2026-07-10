import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, deleteSearchDocument, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage, serializePage } from "@/lib/markdown";
import { removePageFromCache } from "@/lib/page-cache";
import { rebuildSearchIndex } from "@/lib/search";

export const dynamic = "force-dynamic";

const schema = z.object({
  slugs: z.array(z.string().min(1)).min(1),
  set: z
    .object({
      category: z.string().min(1).max(40).regex(/^[a-z0-9_/-]+$/).optional(),
      visibility: z.enum(["gm", "players"]).optional(),
      approvalStatus: z.enum(["approved", "unapproved", "rejected"]).optional(),
      parent: z.string().optional()
    })
    .optional(),
  addTags: z.array(z.string().min(1)).optional(),
  removeTags: z.array(z.string().min(1)).optional()
}).refine(
  (d) => (d.set && Object.values(d.set).some((v) => v !== undefined)) || (d.addTags?.length ?? 0) > 0 || (d.removeTags?.length ?? 0) > 0,
  { message: "Provide at least one field to change." }
);

const deleteSchema = z.object({
  slugs: z.array(z.string().min(1)).min(1)
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = schema.parse(await req.json());
  const wanted = new Set(input.slugs);

  const files = await storage.listDirectoryTextFiles("wiki/pages");
  const updates: { path: string; content: string }[] = [];
  for (const file of files) {
    const slug = file.name.replace(/\.md$/, "");
    if (!wanted.has(slug)) continue;
    const page = parsePage(slug, file.text ?? "", file.sha);
    const fm = { ...page.frontmatter, lastEditedBy: `${user.name} via bulk edit` };
    if (input.set?.category) { fm.category = input.set.category; fm.type = input.set.category; }
    if (input.set?.visibility) { fm.visibility = input.set.visibility; fm.knownToPlayers = input.set.visibility === "players"; }
    if (input.set?.approvalStatus) fm.approvalStatus = input.set.approvalStatus;
    if (input.set?.parent !== undefined) {
      if (input.set.parent === "") delete fm.parent;
      else fm.parent = input.set.parent;
    }
    if (input.addTags?.length || input.removeTags?.length) {
      const existing = new Set(fm.tags || []);
      for (const tag of input.addTags ?? []) existing.add(tag);
      for (const tag of input.removeTags ?? []) existing.delete(tag);
      fm.tags = [...existing].sort();
    }
    updates.push({ path: `wiki/pages/${slug}.md`, content: serializePage(fm, page.content) });
  }

  if (updates.length) {
    await storage.commitFiles(updates, `CampaignRepo: bulk edit ${updates.length} pages`);
    await rebuildSearchIndex(storage, campaign);
  }
  return NextResponse.json({ ok: true, updated: updates.length });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = deleteSchema.parse(await req.json());
  const wanted = new Set(input.slugs);
  const files = await storage.listDirectoryTextFiles("wiki/pages");
  const deletes = files
    .map((file) => file.name.replace(/\.md$/, ""))
    .filter((slug) => wanted.has(slug))
    .map((slug) => ({ path: `wiki/pages/${slug}.md`, delete: true as const }));

  if (deletes.length) {
    await storage.commitFiles(deletes, `CampaignRepo: bulk delete ${deletes.length} pages`);
    for (const slug of deletes.map((file) => file.path.replace(/^wiki\/pages\//, "").replace(/\.md$/, ""))) {
      removePageFromCache(campaign.id, slug);
      deleteSearchDocument(campaign.id, slug);
    }
    await rebuildSearchIndex(storage, campaign);
  }

  return NextResponse.json({ ok: true, deleted: deletes.length, missing: input.slugs.length - deletes.length });
}

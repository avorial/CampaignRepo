import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage, serializePage } from "@/lib/markdown";
import { scheduleSearchIndexRebuild } from "@/lib/search";

const schema = z.object({
  slugs: z.array(z.string().min(1)).min(1),
  set: z
    .object({
      category: z.string().min(1).max(40).regex(/^[a-z0-9_/-]+$/).optional(),
      visibility: z.enum(["gm", "players"]).optional(),
      approvalStatus: z.enum(["approved", "unapproved", "rejected"]).optional(),
      parent: z.string().optional()
    })
    .refine((set) => Object.values(set).some((value) => value !== undefined), { message: "Provide at least one field to change." })
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
    if (input.set.category) { fm.category = input.set.category; fm.type = input.set.category; }
    if (input.set.visibility) { fm.visibility = input.set.visibility; fm.knownToPlayers = input.set.visibility === "players"; }
    if (input.set.approvalStatus) fm.approvalStatus = input.set.approvalStatus;
    if (input.set.parent !== undefined) {
      if (input.set.parent === "") delete fm.parent;
      else fm.parent = input.set.parent;
    }
    updates.push({ path: `wiki/pages/${slug}.md`, content: serializePage(fm, page.content) });
  }

  if (updates.length) {
    await storage.commitFiles(updates, `CampaignRepo: bulk edit ${updates.length} pages`);
    scheduleSearchIndexRebuild(campaign);
  }
  return NextResponse.json({ ok: true, updated: updates.length });
}

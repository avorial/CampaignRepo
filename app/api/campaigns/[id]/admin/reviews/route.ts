import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage, serializePage } from "@/lib/markdown";
import { listReviewPages } from "@/lib/reviews";
import { scheduleSearchIndexRebuild } from "@/lib/search";

const decisionSchema = z.object({
  slug: z.string().min(1).optional(),
  decision: z.enum(["approved", "rejected"]),
  all: z.boolean().optional()
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ reviews: await listReviewPages(storage, campaign) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = decisionSchema.parse(await req.json());
  const verb = input.decision === "approved" ? "approve" : "reject";

  let updated = 0;
  if (input.all) {
    const files = await storage.listDirectoryTextFiles("wiki/pages");
    const updates = files
      .map((file) => parsePage(file.name.replace(/\.md$/, ""), file.text ?? "", file.sha))
      .filter((page) => page.frontmatter.approvalStatus !== "approved")
      .map((page) => ({ path: `wiki/pages/${page.slug}.md`, content: serializePage({ ...page.frontmatter, approvalStatus: input.decision, lastEditedBy: `${user.name} via GM review` }, page.content) }));
    if (updates.length) await storage.commitFiles(updates, `CampaignRepo: ${verb} ${updates.length} pages (bulk)`);
    updated = updates.length;
  } else if (input.slug) {
    const file = await storage.getTextFile(`wiki/pages/${input.slug}.md`);
    const page = parsePage(input.slug, file.text, file.sha);
    await storage.putFile(`wiki/pages/${input.slug}.md`, serializePage({ ...page.frontmatter, approvalStatus: input.decision, lastEditedBy: `${user.name} via GM review` }, page.content), `CampaignRepo: ${verb} ${page.frontmatter.name}`, file.sha);
    updated = 1;
  } else {
    return NextResponse.json({ error: "Provide a slug or set all: true." }, { status: 400 });
  }

  scheduleSearchIndexRebuild(campaign);
  return NextResponse.json({ ok: true, updated, reviews: await listReviewPages(storage, campaign) });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage, serializePage } from "@/lib/markdown";
import { listReviewPages } from "@/lib/reviews";
import { scheduleSearchIndexRebuild } from "@/lib/search";
import { readPageCache, upsertPageInCache } from "@/lib/page-cache";

export const dynamic = "force-dynamic";

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
    const cachedPages = new Map(readPageCache(campaign.id).pages.map((page) => [page.slug, page]));
    const pages = await Promise.all(files.map(async (file) => {
      const slug = file.name.replace(/\.md$/, "");
      if (file.text !== null) return parsePage(slug, file.text, file.sha);

      const cached = cachedPages.get(slug);
      if (cached?.sha === file.sha && cached.raw) return cached;

      const fullFile = await storage.getTextFile(file.path);
      return parsePage(slug, fullFile.text, fullFile.sha);
    }));
    const updates = pages
      .filter((page) => page.frontmatter.approvalStatus !== "approved")
      .map((page) => ({ path: `wiki/pages/${page.slug}.md`, content: serializePage({ ...page.frontmatter, approvalStatus: input.decision, lastEditedBy: `${user.name} via GM review` }, page.content) }));
    if (updates.length) await storage.commitFiles(updates, `CampaignRepo: ${verb} ${updates.length} pages (bulk)`);
    for (const update of updates) {
      const slug = update.path.replace(/^wiki\/pages\//, "").replace(/\.md$/, "");
      upsertPageInCache(campaign.id, parsePage(slug, update.content));
    }
    updated = updates.length;
  } else if (input.slug) {
    const file = await storage.getTextFile(`wiki/pages/${input.slug}.md`);
    const page = parsePage(input.slug, file.text, file.sha);
    const nextText = serializePage({ ...page.frontmatter, approvalStatus: input.decision, lastEditedBy: `${user.name} via GM review` }, page.content);
    const saved = await storage.putFile(`wiki/pages/${input.slug}.md`, nextText, `CampaignRepo: ${verb} ${page.frontmatter.name}`, file.sha);
    upsertPageInCache(campaign.id, parsePage(input.slug, nextText, saved.sha));
    updated = 1;
  } else {
    return NextResponse.json({ error: "Provide a slug or set all: true." }, { status: 400 });
  }

  scheduleSearchIndexRebuild(campaign);
  return NextResponse.json({ ok: true, updated, reviews: await listReviewPages(storage, campaign) });
}

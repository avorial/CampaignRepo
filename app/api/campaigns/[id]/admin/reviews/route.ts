import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { commitFiles, getTextFile, listDirectoryTextFiles, putFile } from "@/lib/github";
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
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ reviews: await listReviewPages(user.githubToken, campaign) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = decisionSchema.parse(await req.json());
  const token = user.githubToken;
  const verb = input.decision === "approved" ? "approve" : "reject";

  async function applyDecision(slug: string) {
    const file = await getTextFile(token, campaign!, `wiki/pages/${slug}.md`);
    const page = parsePage(slug, file.text, file.sha);
    const frontmatter = {
      ...page.frontmatter,
      approvalStatus: input.decision,
      lastEditedBy: `${user.name} via GM review`
    };
    await putFile(
      token,
      campaign!,
      `wiki/pages/${slug}.md`,
      serializePage(frontmatter, page.content),
      `CampaignRepo: ${verb} ${frontmatter.name}`,
      file.sha
    );
  }

  let updated = 0;
  if (input.all) {
    // Bulk: read the whole queue in one GraphQL request and write every
    // decision in a SINGLE commit, instead of one commit per page.
    const files = await listDirectoryTextFiles(token, campaign, "wiki/pages");
    const updates = files
      .map((file) => parsePage(file.name.replace(/\.md$/, ""), file.text ?? "", file.sha))
      .filter((page) => page.frontmatter.approvalStatus !== "approved")
      .map((page) => ({
        path: `wiki/pages/${page.slug}.md`,
        content: serializePage(
          { ...page.frontmatter, approvalStatus: input.decision, lastEditedBy: `${user.name} via GM review` },
          page.content
        )
      }));
    if (updates.length) {
      await commitFiles(token, campaign, updates, `CampaignRepo: ${verb} ${updates.length} pages (bulk)`);
    }
    updated = updates.length;
  } else if (input.slug) {
    await applyDecision(input.slug);
    updated = 1;
  } else {
    return NextResponse.json({ error: "Provide a slug or set all: true." }, { status: 400 });
  }

  scheduleSearchIndexRebuild(token, campaign);
  return NextResponse.json({ ok: true, updated, reviews: await listReviewPages(token, campaign) });
}

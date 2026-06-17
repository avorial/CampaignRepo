import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getTextFile, listDirectory, putFile } from "@/lib/github";
import { parsePage, serializePage } from "@/lib/markdown";
import { rebuildSearchIndex } from "@/lib/search";

const decisionSchema = z.object({
  slug: z.string().min(1),
  decision: z.enum(["approved", "rejected"])
});

async function listReviewPages(token: string, campaign: NonNullable<ReturnType<typeof getCampaign>>) {
  const entries = await listDirectory(token, campaign, "wiki/pages");
  const pages = await Promise.all(
    entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, "");
        const file = await getTextFile(token, campaign, entry.path);
        return parsePage(slug, file.text, file.sha);
      })
  );

  return pages
    .filter((page) => page.frontmatter.approvalStatus !== "approved")
    .map((page) => ({
      slug: page.slug,
      sha: page.sha,
      name: page.frontmatter.name,
      category: page.frontmatter.category,
      visibility: page.frontmatter.visibility,
      approvalStatus: page.frontmatter.approvalStatus,
      summary: page.frontmatter.summary,
      lastEditedBy: page.frontmatter.lastEditedBy,
      sourceImport: page.frontmatter.sourceImport,
      excerpt: page.content.replace(/:::gm[\s\S]*?:::/g, "").replace(/\s+/g, " ").trim().slice(0, 260)
    }));
}

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
  const file = await getTextFile(user.githubToken, campaign, `wiki/pages/${input.slug}.md`);
  const page = parsePage(input.slug, file.text, file.sha);
  const frontmatter = {
    ...page.frontmatter,
    approvalStatus: input.decision,
    lastEditedBy: `${user.name} via GM review`
  };

  await putFile(
    user.githubToken,
    campaign,
    `wiki/pages/${input.slug}.md`,
    serializePage(frontmatter, page.content),
    `CampaignRepo: ${input.decision === "approved" ? "approve" : "reject"} ${frontmatter.name}`,
    file.sha
  );
  await rebuildSearchIndex(user.githubToken, campaign);
  return NextResponse.json({ ok: true, reviews: await listReviewPages(user.githubToken, campaign) });
}

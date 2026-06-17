import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { getTextFile, putFile } from "@/lib/github";
import { parsePage, serializePage } from "@/lib/markdown";
import { rebuildSearchIndex } from "@/lib/search";

const schema = z.object({
  frontmatter: z.any(),
  content: z.string(),
  sha: z.string().optional(),
  ai: z.boolean().default(false)
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const file = await getTextFile(user.githubToken, campaign, `wiki/pages/${slug}.md`);
  return NextResponse.json({ page: parsePage(slug, file.text, file.sha) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = schema.parse(await req.json());
  const frontmatter = {
    ...input.frontmatter,
    approvalStatus: input.ai ? "unapproved" : input.frontmatter.approvalStatus,
    lastEditedBy: input.ai ? "AI via CampaignRepo" : user.name
  };
  const raw = serializePage(frontmatter, input.content);
  const current = input.sha ? { sha: input.sha } : await getTextFile(user.githubToken, campaign, `wiki/pages/${slug}.md`);
  await putFile(user.githubToken, campaign, `wiki/pages/${slug}.md`, raw, `CampaignRepo: update ${frontmatter.name || slug}`, current.sha);
  await rebuildSearchIndex(user.githubToken, campaign);
  return NextResponse.json({ ok: true });
}

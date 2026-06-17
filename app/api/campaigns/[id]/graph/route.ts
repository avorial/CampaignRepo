import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { getTextFile, listDirectory } from "@/lib/github";
import { parsePage } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import type { CampaignGraphEdge, CampaignGraphNode, CampaignTimelineItem, WikiPage } from "@/lib/types";

function visibleForRole(page: WikiPage, role?: string) {
  if (role !== "player") return true;
  return page.frontmatter.visibility === "players" && page.frontmatter.approvalStatus === "approved";
}

function resolvePages(pages: WikiPage[]) {
  const aliases = new Map<string, string>();
  for (const page of pages) {
    aliases.set(page.slug.toLowerCase(), page.slug);
    aliases.set(page.frontmatter.name.toLowerCase(), page.slug);
    for (const alias of page.frontmatter.aliases) aliases.set(alias.toLowerCase(), page.slug);
  }
  return aliases;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entries = await listDirectory(user.githubToken, campaign, "wiki/pages");
  const allPages = await Promise.all(
    entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, "");
        const file = await getTextFile(user.githubToken!, campaign, entry.path);
        return parsePage(slug, file.text, file.sha);
      })
  );

  const pages = allPages.filter((page) => visibleForRole(page, campaign.role));
  const visibleSlugs = new Set(pages.map((page) => page.slug));
  const aliases = resolvePages(pages);
  const backlinks = new Map<string, string[]>();
  const edges: CampaignGraphEdge[] = [];

  for (const page of pages) {
    for (const link of page.outgoingLinks) {
      const target = aliases.get(link.target.toLowerCase()) || slugify(link.target);
      const missing = !visibleSlugs.has(target);
      if (!missing) backlinks.set(target, [...(backlinks.get(target) || []), page.slug]);
      edges.push({ source: page.slug, target, label: link.label, missing });
    }
    for (const keyLink of page.frontmatter.keyLinks) {
      const target = aliases.get(keyLink.toLowerCase()) || slugify(keyLink);
      const missing = !visibleSlugs.has(target);
      edges.push({ source: page.slug, target, label: "key link", missing });
    }
  }

  const nodes: CampaignGraphNode[] = pages.map((page) => ({
    slug: page.slug,
    name: page.frontmatter.name,
    category: page.frontmatter.category,
    summary: page.frontmatter.summary,
    tags: page.frontmatter.tags,
    visibility: page.frontmatter.visibility,
    approvalStatus: page.frontmatter.approvalStatus,
    keyLinks: page.frontmatter.keyLinks,
    outgoingLinks: page.outgoingLinks.map((link) => aliases.get(link.target.toLowerCase()) || slugify(link.target)),
    backlinks: backlinks.get(page.slug) || []
  }));

  const timeline: CampaignTimelineItem[] = pages
    .filter((page) => page.frontmatter.category === "event")
    .map((page) => ({
      slug: page.slug,
      name: page.frontmatter.name,
      summary: page.frontmatter.summary,
      eventDate: page.frontmatter.eventDate || page.frontmatter.timelineDate,
      tags: page.frontmatter.tags,
      visibility: page.frontmatter.visibility,
      approvalStatus: page.frontmatter.approvalStatus
    }))
    .sort((a, b) => (a.eventDate || "9999").localeCompare(b.eventDate || "9999") || a.name.localeCompare(b.name));

  return NextResponse.json({ nodes, edges, timeline });
}

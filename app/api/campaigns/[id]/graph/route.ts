import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { parsePage, stripGmBlocks } from "@/lib/markdown";
import { aliasMapFromPages, resolveTarget } from "@/lib/links";
import { readPageCache, refreshPageCache, refreshPageCacheInBackground } from "@/lib/page-cache";
import { getStorageAdapter } from "@/lib/storage";
import type { CampaignGraphEdge, CampaignGraphNode, CampaignTimelineItem, WikiPage } from "@/lib/types";

export const dynamic = "force-dynamic";

function visibleForRole(page: WikiPage, role?: string) {
  if (role !== "player") return true;
  return page.frontmatter.visibility === "players" && page.frontmatter.approvalStatus === "approved";
}

function graphImageSrc(campaignId: number, raw?: unknown) {
  if (!raw || typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value) || value.startsWith("/campaign-media/")) return value;
  if (value.startsWith("/") && !/^\/?wiki\/media\//i.test(value)) return value;
  const mediaPath = value.replace(/^\/?wiki\/media\//i, "");
  return `/campaign-media/${campaignId}/${mediaPath.split("/").map(encodeURIComponent).join("/")}`;
}

function pageGraphImage(campaignId: number, page: WikiPage) {
  const frontmatter = page.frontmatter as WikiPage["frontmatter"] & { portrait?: string; image?: string; logo?: string };
  const explicit = graphImageSrc(campaignId, frontmatter.portrait || frontmatter.image || frontmatter.logo);
  if (explicit) return explicit;
  const match = page.content.match(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  return match ? graphImageSrc(campaignId, match[1]) : undefined;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cached = readPageCache(campaign.id);
  const snapshot = cached.pages.length ? cached : await refreshPageCache(storage, campaign);
  if (cached.pages.length) refreshPageCacheInBackground(storage, campaign);
  const allPages =
    campaign.role === "player"
      ? snapshot.pages.map((page) => parsePage(page.slug, stripGmBlocks(page.raw), page.sha))
      : snapshot.pages;

  const pages = allPages.filter((page) => visibleForRole(page, campaign.role));
  const visibleSlugs = new Set(pages.map((page) => page.slug));
  const aliases = aliasMapFromPages(pages);
  const backlinks = new Map<string, string[]>();
  const edges: CampaignGraphEdge[] = [];

  for (const page of pages) {
    for (const link of page.outgoingLinks) {
      const target = resolveTarget(aliases, link.target);
      const missing = !visibleSlugs.has(target);
      if (!missing) backlinks.set(target, [...(backlinks.get(target) || []), page.slug]);
      if (campaign.role !== "player" || !missing) edges.push({ source: page.slug, target, label: link.label, missing });
    }
    for (const keyLink of page.frontmatter.keyLinks) {
      const target = resolveTarget(aliases, keyLink);
      const missing = !visibleSlugs.has(target);
      if (campaign.role !== "player" || !missing) edges.push({ source: page.slug, target, label: "key link", missing });
    }
    for (const rel of page.frontmatter.relationships || []) {
      if (rel.hidden && campaign.role === "player") continue;
      const target = resolveTarget(aliases, rel.target);
      const missing = !visibleSlugs.has(target);
      if (campaign.role !== "player" || !missing) {
        edges.push({ source: page.slug, target, label: rel.label || rel.type, missing, relType: rel.type, relEditable: true });
      }
    }
    if (page.frontmatter.parent) {
      const target = resolveTarget(aliases, page.frontmatter.parent);
      const missing = !visibleSlugs.has(target);
      if (campaign.role !== "player" || !missing) {
        edges.push({ source: target, target: page.slug, label: "parent", missing, relType: "parent-of" });
      }
    }
  }

  const nodes: CampaignGraphNode[] = pages.map((page) => ({
    slug: page.slug,
    name: page.frontmatter.name,
    category: page.frontmatter.category,
    summary: page.frontmatter.summary,
    image: pageGraphImage(campaign.id, page),
    tags: page.frontmatter.tags,
    visibility: page.frontmatter.visibility,
    approvalStatus: page.frontmatter.approvalStatus,
    keyLinks:
      campaign.role === "player"
        ? page.frontmatter.keyLinks.map((keyLink) => resolveTarget(aliases, keyLink)).filter((target) => visibleSlugs.has(target))
        : page.frontmatter.keyLinks,
    outgoingLinks: page.outgoingLinks.map((link) => resolveTarget(aliases, link.target)).filter((target) => campaign.role !== "player" || visibleSlugs.has(target)),
    backlinks: backlinks.get(page.slug) || []
  }));

  const timeline: CampaignTimelineItem[] = pages
    .filter((page) => page.frontmatter.category === "event")
    .map((page) => ({
      slug: page.slug,
      name: page.frontmatter.name,
      summary: page.frontmatter.summary,
      eventDate: page.frontmatter.eventDate || page.frontmatter.timelineDate,
      era: page.frontmatter.era,
      track: page.frontmatter.track,
      tags: page.frontmatter.tags,
      visibility: page.frontmatter.visibility,
      approvalStatus: page.frontmatter.approvalStatus
    }))
    .sort((a, b) => (a.eventDate || "9999").localeCompare(b.eventDate || "9999") || a.name.localeCompare(b.name));

  return NextResponse.json({ nodes, edges, timeline });
}

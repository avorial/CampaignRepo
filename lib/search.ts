import { getTextFile, GitHubError, listDirectory, putFile } from "@/lib/github";
import { parsePage, stripGmBlocks } from "@/lib/markdown";
import { aliasMapFromPages, resolveTarget } from "@/lib/links";
import type { Campaign, SearchDocument, WikiPage } from "@/lib/types";
import { upsertSearchDocuments } from "@/lib/db";

type MediaMetadata = {
  alt?: string;
  caption?: string;
  tags?: string[];
};

function withBacklinks(pages: WikiPage[]) {
  const aliases = aliasMapFromPages(pages);
  const backlinks = new Map<string, string[]>();
  for (const page of pages) {
    for (const link of page.outgoingLinks) {
      const target = resolveTarget(aliases, link.target);
      backlinks.set(target, [...(backlinks.get(target) || []), page.slug]);
    }
  }
  return pages.map((page) => ({ ...page, backlinks: backlinks.get(page.slug) || [] }));
}

async function buildMediaSearchDocuments(token: string, campaign: Campaign): Promise<SearchDocument[]> {
  const [entries, metadata] = await Promise.all([
    listDirectory(token, campaign, "wiki/media"),
    (async () => {
      try {
        const file = await getTextFile(token, campaign, "wiki/media/media.json");
        return JSON.parse(file.text || "{}") as Record<string, MediaMetadata>;
      } catch (error) {
        if (error instanceof GitHubError && error.status === 404) return {};
        throw error;
      }
    })()
  ]);

  return entries
    .filter((entry) => entry.type === "file" && entry.name !== ".gitkeep" && entry.path !== "wiki/media/media.json")
    .map((entry) => {
      const item = metadata[entry.path] || {};
      const tags = item.tags || [];
      const title = item.alt || entry.name;
      const text = [entry.name, entry.path, item.alt, item.caption, ...tags].filter(Boolean).join("\n");
      return {
        id: `${campaign.id}:media:${entry.path}`,
        campaignId: campaign.id,
        campaignName: campaign.name,
        slug: `media/${entry.name}`,
        title,
        category: "media",
        summary: item.caption || entry.path,
        tags,
        aliases: [entry.name],
        visibility: "gm" as const,
        approvalStatus: "approved" as const,
        text,
        playerText: "",
        links: [],
        backlinks: [],
        keyLinks: []
      };
    });
}

export async function buildSearchDocuments(token: string, campaign: Campaign): Promise<SearchDocument[]> {
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
  const pageDocs = withBacklinks(pages).map((page) => ({
    id: `${campaign.id}:${page.slug}`,
    campaignId: campaign.id,
    campaignName: campaign.name,
    slug: page.slug,
    title: page.frontmatter.name,
    category: page.frontmatter.category,
    summary: page.frontmatter.summary,
    tags: page.frontmatter.tags,
    aliases: page.frontmatter.aliases,
    visibility: page.frontmatter.visibility,
    approvalStatus: page.frontmatter.approvalStatus,
    text: page.content,
    playerText: stripGmBlocks(page.content),
    links: page.outgoingLinks.map((link) => link.target),
    backlinks: page.backlinks,
    keyLinks: page.frontmatter.keyLinks
  }));
  const mediaDocs = await buildMediaSearchDocuments(token, campaign);
  return [...pageDocs, ...mediaDocs];
}

export async function rebuildSearchIndex(token: string, campaign: Campaign) {
  const docs = await buildSearchDocuments(token, campaign);
  upsertSearchDocuments(campaign.id, docs);
  let sha: string | undefined;
  try {
    const existing = await getTextFile(token, campaign, "wiki/search/index.json");
    sha = existing.sha;
  } catch {
    sha = undefined;
  }
  await putFile(token, campaign, "wiki/search/index.json", JSON.stringify(docs, null, 2) + "\n", "CampaignRepo: update search snapshot", sha);
  return docs;
}

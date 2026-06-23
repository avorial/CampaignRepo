import type { Campaign, WikiPage } from "@/lib/types";
import { getCampaignRepositoryToken } from "@/lib/db";
import { getTextFile, listDirectory } from "@/lib/github";
import { parsePage, stripGmBlocks } from "@/lib/markdown";

/** Strip GM-only content and internal import metadata from a page before it leaves the server. */
export function sanitizePlayerPage(page: WikiPage): WikiPage {
  return {
    ...page,
    content: stripGmBlocks(page.content),
    raw: stripGmBlocks(page.raw),
    frontmatter: { ...page.frontmatter, sourceImport: undefined }
  };
}

/**
 * Load the player-safe pages for a campaign straight from its GitHub repo —
 * only pages that are player-visible AND approved, with GM blocks stripped.
 * Used by the public published site (no auth) and reusable by the player portal.
 */
export async function loadPublicPages(campaign: Campaign): Promise<WikiPage[]> {
  const repoToken = getCampaignRepositoryToken(campaign.id);
  if (!repoToken) return [];
  const entries = await listDirectory(repoToken, campaign, "wiki/pages");
  const pages = await Promise.all(
    entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, "");
        const file = await getTextFile(repoToken, campaign, entry.path);
        return parsePage(slug, file.text, file.sha);
      })
  );
  return pages
    .filter((page) => page.frontmatter.visibility === "players" && page.frontmatter.approvalStatus === "approved")
    .map(sanitizePlayerPage)
    .sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
}

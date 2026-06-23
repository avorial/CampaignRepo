import YAML from "yaml";
import type { Campaign, WikiPage } from "@/lib/types";
import { getCampaignRepositoryToken } from "@/lib/db";
import { getTextFile, GitHubError, listDirectory, putFile } from "@/lib/github";
import { parsePage, stripGmBlocks } from "@/lib/markdown";
import { sanitizeTheme, type CampaignTheme } from "@/lib/theme";

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

const campaignConfigPath = "wiki/campaign.yaml";

/** Read the campaign's theme block from wiki/campaign.yaml. Returns {} on any problem. */
export async function loadCampaignTheme(campaign: Campaign): Promise<CampaignTheme> {
  const repoToken = getCampaignRepositoryToken(campaign.id);
  if (!repoToken) return {};
  try {
    const file = await getTextFile(repoToken, campaign, campaignConfigPath);
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    return sanitizeTheme(parsed?.theme);
  } catch {
    return {};
  }
}

/** Merge a sanitized theme into wiki/campaign.yaml, preserving other keys. */
export async function saveCampaignTheme(campaign: Campaign, theme: CampaignTheme): Promise<CampaignTheme> {
  const repoToken = getCampaignRepositoryToken(campaign.id);
  if (!repoToken) throw new Error("This campaign has no GitHub access configured.");
  let config: Record<string, unknown> = {};
  let sha: string | undefined;
  try {
    const file = await getTextFile(repoToken, campaign, campaignConfigPath);
    sha = file.sha;
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    if (parsed && typeof parsed === "object") config = parsed;
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) throw error;
  }
  const clean = sanitizeTheme(theme);
  config.theme = clean;
  await putFile(repoToken, campaign, campaignConfigPath, YAML.stringify(config), "CampaignRepo: update theme", sha);
  return clean;
}

import YAML from "yaml";
import type { Campaign, WikiPage } from "@/lib/types";
import { themePresetForGame } from "@/lib/game-pack-branding";
import { getStorageAdapter } from "@/lib/storage";
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
 * Load the player-safe pages for a campaign straight from its storage —
 * only pages that are player-visible AND approved, with GM blocks stripped.
 * Used by the public published site (no auth) and reusable by the player portal.
 */
export async function loadPublicPages(campaign: Campaign): Promise<WikiPage[]> {
  const storage = getStorageAdapter(campaign);
  if (!storage) return [];
  const entries = await storage.listDirectory("wiki/pages");
  const pages = await Promise.all(
    entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, "");
        const file = await storage.getTextFile(entry.path);
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
  const fallbackPreset = themePresetForGame(campaign.gameType);
  const storage = getStorageAdapter(campaign);
  if (!storage) return { preset: fallbackPreset };
  try {
    const file = await storage.getTextFile(campaignConfigPath);
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    const theme = sanitizeTheme(parsed?.theme);
    return theme.preset ? theme : { ...theme, preset: fallbackPreset };
  } catch {
    return { preset: fallbackPreset };
  }
}

/** Merge a sanitized theme into wiki/campaign.yaml, preserving other keys. */
export async function saveCampaignTheme(campaign: Campaign, theme: CampaignTheme): Promise<CampaignTheme> {
  const storage = getStorageAdapter(campaign);
  if (!storage) throw new Error("No storage configured for this campaign.");
  let config: Record<string, unknown> = {};
  let sha: string | undefined;
  try {
    const file = await storage.getTextFile(campaignConfigPath);
    sha = file.sha;
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    if (parsed && typeof parsed === "object") config = parsed;
  } catch { /* file not found yet */ }
  const clean = sanitizeTheme(theme);
  config.theme = clean;
  await storage.putFile(campaignConfigPath, YAML.stringify(config), "CampaignRepo: update theme", sha);
  return clean;
}

import YAML from "yaml";
import type { Campaign, WikiPage } from "@/lib/types";
import { themePresetForGame, categoryPresetForGame } from "@/lib/game-pack-branding";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage, stripGmBlocks } from "@/lib/markdown";
import { parseQuest, type Quest } from "@/lib/quests";
import { sanitizeTheme, type CampaignTheme } from "@/lib/theme";

/** Strip GM-only content and internal import metadata from a page before it leaves the server. */
export function sanitizePlayerPage(page: WikiPage, visibleGroups?: Set<string>): WikiPage {
  return {
    ...page,
    content: stripGmBlocks(page.content, visibleGroups),
    raw: stripGmBlocks(page.raw, visibleGroups),
    frontmatter: { ...page.frontmatter, sourceImport: undefined }
  };
}

/**
 * Load the player-safe pages for a campaign straight from its storage —
 * only pages that are player-visible AND approved, with GM blocks stripped.
 * Used by the public published site (no auth) and reusable by the player portal.
 */
export async function loadPublicPages(campaign: Campaign, userToken?: string | null): Promise<WikiPage[]> {
  const storage = getStorageAdapter(campaign, userToken);
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
    .map((page) => sanitizePlayerPage(page))
    .sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
}

/** Load public-safe quests for a published world. GM-only quest descriptions are never exposed. */
export async function loadPublicQuests(campaign: Campaign, userToken?: string | null): Promise<Quest[]> {
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) return [];
  try {
    const files = await storage.listDirectoryTextFiles("wiki/quests");
    return files
      .map((file) => parseQuest(file.name.replace(/\.md$/, ""), file.text ?? "", file.sha))
      .filter((quest) => quest.frontmatter.visibility === "players")
      .map((quest) => ({ ...quest, description: stripGmBlocks(quest.description) }))
      .sort((a, b) => a.frontmatter.title.localeCompare(b.frontmatter.title));
  } catch {
    return [];
  }
}

const campaignConfigPath = "wiki/campaign.yaml";

/** Read the campaign's theme block from wiki/campaign.yaml. Returns {} on any problem. */
export async function loadCampaignTheme(campaign: Campaign, userToken?: string | null): Promise<CampaignTheme> {
  const fallbackPreset = themePresetForGame(campaign.gameType);
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) return { preset: fallbackPreset };
  try {
    const file = await storage.getTextFile(campaignConfigPath);
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    const theme = sanitizeTheme(parsed?.theme);
    // Upgrade campaigns whose saved preset is just the old auto-assigned category
    // default — e.g. "fantasy" for Dark Ages: Vampire, which now has a flagship theme.
    // A GM who deliberately picked a non-category preset keeps their choice.
    const isStaleDefault = !theme.preset || theme.preset === categoryPresetForGame(campaign.gameType);
    return isStaleDefault ? { ...theme, preset: fallbackPreset } : theme;
  } catch {
    return { preset: fallbackPreset };
  }
}

/** Merge a sanitized theme into wiki/campaign.yaml, preserving other keys. */
export async function saveCampaignTheme(campaign: Campaign, theme: CampaignTheme, userToken?: string | null): Promise<CampaignTheme> {
  const storage = getStorageAdapter(campaign, userToken);
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

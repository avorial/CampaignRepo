import YAML from "yaml";
import type { Campaign } from "@/lib/types";
import { getStorageAdapter } from "@/lib/storage";

/**
 * Muted tags let a campaign de-emphasize bulk-generated pages without deleting
 * them. Imports can produce thousands of well-formed but low-signal pages (loot
 * line-items, per-token stubs) that bury the hand-written world in navigation
 * and search. Muting hides them from those surfaces; the pages, their links,
 * and their history are untouched and still reachable by direct URL.
 *
 * Empty by default, so no campaign changes behavior until a GM opts in.
 */
const campaignConfigPath = "wiki/campaign.yaml";

export const MAX_MUTED_TAGS = 20;

export function sanitizeMutedTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") continue;
    let entry = item.trim().toLowerCase().slice(0, 50);
    // Normalize the category form so "Category: Item" and "category:item" match.
    const cat = /^category\s*:\s*(.+)$/.exec(entry);
    if (cat) entry = `category:${cat[1].trim()}`;
    if (entry && entry !== "category:") seen.add(entry);
    if (seen.size >= MAX_MUTED_TAGS) break;
  }
  return Array.from(seen);
}

/**
 * True when a page is muted. An entry is either a bare tag ("generated") or a
 * category selector ("category:item").
 *
 * The category form exists because an import can tag every page it produced
 * identically — Attackers of Opportunity tags all 2,019 imported pages
 * "generated", so muting that tag would hide the entire world. Category muting
 * targets the low-signal set without editing a single page.
 */
export function isMutedPage(tags: string[] | undefined, category: string | undefined, muted: string[]): boolean {
  if (!muted.length) return false;
  const mutedSet = new Set(muted);
  const cat = String(category || "").trim().toLowerCase();
  if (cat && mutedSet.has(`category:${cat}`)) return true;
  return (tags || []).some((tag) => mutedSet.has(String(tag).trim().toLowerCase()));
}

/** Back-compat helper for tag-only checks. */
export function isMutedByTags(tags: string[] | undefined, muted: string[]): boolean {
  return isMutedPage(tags, undefined, muted);
}

export async function loadMutedTags(campaign: Campaign, userToken?: string | null): Promise<string[]> {
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) return [];
  try {
    const file = await storage.getTextFile(campaignConfigPath);
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    return sanitizeMutedTags(parsed?.mutedTags);
  } catch {
    return [];
  }
}

/** Merge mutedTags into wiki/campaign.yaml, preserving other keys. */
export async function saveMutedTags(campaign: Campaign, tags: string[], userToken?: string | null): Promise<string[]> {
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) throw new Error("No storage configured for this campaign.");
  let config: Record<string, unknown> = {};
  let sha: string | undefined;
  try {
    const file = await storage.getTextFile(campaignConfigPath);
    sha = file.sha;
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    if (parsed && typeof parsed === "object") config = parsed;
  } catch { /* file not created yet */ }
  const clean = sanitizeMutedTags(tags);
  if (clean.length) config.mutedTags = clean;
  else delete config.mutedTags;
  await storage.putFile(campaignConfigPath, YAML.stringify(config), "CampaignRepo: update muted tags", sha);
  return clean;
}

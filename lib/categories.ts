import YAML from "yaml";
import type { Campaign } from "@/lib/types";
import { getStorageAdapter } from "@/lib/storage";
import { categories as defaultCategories } from "@/lib/templates";
import { slugify } from "@/lib/slug";

export type CampaignCategory = { id: string; label: string };

const campaignConfigPath = "wiki/campaign.yaml";

function cleanId(value: unknown, fallback: string) {
  const raw = typeof value === "string" ? value : fallback;
  return slugify(raw).replace(/-/g, "_").slice(0, 40).toLowerCase() || fallback.toLowerCase();
}

function cleanLabel(value: unknown, fallback: string) {
  const label = typeof value === "string" ? value.trim() : "";
  return label.slice(0, 60) || fallback;
}

function defaultLabelFor(value: string) {
  const normalized = value.trim().toLowerCase();
  return defaultCategories.find((category) =>
    category.id === normalized ||
    category.label.toLowerCase() === normalized ||
    category.label.toLowerCase().replace(/s$/, "") === normalized
  );
}

export function sanitizeCampaignCategories(input: unknown): CampaignCategory[] {
  if (!Array.isArray(input)) return defaultCategories;
  const seen = new Set<string>();
  const cleaned: CampaignCategory[] = [];
  for (const item of input) {
    const preset = typeof item === "string" ? defaultLabelFor(item) : undefined;
    const raw = typeof item === "object" && item ? item as Record<string, unknown> : {};
    const label = cleanLabel(typeof item === "string" ? item : raw.label, preset?.label || "Category");
    const id = cleanId(raw.id, preset?.id || label);
    if (seen.has(id)) continue;
    seen.add(id);
    cleaned.push({ id, label });
  }
  return cleaned.length ? cleaned : defaultCategories;
}

export async function loadCampaignCategories(campaign: Campaign, userToken?: string | null): Promise<CampaignCategory[]> {
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) return defaultCategories;
  try {
    const file = await storage.getTextFile(campaignConfigPath);
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    return sanitizeCampaignCategories(parsed?.categories);
  } catch {
    return defaultCategories;
  }
}

export async function saveCampaignCategories(campaign: Campaign, categories: CampaignCategory[], userToken?: string | null): Promise<CampaignCategory[]> {
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
  const clean = sanitizeCampaignCategories(categories);
  config.categories = clean;
  await storage.putFile(campaignConfigPath, YAML.stringify(config), "CampaignRepo: update categories", sha);
  return clean;
}

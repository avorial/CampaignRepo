import YAML from "yaml";
import { getCampaignRepositoryToken } from "@/lib/db";
import { getTextFile, GitHubError, putFile } from "@/lib/github";
import type { Campaign } from "@/lib/types";

export type WidgetId = "calendar" | "counts" | "timeline" | "quicklinks" | "quests" | "review" | "health";

// gmOnly widgets are never rendered for players (the spoiler-safe view).
export const WIDGETS: { id: WidgetId; label: string; gmOnly: boolean }[] = [
  { id: "calendar", label: "Current date", gmOnly: false },
  { id: "counts", label: "Page counts", gmOnly: false },
  { id: "timeline", label: "Timeline", gmOnly: false },
  { id: "quicklinks", label: "Quick links", gmOnly: false },
  { id: "quests", label: "Active quests", gmOnly: true },
  { id: "review", label: "Review queue", gmOnly: true },
  { id: "health", label: "Campaign health", gmOnly: true }
];

export type DashboardConfig = { widgets: WidgetId[] };

const KNOWN = new Set<string>(WIDGETS.map((w) => w.id));
const campaignConfigPath = "wiki/campaign.yaml";

export function defaultDashboard(): DashboardConfig {
  return { widgets: WIDGETS.map((w) => w.id) };
}

export function sanitizeDashboard(raw: unknown): DashboardConfig {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { widgets?: unknown }).widgets) ? (raw as { widgets: unknown[] }).widgets : null;
  if (!list) return defaultDashboard();
  const seen = new Set<string>();
  const widgets = list.filter((w): w is WidgetId => typeof w === "string" && KNOWN.has(w) && !seen.has(w) && Boolean(seen.add(w)));
  return { widgets: widgets.length ? widgets : defaultDashboard().widgets };
}

/** Read the campaign's dashboard layout from wiki/campaign.yaml. Falls back to the default. */
export async function loadCampaignDashboard(campaign: Campaign): Promise<DashboardConfig> {
  const repoToken = getCampaignRepositoryToken(campaign.id);
  if (!repoToken) return defaultDashboard();
  try {
    const file = await getTextFile(repoToken, campaign, campaignConfigPath);
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    return sanitizeDashboard(parsed?.dashboard);
  } catch {
    return defaultDashboard();
  }
}

/** Merge the dashboard layout into wiki/campaign.yaml, preserving other keys (e.g. theme). */
export async function saveCampaignDashboard(campaign: Campaign, config: DashboardConfig): Promise<DashboardConfig> {
  const repoToken = getCampaignRepositoryToken(campaign.id);
  if (!repoToken) throw new Error("This campaign has no GitHub access configured.");
  let yaml: Record<string, unknown> = {};
  let sha: string | undefined;
  try {
    const file = await getTextFile(repoToken, campaign, campaignConfigPath);
    sha = file.sha;
    const parsed = YAML.parse(file.text || "") as Record<string, unknown> | null;
    if (parsed && typeof parsed === "object") yaml = parsed;
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) throw error;
  }
  const clean = sanitizeDashboard(config);
  yaml.dashboard = clean;
  await putFile(repoToken, campaign, campaignConfigPath, YAML.stringify(yaml), "CampaignRepo: update dashboard layout", sha);
  return clean;
}

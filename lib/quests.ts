import YAML from "yaml";
import { getStorageAdapter } from "@/lib/storage";
import { slugify } from "@/lib/slug";
import type { Campaign } from "@/lib/types";

export type Objective = { text: string; done: boolean };
export const QUEST_STATUSES = ["hook", "active", "completed", "failed"] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

export type QuestFrontmatter = {
  title: string;
  status: QuestStatus;
  arc?: string;
  reward?: string;
  visibility: "gm" | "players";
  objectives: Objective[];
  participants: string[];
  locations: string[];
};
export type Quest = { slug: string; sha?: string; frontmatter: QuestFrontmatter; description: string };

const questsDir = "wiki/quests";

function adapterFor(campaign: Campaign, userToken?: string | null) {
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) throw new Error("No storage configured for this campaign.");
  return storage;
}

function normStatus(v: unknown): QuestStatus {
  return (QUEST_STATUSES as readonly string[]).includes(String(v)) ? (v as QuestStatus) : "active";
}

export function parseQuest(slug: string, text: string, sha?: string): Quest {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  let fm: Record<string, unknown> = {};
  let description = text;
  if (match) {
    fm = (YAML.parse(match[1]) as Record<string, unknown>) || {};
    description = match[2].replace(/^\n+/, "");
  }
  const objectives = Array.isArray(fm.objectives)
    ? (fm.objectives as unknown[]).map((o) => ({ text: String((o as Objective)?.text ?? ""), done: Boolean((o as Objective)?.done) }))
    : [];
  return {
    slug,
    sha,
    frontmatter: {
      title: String(fm.title || slug),
      status: normStatus(fm.status),
      arc: fm.arc ? String(fm.arc) : undefined,
      reward: fm.reward ? String(fm.reward) : undefined,
      visibility: fm.visibility === "players" ? "players" : "gm",
      objectives,
      participants: Array.isArray(fm.participants) ? (fm.participants as unknown[]).map(String) : [],
      locations: Array.isArray(fm.locations) ? (fm.locations as unknown[]).map(String) : []
    },
    description
  };
}

export function serializeQuest(frontmatter: QuestFrontmatter, description: string): string {
  return `---\n${YAML.stringify(frontmatter)}---\n\n${description.trim()}\n`;
}

export async function listQuests(campaign: Campaign, userToken?: string | null): Promise<Quest[]> {
  const storage = adapterFor(campaign, userToken);
  const files = await storage.listDirectoryTextFiles(questsDir);
  return files
    .map((f) => parseQuest(f.name.replace(/\.md$/, ""), f.text ?? "", f.sha))
    .sort((a, b) => a.frontmatter.title.localeCompare(b.frontmatter.title));
}

export async function getQuest(campaign: Campaign, slug: string, userToken?: string | null): Promise<Quest> {
  const storage = adapterFor(campaign, userToken);
  const file = await storage.getTextFile(`${questsDir}/${slug}.md`);
  return parseQuest(slug, file.text, file.sha);
}

export async function createQuest(campaign: Campaign, title: string, userToken?: string | null): Promise<Quest> {
  const storage = adapterFor(campaign, userToken);
  const slug = slugify(title) || `quest-${Date.now()}`;
  const frontmatter: QuestFrontmatter = { title, status: "active", visibility: "gm", objectives: [], participants: [], locations: [] };
  await storage.putFile(`${questsDir}/${slug}.md`, serializeQuest(frontmatter, ""), `CampaignRepo: create quest ${title}`);
  return { slug, frontmatter, description: "" };
}

export async function saveQuest(campaign: Campaign, slug: string, frontmatter: QuestFrontmatter, description: string, userToken?: string | null): Promise<Quest> {
  const storage = adapterFor(campaign, userToken);
  let sha: string | undefined;
  try {
    const existing = await storage.getTextFile(`${questsDir}/${slug}.md`);
    sha = existing.sha;
  } catch { /* new file */ }
  await storage.putFile(`${questsDir}/${slug}.md`, serializeQuest(frontmatter, description), `CampaignRepo: update quest ${frontmatter.title}`, sha);
  return { slug, sha, frontmatter, description };
}

export async function deleteQuest(campaign: Campaign, slug: string, userToken?: string | null): Promise<void> {
  const storage = adapterFor(campaign, userToken);
  const existing = await storage.getTextFile(`${questsDir}/${slug}.md`);
  await storage.deleteFile(`${questsDir}/${slug}.md`, `CampaignRepo: delete quest ${slug}`, existing.sha);
}

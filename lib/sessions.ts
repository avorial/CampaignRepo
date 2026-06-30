import YAML from "yaml";
import { getStorageAdapter } from "@/lib/storage";
import { slugify } from "@/lib/slug";
import type { Campaign } from "@/lib/types";
import type { WorldDate } from "@/lib/calendar";

export type AgendaItem = { text: string; done: boolean };
export type AssetLink = { label: string; url: string };
export type Attendee = { name: string; status: "present" | "late" | "left-early" | "absent" };
export type Thread = { text: string; done: boolean };

export type SessionFrontmatter = {
  title: string;
  number?: number;
  date?: string;
  worldDate?: WorldDate;
  status?: "planned" | "played" | "cancelled";
  mood?: string;
  arc?: string;
  attendees: Attendee[];
  assets: AssetLink[];
  agenda: AgendaItem[];
  summary?: string;
  npcs: string[];
  locations: string[];
  threads: Thread[];
  pinned: string[];
};

export type Session = { slug: string; sha?: string; frontmatter: SessionFrontmatter; notes: string };

const sessionsDir = "wiki/sessions";

function adapterFor(campaign: Campaign, userToken?: string | null) {
  const storage = getStorageAdapter(campaign, userToken);
  if (!storage) throw new Error("No storage configured for this campaign.");
  return storage;
}

export function parseSession(slug: string, text: string, sha?: string): Session {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  let fm: Record<string, unknown> = {};
  let notes = text;
  if (match) {
    fm = (YAML.parse(match[1]) as Record<string, unknown>) || {};
    notes = match[2].replace(/^\n+/, "");
  }

  const agenda = Array.isArray(fm.agenda)
    ? (fm.agenda as unknown[]).map((a) => ({ text: String((a as AgendaItem)?.text ?? ""), done: Boolean((a as AgendaItem)?.done) }))
    : [];

  const attendees = Array.isArray(fm.attendees)
    ? (fm.attendees as unknown[]).map((a) => ({
        name: String((a as Attendee)?.name ?? ""),
        status: (["present", "late", "left-early", "absent"].includes(String((a as Attendee)?.status))
          ? (a as Attendee).status
          : "present") as Attendee["status"]
      })).filter((a) => a.name)
    : [];

  const assets = Array.isArray(fm.assets)
    ? (fm.assets as unknown[]).map((a) => ({
        label: String((a as AssetLink)?.label ?? ""),
        url: String((a as AssetLink)?.url ?? "")
      })).filter((a) => a.url)
    : [];

  const threads = Array.isArray(fm.threads)
    ? (fm.threads as unknown[]).map((t) => ({ text: String((t as Thread)?.text ?? ""), done: Boolean((t as Thread)?.done) }))
    : [];

  const validStatus = ["planned", "played", "cancelled"];

  return {
    slug,
    sha,
    frontmatter: {
      title: String(fm.title || slug),
      number: fm.number ? Number(fm.number) : undefined,
      date: fm.date ? String(fm.date) : undefined,
      worldDate: fm.worldDate && typeof fm.worldDate === "object" && !Array.isArray(fm.worldDate)
        ? { year: Math.max(1, Number((fm.worldDate as Record<string,unknown>).year) || 1), month: Math.max(1, Number((fm.worldDate as Record<string,unknown>).month) || 1), day: Math.max(1, Number((fm.worldDate as Record<string,unknown>).day) || 1) }
        : undefined,
      status: validStatus.includes(String(fm.status)) ? fm.status as SessionFrontmatter["status"] : undefined,
      mood: fm.mood ? String(fm.mood) : undefined,
      arc: fm.arc ? String(fm.arc) : undefined,
      attendees,
      assets,
      agenda,
      summary: fm.summary ? String(fm.summary) : undefined,
      npcs: Array.isArray(fm.npcs) ? (fm.npcs as unknown[]).map(String) : [],
      locations: Array.isArray(fm.locations) ? (fm.locations as unknown[]).map(String) : [],
      threads,
      pinned: Array.isArray(fm.pinned) ? (fm.pinned as unknown[]).map(String) : []
    },
    notes
  };
}

export function serializeSession(frontmatter: SessionFrontmatter, notes: string): string {
  const fm: Record<string, unknown> = { title: frontmatter.title };
  if (frontmatter.number != null) fm.number = frontmatter.number;
  if (frontmatter.date) fm.date = frontmatter.date;
  if (frontmatter.worldDate) fm.worldDate = frontmatter.worldDate;
  if (frontmatter.status) fm.status = frontmatter.status;
  if (frontmatter.mood) fm.mood = frontmatter.mood;
  if (frontmatter.arc) fm.arc = frontmatter.arc;
  if (frontmatter.attendees.length) fm.attendees = frontmatter.attendees;
  if (frontmatter.assets.length) fm.assets = frontmatter.assets;
  fm.agenda = frontmatter.agenda;
  if (frontmatter.summary) fm.summary = frontmatter.summary;
  if (frontmatter.npcs.length) fm.npcs = frontmatter.npcs;
  if (frontmatter.locations.length) fm.locations = frontmatter.locations;
  if (frontmatter.threads.length) fm.threads = frontmatter.threads;
  if (frontmatter.pinned.length) fm.pinned = frontmatter.pinned;
  return `---\n${YAML.stringify(fm)}---\n\n${notes.trim()}\n`;
}

export async function listSessions(campaign: Campaign, userToken?: string | null): Promise<Session[]> {
  const storage = adapterFor(campaign, userToken);
  const files = await storage.listDirectoryTextFiles(sessionsDir);
  return files
    .map((f) => parseSession(f.name.replace(/\.md$/, ""), f.text ?? "", f.sha))
    .sort((a, b) => (b.frontmatter.date || "").localeCompare(a.frontmatter.date || "") || a.frontmatter.title.localeCompare(b.frontmatter.title));
}

export async function getSession(campaign: Campaign, slug: string, userToken?: string | null): Promise<Session> {
  const storage = adapterFor(campaign, userToken);
  const file = await storage.getTextFile(`${sessionsDir}/${slug}.md`);
  return parseSession(slug, file.text, file.sha);
}

export async function createSession(campaign: Campaign, title: string, date?: string, userToken?: string | null): Promise<Session> {
  const storage = adapterFor(campaign, userToken);
  const slug = slugify(title) || `session-${Date.now()}`;
  const frontmatter: SessionFrontmatter = { title, date, attendees: [], assets: [], agenda: [], npcs: [], locations: [], threads: [], pinned: [] };
  await storage.putFile(`${sessionsDir}/${slug}.md`, serializeSession(frontmatter, ""), `CampaignRepo: create session ${title}`);
  return { slug, frontmatter, notes: "" };
}

export async function saveSession(campaign: Campaign, slug: string, frontmatter: SessionFrontmatter, notes: string, userToken?: string | null): Promise<Session> {
  const storage = adapterFor(campaign, userToken);
  let sha: string | undefined;
  try {
    const existing = await storage.getTextFile(`${sessionsDir}/${slug}.md`);
    sha = existing.sha;
  } catch { /* new file */ }
  await storage.putFile(`${sessionsDir}/${slug}.md`, serializeSession(frontmatter, notes), `CampaignRepo: update session ${frontmatter.title}`, sha);
  return { slug, sha, frontmatter, notes };
}

export async function deleteSession(campaign: Campaign, slug: string, userToken?: string | null): Promise<void> {
  const storage = adapterFor(campaign, userToken);
  const existing = await storage.getTextFile(`${sessionsDir}/${slug}.md`);
  await storage.deleteFile(`${sessionsDir}/${slug}.md`, `CampaignRepo: delete session ${slug}`, existing.sha);
}

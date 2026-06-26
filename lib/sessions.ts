import YAML from "yaml";
import { getStorageAdapter } from "@/lib/storage";
import { slugify } from "@/lib/slug";
import type { Campaign } from "@/lib/types";

export type AgendaItem = { text: string; done: boolean };
export type SessionFrontmatter = {
  title: string;
  date?: string;
  status?: string;
  agenda: AgendaItem[];
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
  return {
    slug,
    sha,
    frontmatter: {
      title: String(fm.title || slug),
      date: fm.date ? String(fm.date) : undefined,
      status: fm.status ? String(fm.status) : undefined,
      agenda,
      pinned: Array.isArray(fm.pinned) ? (fm.pinned as unknown[]).map(String) : []
    },
    notes
  };
}

export function serializeSession(frontmatter: SessionFrontmatter, notes: string): string {
  return `---\n${YAML.stringify(frontmatter)}---\n\n${notes.trim()}\n`;
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
  const frontmatter: SessionFrontmatter = { title, date, agenda: [], pinned: [] };
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

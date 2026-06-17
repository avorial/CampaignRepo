import matter from "gray-matter";
import yaml from "yaml";
import type { ApprovalStatus, Category, Visibility, WikiLink, WikiPage, WikiPageFrontmatter } from "@/lib/types";
import { defaultFrontmatter } from "@/lib/templates";

const wikiLinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const gmBlockPattern = /:::gm[\s\S]*?:::/g;

export function parseWikiLinks(content: string): WikiLink[] {
  const links: WikiLink[] = [];
  for (const match of content.matchAll(wikiLinkPattern)) {
    const target = match[1].trim();
    links.push({ target, label: (match[2] || target).trim() });
  }
  return links;
}

export function stripGmBlocks(content: string) {
  return content.replace(gmBlockPattern, "");
}

export function normalizeFrontmatter(raw: Record<string, unknown>, fallbackName: string): WikiPageFrontmatter {
  const category = String(raw.category || raw.type || "npc").toLowerCase() as Category;
  return {
    ...defaultFrontmatter(String(raw.name || fallbackName), category),
    ...raw,
    category,
    type: String(raw.type || category),
    name: String(raw.name || fallbackName),
    summary: String(raw.summary || ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    visibility: (raw.visibility === "players" ? "players" : "gm") as Visibility,
    approvalStatus: (raw.approvalStatus || "approved") as ApprovalStatus,
    knownToPlayers: Boolean(raw.knownToPlayers ?? raw.visibility === "players"),
    keyLinks: Array.isArray(raw.keyLinks) ? raw.keyLinks.map(String) : [],
    aliases: Array.isArray(raw.aliases) ? raw.aliases.map(String) : [],
    tradeCodes: Array.isArray(raw.tradeCodes) ? raw.tradeCodes.map(String) : undefined
  };
}

export function parsePage(slug: string, raw: string, sha?: string): WikiPage {
  const parsed = matter(raw);
  const fallbackName = slug.replace(/-/g, " ");
  const frontmatter = normalizeFrontmatter(parsed.data, fallbackName);
  const content = parsed.content.trimStart();
  return {
    slug,
    sha,
    frontmatter,
    content,
    raw,
    outgoingLinks: parseWikiLinks(content),
    backlinks: []
  };
}

export function serializePage(frontmatter: WikiPageFrontmatter, content: string) {
  const fm = yaml.stringify(frontmatter).trim();
  return `---\n${fm}\n---\n\n${content.trimStart()}`;
}

export function renderMarkdownLite(content: string, mode: "gm" | "player") {
  const source = mode === "player" ? stripGmBlocks(content) : content.replace(/:::gm/g, '<section class="gm-block"><strong>GM</strong>').replace(/:::/g, "</section>");
  return source
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a data-wikilink="$1">$2</a>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a data-wikilink="$1">$1</a>')
    .split(/\n{2,}/)
    .map((block) => (block.startsWith("<") ? block : `<p>${block.replace(/\n/g, "<br />")}</p>`))
    .join("\n");
}

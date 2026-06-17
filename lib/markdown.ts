import matter from "gray-matter";
import yaml from "yaml";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
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

export type RenderMode = "gm" | "player" | "handout";

/** Resolve a `[[target]]` to an href and whether the page is missing. */
export type WikiLinkResolver = (target: string) => { href: string; missing: boolean };

const gmBlockSplitter = /:::gm\s*([\s\S]*?):::/g;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderWikiLink(target: string, label: string, resolve?: WikiLinkResolver) {
  const text = escapeHtml((label || target).trim());
  if (!resolve) return `<a class="wiki-link">${text}</a>`;
  const { href, missing } = resolve(target.trim());
  const attrs = missing
    ? `class="wiki-link missing" href="${escapeHtml(href)}" data-missing="true" data-target="${escapeHtml(target.trim())}"`
    : `class="wiki-link" href="${escapeHtml(href)}"`;
  return `<a ${attrs}>${text}</a>`;
}

/** Convert wiki-link syntax, run through marked, but do not sanitize (caller wraps). */
function renderInline(markdown: string, resolve?: WikiLinkResolver) {
  const withLinks = markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) =>
    renderWikiLink(String(target), label ? String(label) : "", resolve)
  );
  return marked.parse(withLinks, { async: false }) as string;
}

/**
 * Render campaign Markdown to sanitized HTML.
 * - `player`/`handout` modes strip `:::gm` secret blocks entirely.
 * - `gm` mode renders each secret block as a styled `.gm-block` section.
 * - `[[Wiki Links]]` become anchors via the optional resolver.
 * Output is always passed through DOMPurify, so untrusted page bodies cannot
 * inject script or event-handler attributes.
 */
export function renderMarkdown(content: string, mode: RenderMode, resolve?: WikiLinkResolver) {
  let html: string;
  if (mode !== "gm") {
    html = renderInline(stripGmBlocks(content), resolve);
  } else {
    let out = "";
    let last = 0;
    for (const match of content.matchAll(gmBlockSplitter)) {
      const index = match.index ?? 0;
      out += renderInline(content.slice(last, index), resolve);
      out += `<section class="gm-block"><strong>GM</strong>${renderInline(match[1], resolve)}</section>`;
      last = index + match[0].length;
    }
    out += renderInline(content.slice(last), resolve);
    html = out;
  }
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-missing", "data-target"] });
}

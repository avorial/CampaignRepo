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
    parent: raw.parent ? String(raw.parent) : undefined,
    cover: raw.cover ? String(raw.cover) : undefined,
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
export type MediaPathResolver = (path: string) => string;
/** Return the Markdown content of an embedded `![[Page]]`, or null if missing. */
export type IncludeResolver = (target: string) => string | null;

const gmBlockSplitter = /:::gm\s*([\s\S]*?):::/g;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Heading-anchor slug for in-page section links. */
function anchorize(text: string) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function renderWikiLink(target: string, label: string, resolve?: WikiLinkResolver) {
  const hashIndex = target.indexOf("#");
  const pageTarget = (hashIndex >= 0 ? target.slice(0, hashIndex) : target).trim();
  const section = hashIndex >= 0 ? target.slice(hashIndex + 1).trim() : "";
  const defaultText = label || (section && pageTarget ? `${pageTarget} › ${section}` : section || pageTarget);
  const text = escapeHtml(defaultText.trim());
  // Same-page section link: [[#Section]]
  if (!pageTarget) return `<a class="wiki-link" href="#${escapeHtml(anchorize(section))}">${text}</a>`;
  if (!resolve) return `<a class="wiki-link">${text}</a>`;
  const { href, missing } = resolve(pageTarget);
  const fullHref = section ? `${href}#${anchorize(section)}` : href;
  const attrs = missing
    ? `class="wiki-link missing" href="${escapeHtml(fullHref)}" data-missing="true" data-target="${escapeHtml(pageTarget)}"`
    : `class="wiki-link" href="${escapeHtml(fullHref)}"`;
  return `<a ${attrs}>${text}</a>`;
}

function addHeadingIds(html: string) {
  return html.replace(/<(h[1-6])>([\s\S]*?)<\/\1>/g, (match, tag, inner) => {
    const id = anchorize(inner.replace(/<[^>]+>/g, ""));
    return id ? `<${tag} id="${id}">${inner}</${tag}>` : match;
  });
}

/** Convert wiki-link syntax, run through marked, but do not sanitize (caller wraps). */
function renderInline(markdown: string, resolve?: WikiLinkResolver, resolveMedia?: MediaPathResolver) {
  // Any leftover (nested) include markers degrade to normal links.
  const withLinks = markdown
    .replace(/!\[\[/g, "[[")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) =>
      renderWikiLink(String(target), label ? String(label) : "", resolve)
    );
  let html = addHeadingIds(marked.parse(withLinks, { async: false }) as string);
  if (resolveMedia) {
    html = html.replace(/(src|href)="\/wiki\/media\/([^"]+)"/g, (_match, attr, path) => {
      return `${attr}="${escapeHtml(resolveMedia(decodeURIComponent(String(path))))}"`;
    });
  }
  return html;
}

function mediaSrc(path: string, resolveMedia?: MediaPathResolver) {
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed) || !resolveMedia) return trimmed;
  const rel = trimmed.replace(/^\/?wiki\/media\//, "");
  return resolveMedia(decodeURIComponent(rel));
}

/** Expand `:::gallery ... :::` blocks into an image grid. */
function expandGalleries(content: string, resolveMedia?: MediaPathResolver) {
  return content.replace(/:::gallery\s*([\s\S]*?):::/g, (_match, inner) => {
    const md = [...String(inner).matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((m) => ({ alt: m[1], path: m[2] }));
    const items = md.length
      ? md
      : String(inner)
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((path) => ({ alt: "", path }));
    if (!items.length) return "";
    const imgs = items
      .map((item) => `<a class="gallery-item" href="${escapeHtml(mediaSrc(item.path, resolveMedia))}" target="_blank" rel="noreferrer"><img src="${escapeHtml(mediaSrc(item.path, resolveMedia))}" alt="${escapeHtml(item.alt)}" loading="lazy" /></a>`)
      .join("");
    return `\n\n<div class="gallery">${imgs}</div>\n\n`;
  });
}

/** Expand `![[Page]]` embeds inline (one level) using the include resolver. */
function expandIncludes(content: string, resolve?: IncludeResolver) {
  if (!resolve) return content;
  return content.replace(/!\[\[([^\]]+?)\]\]/g, (_match, inner) => {
    const target = String(inner).split("#")[0].split("|")[0].trim();
    const included = resolve(target);
    if (included == null) return `*(missing embed: ${target})*`;
    // Inline the embedded Markdown so it renders; a rule sets it off visually.
    return `\n\n---\n\n${included}\n\n---\n\n`;
  });
}

/**
 * Render campaign Markdown to sanitized HTML.
 * - `player`/`handout` modes strip `:::gm` secret blocks entirely.
 * - `gm` mode renders each secret block as a styled `.gm-block` section.
 * - `[[Wiki Links]]` become anchors via the optional resolver.
 * Output is always passed through DOMPurify, so untrusted page bodies cannot
 * inject script or event-handler attributes.
 */
export function renderMarkdown(content: string, mode: RenderMode, resolve?: WikiLinkResolver, resolveMedia?: MediaPathResolver, resolveInclude?: IncludeResolver) {
  content = expandIncludes(content, resolveInclude);
  content = expandGalleries(content, resolveMedia);
  let html: string;
  if (mode !== "gm") {
    html = renderInline(stripGmBlocks(content), resolve, resolveMedia);
  } else {
    let out = "";
    let last = 0;
    for (const match of content.matchAll(gmBlockSplitter)) {
      const index = match.index ?? 0;
      out += renderInline(content.slice(last, index), resolve, resolveMedia);
      out += `<section class="gm-block"><strong>GM</strong>${renderInline(match[1], resolve, resolveMedia)}</section>`;
      last = index + match[0].length;
    }
    out += renderInline(content.slice(last), resolve, resolveMedia);
    html = out;
  }
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-label", "data-missing", "data-target"] });
}

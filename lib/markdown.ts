import matter from "gray-matter";
import yaml from "yaml";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import type { ApprovalStatus, Category, TravellerSheet, Visibility, WikiLink, WikiPage, WikiPageFrontmatter } from "@/lib/types";
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

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function normalizeTravellerSheet(input: unknown): TravellerSheet & { name?: string } {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const characteristics = raw.characteristics && typeof raw.characteristics === "object" && !Array.isArray(raw.characteristics)
    ? raw.characteristics as Record<string, unknown>
    : {};
  return {
    system: "traveller",
    name: raw.name ? String(raw.name) : undefined,
    characteristics: {
      STR: asNumber(characteristics.STR, 7),
      DEX: asNumber(characteristics.DEX, 7),
      END: asNumber(characteristics.END, 7),
      INT: asNumber(characteristics.INT, 7),
      EDU: asNumber(characteristics.EDU, 7),
      SOC: asNumber(characteristics.SOC, 7)
    },
    skills: asRecordArray(raw.skills).map((skill) => ({
      name: String(skill.name || ""),
      speciality: skill.speciality ? String(skill.speciality) : undefined,
      level: asNumber(skill.level, 0)
    })).filter((skill) => skill.name),
    age: raw.age == null || raw.age === "" ? undefined : asNumber(raw.age),
    species: raw.species ? String(raw.species) : undefined,
    homeworld: raw.homeworld ? String(raw.homeworld) : undefined,
    uwp: raw.uwp ? String(raw.uwp) : undefined,
    career: raw.career ? String(raw.career) : undefined,
    rank: raw.rank ? String(raw.rank) : undefined,
    dossier: raw.dossier ? String(raw.dossier) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    conditions: asStringArray(raw.conditions),
    speciesTraits: asStringArray(raw.speciesTraits || raw.traits),
    credits: raw.credits == null || raw.credits === "" ? undefined : asNumber(raw.credits),
    armour: asRecordArray(raw.armour).map((item) => ({ name: String(item.name || ""), protection: item.protection ? String(item.protection) : undefined, notes: item.notes ? String(item.notes) : undefined })).filter((item) => item.name),
    weapons: asRecordArray(raw.weapons).map((item) => ({ name: String(item.name || ""), damage: item.damage ? String(item.damage) : undefined, range: item.range ? String(item.range) : undefined, notes: item.notes ? String(item.notes) : undefined })).filter((item) => item.name),
    equipment: asRecordArray(raw.equipment).map((item) => ({ name: String(item.name || ""), quantity: item.quantity == null ? undefined : asNumber(item.quantity), notes: item.notes ? String(item.notes) : undefined })).filter((item) => item.name),
    holdings: asRecordArray(raw.holdings).map((item) => ({ name: String(item.name || ""), notes: item.notes ? String(item.notes) : undefined })).filter((item) => item.name),
    contacts: asRecordArray(raw.contacts).map((item) => ({ name: String(item.name || ""), notes: item.notes ? String(item.notes) : undefined })).filter((item) => item.name),
    psionics: asRecordArray(raw.psionics).map((item) => ({ name: String(item.name || ""), level: item.level == null ? undefined : asNumber(item.level), notes: item.notes ? String(item.notes) : undefined })).filter((item) => item.name),
    notes: raw.notes ? String(raw.notes) : undefined
  };
}

function travellerDM(value: number): number {
  if (value <= 0) return -3;
  if (value <= 2) return -2;
  if (value <= 5) return -1;
  if (value <= 8) return 0;
  if (value <= 11) return 1;
  if (value <= 14) return 2;
  return 3;
}

const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const detail = (parts: unknown[]) => parts.filter((part) => part !== undefined && part !== null && part !== "").map(String).join(" - ");

function renderTravellerSheetHtml(rawInput: string) {
  let parsed: unknown;
  try {
    parsed = yaml.parse(rawInput) || {};
  } catch (error) {
    return `<section class="tsheet tsheet-error"><p>Traveller sheet data could not be parsed: ${escapeHtml(error instanceof Error ? error.message : "invalid YAML")}</p></section>`;
  }
  const sheet = normalizeTravellerSheet(parsed);
  const chars: Array<[keyof TravellerSheet["characteristics"], string]> = [["STR", "Strength"], ["DEX", "Dexterity"], ["END", "Endurance"], ["INT", "Intellect"], ["EDU", "Education"], ["SOC", "Social Standing"]];
  const skills = [...sheet.skills].sort((a, b) => a.name.localeCompare(b.name) || (a.speciality || "").localeCompare(b.speciality || ""));
  const columns = [skills.filter((_, index) => index % 3 === 0), skills.filter((_, index) => index % 3 === 1), skills.filter((_, index) => index % 3 === 2)];
  const dossier = sheet.dossier || detail([sheet.career, sheet.rank]) || "Travel";
  const traits = sheet.speciesTraits?.length ? sheet.speciesTraits : [sheet.species || "Traveller"];
  const weapons = sheet.weapons || [];
  const armour = sheet.armour || [];
  const equipment = sheet.equipment || [];
  const holdings = sheet.holdings || [];
  const contacts = sheet.contacts || [];
  const psionics = sheet.psionics || [];
  const list = (items: string[]) => `<ul class="tsheet-skills">${items.join("")}</ul>`;
  return `
<section class="tsheet">
  <header class="tsheet-registry"><span>Solomani Confederation</span><span>Genetic Record</span><span>Form Sol-GR1 - Racial Registry</span></header>
  <div class="tsheet-dossier">
    <div class="tsheet-upload"><strong>${escapeHtml(String((sheet.rank || sheet.career || "F").charAt(0)).toUpperCase())}</strong><span>Upload</span></div>
    <div class="tsheet-identity">
      <strong class="tsheet-name">${escapeHtml(sheet.name || "Unnamed Traveller")}</strong>
      <div class="tsheet-facts">
        <span><b>Race / Species</b>${escapeHtml(sheet.species || "-")}</span>
        <span><b>Age (Years)</b>${sheet.age ?? "-"}</span>
        <span><b>Homeworld</b>${escapeHtml(sheet.homeworld || "-")}</span>
        <span><b>Dossier</b>${escapeHtml(dossier)}</span>
      </div>
    </div>
  </div>
  <div class="tsheet-topgrid">
    <section class="tsheet-panel"><h4>Characteristics <span>Click a value to roll 2D6 + that DM</span></h4><div class="tsheet-chars">
      ${chars.map(([key, label]) => {
        const value = sheet.characteristics[key] ?? 0;
        return `<div class="tsheet-char"><span class="tsheet-char-key">${key}</span><span class="tsheet-char-label">${escapeHtml(label)}</span><span class="tsheet-char-val">${value}</span><span class="tsheet-char-mod">Mod ${fmtMod(travellerDM(value))}</span></div>`;
      }).join("")}
    </div></section>
    <section class="tsheet-panel"><h4>Wielded <span>Add weapons in the sheet block</span></h4>${weapons.length ? list(weapons.map((weapon) => `<li><span>${escapeHtml(weapon.name)}</span><span>${escapeHtml(detail([weapon.damage, weapon.range, weapon.notes]))}</span></li>`)) : `<p class="tsheet-empty">No weapons.</p>`}</section>
  </div>
  <section class="tsheet-panel tsheet-band"><h4>Status &amp; Conditions <span>Wound status + active conditions</span></h4><strong class="tsheet-status">${escapeHtml(sheet.status || "Unwounded")}</strong><span>${escapeHtml(sheet.conditions?.length ? sheet.conditions.join(", ") : "No active conditions")}</span></section>
  <section class="tsheet-panel tsheet-band"><h4>Species <span>${escapeHtml(sheet.species || "Traveller")}</span></h4><div class="badges">${traits.map((trait) => `<span>${escapeHtml(trait)}</span>`).join("")}</div></section>
  <section class="tsheet-panel"><h4>Skills <span>Total levels: ${skills.reduce((sum, skill) => sum + skill.level, 0)}</span></h4>${skills.length ? `<div class="tsheet-skill-cols">${columns.map((column) => list(column.map((skill) => `<li><span>${escapeHtml(skill.name)}${skill.speciality ? ` (${escapeHtml(skill.speciality)})` : ""}</span><span class="tsheet-skill-lvl">${skill.level}</span></li>`))).join("")}</div>` : `<p class="tsheet-empty">No skills recorded.</p>`}</section>
  <section class="tsheet-panel"><div class="tsheet-tabs"><span>Combat</span><span>Gear</span><span>Holdings</span><span>People</span><span>Psionics</span><span>Notes</span></div><div class="tsheet-cols">
    <div><h4>Armour</h4>${armour.length ? list(armour.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(detail([item.protection, item.notes]))}</span></li>`)) : `<p class="tsheet-empty">No armour recorded.</p>`}<h4>Weapons</h4>${weapons.length ? list(weapons.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(detail([item.damage, item.range, item.notes]))}</span></li>`)) : `<p class="tsheet-empty">No weapons recorded yet.</p>`}</div>
    <div><h4>Gear &amp; Holdings</h4>${equipment.length || holdings.length ? list([...equipment.map((item) => `<li><span>${escapeHtml(item.name)}${item.notes ? ` - ${escapeHtml(item.notes)}` : ""}</span>${item.quantity && item.quantity > 1 ? `<span class="tsheet-skill-lvl">x${item.quantity}</span>` : ""}</li>`), ...holdings.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(item.notes || "")}</span></li>`)]): `<p class="tsheet-empty">No gear recorded.</p>`}<h4>People &amp; Notes</h4>${contacts.length || psionics.length || sheet.notes ? list([...contacts.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(item.notes || "")}</span></li>`), ...psionics.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(detail([item.level, item.notes]))}</span></li>`), ...(sheet.notes ? [`<li><span>${escapeHtml(sheet.notes)}</span></li>`] : [])]) : `<p class="tsheet-empty">No people or notes recorded.</p>`}${sheet.credits != null ? `<p class="tsheet-credits">${sheet.credits.toLocaleString()} Cr</p>` : ""}</div>
  </div></section>
</section>`;
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

/** Expand fenced `traveller-sheet` YAML blocks into the designed sheet. */
function expandTravellerSheets(content: string) {
  return content.replace(/```traveller-sheet\s*\n([\s\S]*?)```/g, (_match, inner) => {
    return `\n\n${renderTravellerSheetHtml(String(inner))}\n\n`;
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
  content = expandTravellerSheets(content);
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

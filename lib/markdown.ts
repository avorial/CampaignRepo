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

function asOptionalNumber(value: unknown) {
  return value == null || value === "" ? undefined : asNumber(value);
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function asSkillNameParts(label: string) {
  const match = label.trim().match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (!match) return { name: label.trim() };
  return { name: match[1].trim(), speciality: match[2].trim() };
}

function normalizeTravellerSkills(value: unknown): TravellerSheet["skills"] {
  if (Array.isArray(value)) {
    return value.map((skill) => {
      if (typeof skill === "string") return { ...asSkillNameParts(skill) };
      if (!skill || typeof skill !== "object" || Array.isArray(skill)) return null;
      const raw = skill as Record<string, unknown>;
      return {
        name: String(raw.name || ""),
        speciality: raw.speciality ? String(raw.speciality) : undefined,
        level: asOptionalNumber(raw.level)
      };
    }).filter((skill): skill is TravellerSheet["skills"][number] => Boolean(skill?.name));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([label, level]) => ({
      ...asSkillNameParts(label),
      level: asOptionalNumber(level)
    })).filter((skill) => skill.name);
  }
  return [];
}

function compactParts(value: unknown) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  const text = String(value);
  return text.split(text.includes("|") ? "|" : ",").map((item) => item.trim()).filter(Boolean);
}

function compactRecords<T>(value: unknown, mapper: (name: string, parts: string[]) => T): T[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([name, detailValue]) => mapper(name.trim(), compactParts(detailValue)))
    .filter((item) => Boolean((item as { name?: string }).name));
}

const standardTravellerSkills: TravellerSheet["skills"] = [
  { name: "Admin" }, { name: "Advocate" }, { name: "Animals" }, { name: "Animals", speciality: "Handling" }, { name: "Animals", speciality: "Riding" }, { name: "Animals", speciality: "Veterinary" }, { name: "Animals", speciality: "Training" },
  { name: "Art" }, { name: "Art", speciality: "Performer" }, { name: "Art", speciality: "Holography" }, { name: "Art", speciality: "Instrument" }, { name: "Art", speciality: "Visual Media" }, { name: "Art", speciality: "Write" },
  { name: "Astrogation" }, { name: "Athletics" }, { name: "Athletics", speciality: "Dexterity" }, { name: "Athletics", speciality: "Endurance" }, { name: "Athletics", speciality: "Strength" },
  { name: "Broker" }, { name: "Carouse" }, { name: "Deception" }, { name: "Diplomat" },
  { name: "Drive" }, { name: "Drive", speciality: "Hovercraft" }, { name: "Drive", speciality: "Mole" }, { name: "Drive", speciality: "Track" }, { name: "Drive", speciality: "Walker" }, { name: "Drive", speciality: "Wheel" },
  { name: "Electronics" }, { name: "Electronics", speciality: "Comms" }, { name: "Electronics", speciality: "Computers" }, { name: "Electronics", speciality: "Remote Ops" }, { name: "Electronics", speciality: "Sensors" },
  { name: "Engineer" }, { name: "Engineer", speciality: "M-drive" }, { name: "Engineer", speciality: "J-drive" }, { name: "Engineer", speciality: "Life Support" }, { name: "Engineer", speciality: "Power" },
  { name: "Explosives" }, { name: "Flyer" }, { name: "Flyer", speciality: "Airship" }, { name: "Flyer", speciality: "Grav" }, { name: "Flyer", speciality: "Ornithopter" }, { name: "Flyer", speciality: "Rotor" }, { name: "Flyer", speciality: "Wing" },
  { name: "Gambler" }, { name: "Gun Combat" }, { name: "Gun Combat", speciality: "Archaic" }, { name: "Gun Combat", speciality: "Energy" }, { name: "Gun Combat", speciality: "Slug" },
  { name: "Gunner" }, { name: "Gunner", speciality: "Turret" }, { name: "Gunner", speciality: "Ortillery" }, { name: "Gunner", speciality: "Screen" }, { name: "Gunner", speciality: "Capital" },
  { name: "Heavy Weapons" }, { name: "Heavy Weapons", speciality: "Artillery" }, { name: "Heavy Weapons", speciality: "Man Portable" }, { name: "Heavy Weapons", speciality: "Vehicle" },
  { name: "Investigate" }, { name: "Jack-of-All-Trades" }, { name: "Language" }, { name: "Language", speciality: "Anglic" }, { name: "Language", speciality: "Vilani" }, { name: "Language", speciality: "Zdetl" }, { name: "Language", speciality: "Oynprith" },
  { name: "Leadership" }, { name: "Mechanic" }, { name: "Medic" }, { name: "Melee" }, { name: "Melee", speciality: "Unarmed" }, { name: "Melee", speciality: "Blade" }, { name: "Melee", speciality: "Bludgeon" }, { name: "Melee", speciality: "Natural" }, { name: "Melee", speciality: "Infighting" },
  { name: "Navigation" }, { name: "Persuade" }, { name: "Pilot" }, { name: "Pilot", speciality: "Small Craft" }, { name: "Pilot", speciality: "Spacecraft" }, { name: "Pilot", speciality: "Capital Ships" },
  { name: "Profession" }, { name: "Profession", speciality: "Belter" }, { name: "Profession", speciality: "Biologicals" }, { name: "Profession", speciality: "Civil Engineering" }, { name: "Profession", speciality: "Construction" }, { name: "Profession", speciality: "Hydroponics" }, { name: "Profession", speciality: "K'kree Ritual" }, { name: "Profession", speciality: "Miner" }, { name: "Profession", speciality: "Polymers" }, { name: "Profession", speciality: "Religion" },
  { name: "Recon" }, { name: "Science" }, { name: "Science", speciality: "Archaeology" }, { name: "Science", speciality: "Astronomy" }, { name: "Science", speciality: "Belief" }, { name: "Science", speciality: "Biology" }, { name: "Science", speciality: "Chemistry" }, { name: "Science", speciality: "Cosmology" }, { name: "Science", speciality: "Cybernetics" }, { name: "Science", speciality: "Economics" }, { name: "Science", speciality: "Genetics" }, { name: "Science", speciality: "History" }, { name: "Science", speciality: "Linguistics" }, { name: "Science", speciality: "Philosophy" }, { name: "Science", speciality: "Physics" }, { name: "Science", speciality: "Planetology" }, { name: "Science", speciality: "Psionicology" }, { name: "Science", speciality: "Psychology" }, { name: "Science", speciality: "Robotics" }, { name: "Science", speciality: "Sophontology" }, { name: "Science", speciality: "Xenology" },
  { name: "Seafarer" }, { name: "Seafarer", speciality: "Ocean Ships" }, { name: "Seafarer", speciality: "Personal" }, { name: "Seafarer", speciality: "Sail" }, { name: "Seafarer", speciality: "Submarine" },
  { name: "Stealth" }, { name: "Steward" }, { name: "Streetwise" }, { name: "Survival" }, { name: "Tactics" }, { name: "Tactics", speciality: "Military" }, { name: "Tactics", speciality: "Naval" }, { name: "Vacc Suit" }
];

function travellerSkillKey(skill: { name: string; speciality?: string }) {
  return `${skill.name.toLowerCase()}|${(skill.speciality || "").toLowerCase()}`;
}

function mergeTravellerSkills(skills: TravellerSheet["skills"]) {
  const byKey = new Map(skills.map((skill) => [travellerSkillKey(skill), skill]));
  const merged = standardTravellerSkills.map((standard) => {
    const { name, speciality } = standard;
    const existing = byKey.get(travellerSkillKey({ name, speciality }));
    if (existing) {
      byKey.delete(travellerSkillKey(existing));
      return existing;
    }
    return standard;
  });
  return [...merged, ...byKey.values()];
}

function splitColumns<T>(items: T[], count: number) {
  const size = Math.ceil(items.length / count);
  return Array.from({ length: count }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function normalizeTravellerHeader(raw: Record<string, unknown>): [string, string, string] {
  const fallback: [string, string, string] = ["", "", ""];
  if (Array.isArray(raw.header)) {
    const header = raw.header;
    return [0, 1, 2].map((index) => String(header[index] ?? "")) as [string, string, string];
  }
  if (raw.header && typeof raw.header === "object") {
    const header = raw.header as Record<string | number, unknown>;
    return [
      String(header.left ?? header[0] ?? ""),
      String(header.center ?? header.middle ?? header[1] ?? ""),
      String(header.right ?? header[2] ?? "")
    ];
  }
  return [
    String(raw.headerLeft || fallback[0]),
    String(raw.headerCenter || raw.headerMiddle || fallback[1]),
    String(raw.headerRight || fallback[2])
  ];
}

function normalizeTravellerSheet(input: unknown): TravellerSheet & { name?: string } {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const characteristics = raw.characteristics && typeof raw.characteristics === "object" && !Array.isArray(raw.characteristics)
    ? raw.characteristics as Record<string, unknown>
    : {};
  const skills = normalizeTravellerSkills(raw.skills);
  const equipmentInputs = [raw.equipment, raw.gear, raw.items];
  const peopleInputs = [raw.contacts, raw.people];
  const armour = [
    ...asRecordArray(raw.armour).map((item) => ({ name: String(item.name || ""), protection: item.protection ? String(item.protection) : undefined, notes: item.notes ? String(item.notes) : undefined })),
    ...compactRecords(raw.armour, (name, parts) => ({ name, protection: parts[0], notes: parts.slice(1).join(" - ") || undefined }))
  ].filter((item) => item.name);
  const weapons = [
    ...asRecordArray(raw.weapons).map((item) => ({ name: String(item.name || ""), damage: item.damage ? String(item.damage) : undefined, range: item.range ? String(item.range) : undefined, notes: item.notes ? String(item.notes) : undefined })),
    ...compactRecords(raw.weapons, (name, parts) => ({ name, damage: parts[0], range: parts[1], notes: parts.slice(2).join(" - ") || undefined }))
  ].filter((item) => item.name);
  const equipment = [
    ...equipmentInputs.flatMap((input) => asRecordArray(input).map((item) => ({ name: String(item.name || item.item || ""), quantity: item.quantity == null || item.quantity === "" ? undefined : asNumber(item.quantity), notes: item.notes ? String(item.notes) : undefined }))),
    ...equipmentInputs.flatMap((input) => compactRecords(input, (name, parts) => ({ name, quantity: parts[0] && Number.isFinite(Number.parseInt(parts[0], 10)) ? asNumber(parts[0]) : undefined, notes: (parts[0] && Number.isFinite(Number.parseInt(parts[0], 10)) ? parts.slice(1) : parts).join(" - ") || undefined })))
  ].filter((item) => item.name);
  const holdings = [
    ...asRecordArray(raw.holdings).map((item) => ({ name: String(item.name || ""), notes: item.notes ? String(item.notes) : undefined })),
    ...compactRecords(raw.holdings, (name, parts) => ({ name, notes: parts.join(" - ") || undefined }))
  ].filter((item) => item.name);
  const contacts = [
    ...peopleInputs.flatMap((input) => asRecordArray(input).map((item) => ({ name: String(item.name || ""), notes: item.notes ? String(item.notes) : undefined }))),
    ...peopleInputs.flatMap((input) => compactRecords(input, (name, parts) => ({ name, notes: parts.join(" - ") || undefined })))
  ].filter((item) => item.name);
  const psionics = [
    ...asRecordArray(raw.psionics).map((item) => ({ name: String(item.name || ""), level: item.level == null ? undefined : asNumber(item.level), notes: item.notes ? String(item.notes) : undefined })),
    ...compactRecords(raw.psionics, (name, parts) => ({ name, level: asOptionalNumber(parts[0]), notes: parts.slice(parts[0] && Number.isFinite(Number.parseInt(parts[0], 10)) ? 1 : 0).join(" - ") || undefined }))
  ].filter((item) => item.name);
  return {
    system: "traveller",
    name: raw.name ? String(raw.name) : undefined,
    header: normalizeTravellerHeader(raw),
    portrait: raw.portrait || raw.image ? String(raw.portrait || raw.image) : undefined,
    characteristics: {
      STR: asOptionalNumber(characteristics.STR),
      DEX: asOptionalNumber(characteristics.DEX),
      END: asOptionalNumber(characteristics.END),
      INT: asOptionalNumber(characteristics.INT),
      EDU: asOptionalNumber(characteristics.EDU),
      SOC: asOptionalNumber(characteristics.SOC)
    },
    skills: mergeTravellerSkills(skills),
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
    armour,
    weapons,
    equipment,
    holdings,
    contacts,
    psionics,
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
const mediaPath = (path: string) => /^https?:\/\//i.test(path) || path.startsWith("/") ? path : `/wiki/media/${path}`;

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
  const columns = splitColumns(skills, 3);
  const dossier = sheet.dossier || detail([sheet.career, sheet.rank]) || "-";
  const traits = sheet.speciesTraits?.length ? sheet.speciesTraits : (sheet.species ? [sheet.species] : []);
  const weapons = sheet.weapons || [];
  const armour = sheet.armour || [];
  const equipment = sheet.equipment || [];
  const holdings = sheet.holdings || [];
  const contacts = sheet.contacts || [];
  const psionics = sheet.psionics || [];
  const header = sheet.header || ["", "", ""];
  const list = (items: string[]) => `<ul class="tsheet-skills">${items.join("")}</ul>`;
  const upload = sheet.portrait
    ? `<img src="${escapeHtml(mediaPath(sheet.portrait))}" alt="${escapeHtml(sheet.name || "Traveller portrait")}" loading="lazy" />`
    : `<strong>${escapeHtml(sheet.rank || sheet.career ? String((sheet.rank || sheet.career || "").charAt(0)).toUpperCase() : "-")}</strong><span>Upload</span>`;
  return `
<section class="tsheet">
  <header class="tsheet-registry">${header.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</header>
  <div class="tsheet-dossier">
    <div class="tsheet-upload">${upload}</div>
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
  <section class="tsheet-panel"><h4>Characteristics <span>Click a value to roll 2D6 + that DM</span></h4><div class="tsheet-chars">
      ${chars.map(([key, label]) => {
        const value = sheet.characteristics[key];
        return `<div class="tsheet-char"><span class="tsheet-char-key">${key}</span><span class="tsheet-char-label">${escapeHtml(label)}</span><span class="tsheet-char-val">${value ?? "-"}</span><span class="tsheet-char-mod">${value == null ? "Mod -" : `Mod ${fmtMod(travellerDM(value))}`}</span></div>`;
      }).join("")}
    </div></section>
  <section class="tsheet-panel tsheet-band"><h4>Status &amp; Conditions <span>Wound status + active conditions</span></h4><strong class="tsheet-status">${escapeHtml(sheet.status || "-")}</strong><span>${escapeHtml(sheet.conditions?.length ? sheet.conditions.join(", ") : "No active conditions")}</span></section>
  <section class="tsheet-panel tsheet-band"><h4>Species <span>${escapeHtml(sheet.species || "-")}</span></h4><div class="badges">${traits.map((trait) => `<span>${escapeHtml(trait)}</span>`).join("")}</div></section>
  <details class="tsheet-panel tsheet-skill-details"><summary><h4>Skills <span>Total levels: ${skills.reduce((sum, skill) => sum + (skill.level ?? 0), 0)}</span></h4></summary>${skills.length ? `<div class="tsheet-skill-cols">${columns.map((column) => list(column.map((skill) => `<li><span>${escapeHtml(skill.name)}${skill.speciality ? ` (${escapeHtml(skill.speciality)})` : ""}</span><span class="tsheet-skill-lvl">${skill.level ?? "−"}</span></li>`))).join("")}</div>` : `<p class="tsheet-empty">No skills recorded.</p>`}</details>
  <section class="tsheet-panel"><div class="tsheet-cols">
    <div><h4>Armour</h4>${armour.length ? list(armour.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(detail([item.protection, item.notes]))}</span></li>`)) : `<p class="tsheet-empty">No armour recorded.</p>`}<h4>Weapons</h4>${weapons.length ? list(weapons.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(detail([item.damage, item.range, item.notes]))}</span></li>`)) : `<p class="tsheet-empty">No weapons recorded yet.</p>`}</div>
    <div><h4>Items &amp; Holdings</h4>${equipment.length || holdings.length ? list([...equipment.map((item) => `<li><span>${escapeHtml(item.name)}${item.notes ? ` - ${escapeHtml(item.notes)}` : ""}</span>${item.quantity && item.quantity > 1 ? `<span class="tsheet-skill-lvl">x${item.quantity}</span>` : ""}</li>`), ...holdings.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(item.notes || "")}</span></li>`)]): `<p class="tsheet-empty">No items recorded.</p>`}<h4>People &amp; Notes</h4>${contacts.length || psionics.length || sheet.notes ? list([...contacts.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(item.notes || "")}</span></li>`), ...psionics.map((item) => `<li><span>${escapeHtml(item.name)}</span><span>${escapeHtml(detail([item.level, item.notes]))}</span></li>`), ...(sheet.notes ? [`<li><span>${escapeHtml(sheet.notes)}</span></li>`] : [])]) : `<p class="tsheet-empty">No people or notes recorded.</p>`}${sheet.credits != null ? `<p class="tsheet-credits">${sheet.credits.toLocaleString()} Cr</p>` : ""}</div>
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

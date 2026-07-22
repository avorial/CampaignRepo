import matter from "gray-matter";
import yaml from "yaml";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import type { ApprovalStatus, Category, SwordChronicleAbility, SwordChronicleSheet, SwordChronicleSpecialty, TravellerSheet, WoDRated, WoDSystem, Visibility, WikiLink, WikiPage, WikiPageFrontmatter } from "@/lib/types";
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

export function stripGmBlocks(content: string, visibleGroups?: Set<string>) {
  let out = content.replace(gmBlockPattern, "");
  out = out.replace(secretBlockPattern, (_match, group, inner) => {
    if (visibleGroups?.has(group)) return inner;
    return "";
  });
  return out;
}

export function normalizeFrontmatter(raw: Record<string, unknown>, fallbackName: string): WikiPageFrontmatter {
  const category = String(raw.category || raw.type || "npc").toLowerCase() as Category;
  const name = String(raw.name || raw.title || fallbackName);
  return {
    ...defaultFrontmatter(name, category),
    ...raw,
    category,
    type: String(raw.type || category),
    name,
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
const secretBlockPattern = /:::secret\s+group="([^"]+)"\s*([\s\S]*?):::/g;

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
        const dm = value != null ? travellerDM(value) : null;
        const rollAttr = dm != null ? ` data-roll="2d6" data-mod="${dm}" data-label="${key} (${label})"` : "";
        return `<div class="tsheet-char"${rollAttr}><span class="tsheet-char-key">${key}</span><span class="tsheet-char-label">${escapeHtml(label)}</span><span class="tsheet-char-val">${value ?? "-"}</span><span class="tsheet-char-mod">${value == null ? "Mod -" : `Mod ${fmtMod(travellerDM(value))}`}</span></div>`;
      }).join("")}
    </div></section>
  <section class="tsheet-panel tsheet-band"><h4>Status &amp; Conditions <span>Wound status + active conditions</span></h4><strong class="tsheet-status">${escapeHtml(sheet.status || "-")}</strong><span>${escapeHtml(sheet.conditions?.length ? sheet.conditions.join(", ") : "No active conditions")}</span></section>
  <section class="tsheet-panel tsheet-band"><h4>Species <span>${escapeHtml(sheet.species || "-")}</span></h4><div class="badges">${traits.map((trait) => `<span>${escapeHtml(trait)}</span>`).join("")}</div></section>
  <details class="tsheet-panel tsheet-skill-details"><summary><h4>Skills <span>Total levels: ${skills.reduce((sum, skill) => sum + (skill.level ?? 0), 0)} · Click to roll</span></h4></summary>${skills.length ? `<div class="tsheet-skill-cols">${columns.map((column) => list(column.map((skill) => { const lbl = skill.name + (skill.speciality ? ` (${skill.speciality})` : ""); return `<li data-roll="2d6" data-mod="${skill.level ?? 0}" data-label="${escapeHtml(lbl)}"><span>${escapeHtml(skill.name)}${skill.speciality ? ` (${escapeHtml(skill.speciality)})` : ""}</span><span class="tsheet-skill-lvl">${skill.level ?? "−"}</span></li>`; }))).join("")}</div>` : `<p class="tsheet-empty">No skills recorded.</p>`}</details>
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

// ---- World of Darkness character sheet ----

const WOD_SYSTEM_INFO: Record<WoDSystem, { powerLabel: string; poolLabel: string; morality: string; virtueNames: [string, string, string] }> = {
  "dark-ages-vampire":  { powerLabel: "Disciplines", poolLabel: "Blood Pool", morality: "Road",      virtueNames: ["Conscience", "Self-Control", "Courage"] },
  "vampire-masquerade": { powerLabel: "Disciplines", poolLabel: "Blood Pool", morality: "Humanity",  virtueNames: ["Conscience", "Self-Control", "Courage"] },
  "werewolf-apocalypse":{ powerLabel: "Gifts",       poolLabel: "Rage",       morality: "Renown",    virtueNames: ["Conscience", "Self-Control", "Courage"] },
  "mage-ascension":     { powerLabel: "Spheres",     poolLabel: "Quintessence",morality: "Arete",    virtueNames: ["Conscience", "Self-Control", "Courage"] },
  "generic-wod":        { powerLabel: "Powers",      poolLabel: "Pool",       morality: "Morality",  virtueNames: ["Virtue I",   "Virtue II",   "Courage"] }
};

function normalizeWoDRated(input: unknown): WoDRated[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const rec = item as Record<string, unknown>;
    if (typeof rec.name === "string") {
      const descriptions = Array.isArray(rec.descriptions) ? rec.descriptions.map(String).filter(Boolean) : undefined;
      return [{ name: rec.name, score: Number(rec.score ?? 0) || 0, notes: rec.notes ? String(rec.notes) : undefined, descriptions }];
    }
    // compact: { "Alertness": 2 }
    return Object.entries(rec)
      .filter(([k]) => !["notes", "descriptions"].includes(k))
      .map(([name, val]) => ({ name, score: Number(val) || 0, notes: undefined, descriptions: undefined }));
  }).filter((r) => r.name);
}

function normalizeWoDNamed(input: unknown): { name: string; notes?: string }[] {
  if (Array.isArray(input)) {
    return input.flatMap((item: unknown) => {
      if (typeof item === "string") return item.trim() ? [{ name: item.trim() }] : [];
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const rec = item as Record<string, unknown>;
      const name = String(rec.name || rec.title || "").trim();
      if (!name) return [];
      return [{ name, notes: rec.notes ? String(rec.notes) : rec.detail ? String(rec.detail) : undefined }];
    });
  }
  return compactRecords(input, (name, parts) => ({ name, notes: parts.join(" - ") || undefined }));
}

function normalizeWoDSheet(input: unknown) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const systemRaw = String(raw.system || "");
  const SYSTEMS: WoDSystem[] = ["vampire-masquerade", "dark-ages-vampire", "werewolf-apocalypse", "mage-ascension", "generic-wod"];
  const system: WoDSystem = SYSTEMS.includes(systemRaw as WoDSystem) ? (systemRaw as WoDSystem) : "generic-wod";
  const attrs = raw.attributes && typeof raw.attributes === "object" && !Array.isArray(raw.attributes)
    ? raw.attributes as Record<string, unknown> : {};
  const virt = raw.virtues && typeof raw.virtues === "object" && !Array.isArray(raw.virtues)
    ? raw.virtues as Record<string, unknown> : {};
  const health = raw.health && typeof raw.health === "object" && !Array.isArray(raw.health)
    ? raw.health as Record<string, unknown> : {};
  const weapons = asRecordArray(raw.weapons).map((w) => ({
    name: String(w.name || ""),
    damage: w.damage ? String(w.damage) : undefined,
    notes: w.notes ? String(w.notes) : undefined
  })).filter((w) => w.name);
  const equipment = [
    ...asRecordArray(raw.equipment).map((e) => ({ name: String(e.name || ""), notes: e.notes ? String(e.notes) : undefined })),
    ...compactRecords(raw.equipment, (name, parts) => ({ name, notes: parts.join(" - ") || undefined }))
  ].filter((e) => e.name);
  return {
    system,
    name: raw.name ? String(raw.name) : undefined,
    player: raw.player ? String(raw.player) : undefined,
    clan: (raw.clan || raw.tribe || raw.tradition || raw.group) ? String(raw.clan || raw.tribe || raw.tradition || raw.group) : undefined,
    tradition: raw.tradition ? String(raw.tradition) : undefined,
    affiliation: raw.affiliation ? String(raw.affiliation) : undefined,
    chronicle: raw.chronicle ? String(raw.chronicle) : undefined,
    generation: raw.generation != null ? Number(raw.generation) || undefined : undefined,
    sire: raw.sire ? String(raw.sire) : undefined,
    nature: raw.nature ? String(raw.nature) : undefined,
    demeanor: raw.demeanor ? String(raw.demeanor) : undefined,
    essence: raw.essence ? String(raw.essence) : undefined,
    concept: raw.concept ? String(raw.concept) : undefined,
    sect: (raw.sect || raw.affiliation) ? String(raw.sect || raw.affiliation) : undefined,
    real_age: raw.real_age ? String(raw.real_age) : undefined,
    apparent_age: raw.apparent_age ? String(raw.apparent_age) : undefined,
    road: raw.road ? String(raw.road) : undefined,
    portrait: (raw.portrait || raw.image) ? String(raw.portrait || raw.image) : undefined,
    attributes: {
      strength: asOptionalNumber(attrs.strength), dexterity: asOptionalNumber(attrs.dexterity), stamina: asOptionalNumber(attrs.stamina),
      charisma: asOptionalNumber(attrs.charisma), manipulation: asOptionalNumber(attrs.manipulation), appearance: asOptionalNumber(attrs.appearance),
      perception: asOptionalNumber(attrs.perception), intelligence: asOptionalNumber(attrs.intelligence), wits: asOptionalNumber(attrs.wits)
    },
    abilities: normalizeWoDRated(raw.abilities),
    powers: normalizeWoDRated(raw.powers ?? raw.disciplines ?? raw.gifts ?? raw.spheres),
    backgrounds: normalizeWoDRated(raw.backgrounds),
    merits: normalizeWoDRated(raw.merits),
    flaws: normalizeWoDRated(raw.flaws),
    resonance: normalizeWoDRated(raw.resonance),
    virtues: {
      first: asOptionalNumber(virt.first ?? virt.conscience ?? virt.conviction),
      second: asOptionalNumber(virt.second ?? virt.self_control ?? virt.instinct),
      third: asOptionalNumber(virt.third ?? virt.courage)
    },
    willpower: asOptionalNumber(raw.willpower),
    willpower_current: asOptionalNumber(raw.willpower_current),
    // Each line names its main pool differently; they all drive the same track.
    blood: asOptionalNumber(raw.blood ?? raw.blood_pool ?? raw.rage ?? raw.quintessence),
    blood_current: asOptionalNumber(raw.blood_current ?? raw.blood_pool_current ?? raw.rage_current ?? raw.quintessence_current),
    gnosis: asOptionalNumber(raw.gnosis),
    gnosis_current: asOptionalNumber(raw.gnosis_current),
    quintessence: asOptionalNumber(raw.quintessence),
    quintessence_current: asOptionalNumber(raw.quintessence_current),
    paradox: asOptionalNumber(raw.paradox),
    // ...and its own name for the morality trait.
    humanity: asOptionalNumber(raw.humanity ?? raw.road_rating ?? raw.renown ?? raw.arete),
    health: {
      bruised: Boolean(health.bruised), hurt: Boolean(health.hurt), injured: Boolean(health.injured),
      wounded: Boolean(health.wounded), mauled: Boolean(health.mauled), crippled: Boolean(health.crippled),
      incapacitated: Boolean(health.incapacitated)
    },
    weapons, equipment,
    focus: normalizeWoDNamed(raw.focus),
    rotes: normalizeWoDNamed(raw.rotes),
    wonders: normalizeWoDNamed(raw.wonders),
    history: asStringArray(raw.history),
    description: asStringArray(raw.description),
    notes: raw.notes ? String(raw.notes) : undefined
  };
}

function renderWoDSheetHtml(rawInput: string) {
  let parsed: unknown;
  try {
    parsed = yaml.parse(rawInput) || {};
  } catch (error) {
    return `<div style="border:1px solid rgba(160,170,180,.28);padding:16px;color:#d8d1c4;font-family:Georgia,serif;"><strong style="color:#ff3834;">Sheet error:</strong> ${escapeHtml(error instanceof Error ? error.message : "invalid YAML")}</div>`;
  }
  const sheet = normalizeWoDSheet(parsed);
  const info = WOD_SYSTEM_INFO[sheet.system];
  const isVampire = sheet.system === "vampire-masquerade" || sheet.system === "dark-ages-vampire";
  const isMage = sheet.system === "mage-ascension";

  const sS = "border:1px solid rgba(160,170,180,.28);background:linear-gradient(145deg,rgba(8,10,12,.94),rgba(14,18,20,.88));padding:16px 18px;";
  const hS = "margin:0 0 12px;color:#ff3834;font-size:13px;letter-spacing:.18em;text-transform:uppercase;border-bottom:1px solid rgba(160,170,180,.22);padding-bottom:8px;";
  const shS = "color:#8794a5;border-bottom:1px solid rgba(90,112,135,.45);font-size:10px;text-transform:uppercase;letter-spacing:.14em;padding-bottom:5px;margin:0 0 8px;";

  const dF = `<span style="display:inline-block;width:10px;height:10px;border:1px solid #ff3b38;background:#b92424;transform:rotate(45deg);"></span>`;
  const dE = `<span style="display:inline-block;width:10px;height:10px;border:1px solid #24445d;background:transparent;transform:rotate(45deg);"></span>`;
  const bF = `<span style="display:inline-block;width:8px;height:8px;border:1px solid #ff3b38;background:#b92424;"></span>`;
  const bE = `<span style="display:inline-block;width:8px;height:8px;border:1px solid #24445d;background:transparent;"></span>`;

  const diamonds = (score: number | undefined, max = 5) => {
    const n = Math.min(Math.max(0, score ?? 0), max);
    return `<span style="display:inline-flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end;min-width:${Math.max(80, max * 15)}px">${Array.from({ length: max }, (_, i) => i < n ? dF : dE).join("")}</span>`;
  };
  const boxRow = (current: number | undefined, max: number) => {
    const n = Math.min(Math.max(0, current ?? 0), max);
    return `<span style="display:inline-flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end;min-width:${Math.max(80, max * 13)}px">${Array.from({ length: max }, (_, i) => i < n ? bF : bE).join("")}</span>`;
  };
  const attrRow = (label: string, score: number | undefined, note?: string) =>
    `<div style="display:grid;grid-template-columns:minmax(96px,1fr) auto;gap:12px;align-items:center;margin:10px 0;"><div><span style="color:#c6c1b5;text-transform:uppercase;letter-spacing:.04em;font-size:12px;">${escapeHtml(label)}</span>${note ? `<span style="color:#607083;font-size:9px;margin-left:8px;text-transform:uppercase;">${escapeHtml(note)}</span>` : ""}</div>${diamonds(score)}</div>`;

  const a = sheet.attributes ?? {};
  const v = sheet.virtues ?? {};
  const wp = sheet.willpower ?? 10;
  const wpc = sheet.willpower_current ?? wp;
  const bp = sheet.blood ?? 0;
  const bpc = sheet.blood_current ?? bp;
  const gn = sheet.gnosis ?? 0;
  const gnc = sheet.gnosis_current ?? gn;
  const hum = sheet.humanity ?? 0;
  const morality = sheet.road || info.morality;

  // Categorise abilities into VtM columns
  const VTM_TALENTS = new Set(["Alertness","Athletics","Awareness","Brawl","Dodge","Empathy","Expression","Intimidation","Leadership","Primal-Urge","Streetwise","Subterfuge"]);
  const VTM_SKILLS  = new Set(["Animal Ken","Crafts","Drive","Etiquette","Firearms","Larceny","Meditation","Melee","Performance","Ride","Security","Stealth","Survival","Technology"]);
  const talents: WoDRated[] = [], skills: WoDRated[] = [], knowledges: WoDRated[] = [];
  for (const ab of sheet.abilities ?? []) {
    if (VTM_TALENTS.has(ab.name)) talents.push(ab);
    else if (VTM_SKILLS.has(ab.name)) skills.push(ab);
    else knowledges.push(ab);
  }
  const [colA, labelA, colB, labelB, colC, labelC] = isVampire
    ? [talents, "Talents", skills, "Skills", knowledges, "Knowledges"]
    : [(sheet.abilities ?? []).slice(0, 10), "Abilities I",
       (sheet.abilities ?? []).slice(10, 20), "Abilities II",
       (sheet.abilities ?? []).slice(20), "Abilities III"];

  const abilRows = (items: WoDRated[]) => items.map(ab => attrRow(ab.name, ab.score, ab.notes)).join("");

  // Portrait
  const portrait = sheet.portrait
    ? `<img src="${escapeHtml(mediaPath(sheet.portrait))}" alt="${escapeHtml(sheet.name || "portrait")}" style="width:70px;height:70px;object-fit:cover;border:1px solid rgba(255,60,60,.45);filter:saturate(.92) contrast(1.08);" />`
    : `<div style="width:70px;height:70px;border:1px solid rgba(255,60,60,.45);display:flex;align-items:center;justify-content:center;font-size:24px;color:#ff3834;">${escapeHtml((sheet.name || " ").charAt(0).toUpperCase())}</div>`;

  // Header info grid
  const hFields = [
    { label: "Chronicle",            value: sheet.chronicle },
    { label: "Generation",           value: sheet.generation ? `${sheet.generation}th` : undefined },
    { label: "Sire",                 value: sheet.sire },
    { label: "Nature",               value: sheet.nature },
    { label: "Demeanor",             value: sheet.demeanor },
    { label: "Real Age / Date of Birth", value: sheet.real_age },
    { label: "Apparent Age",         value: sheet.apparent_age },
    { label: "Sect",                 value: sheet.sect },
  ].filter(f => f.value != null && f.value !== "");
  if (!hFields.length && sheet.concept) hFields.push({ label: "Concept", value: sheet.concept });
  if (!hFields.length) hFields.push({ label: "Name", value: sheet.name });
  const hFieldsHtml = hFields.map(f =>
    `<div style="border-bottom:1px solid rgba(90,112,135,.45);padding:8px 4px;"><div style="color:#66707e;font-size:9px;text-transform:uppercase;letter-spacing:.16em;">${escapeHtml(f.label)}</div><div style="color:#f1eadb;font-family:Consolas,monospace;font-size:12px;margin-top:6px;">${escapeHtml(String(f.value ?? "-"))}</div></div>`
  ).join("");

  // Disciplines/Powers
  const dotPfx = ["•","••","•••","••••","•••••"];
  const powersHtml = (sheet.powers ?? []).map(p => {
    const descs = p.descriptions ?? [];
    const descHtml = descs.length ? `<ul style="margin:8px 0 0 16px;padding:0;color:#cfc7b8;line-height:1.55;font-family:Consolas,monospace;font-size:12px;">${descs.map((d, i) => `<li>${dotPfx[i] ?? "•"} ${escapeHtml(d)}</li>`).join("")}</ul>` : "";
    return `<div style="border-bottom:1px solid rgba(90,112,135,.35);padding:8px 0;"><div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;"><strong style="color:#e8dfcf;text-transform:uppercase;letter-spacing:.06em;font-size:12px;">${escapeHtml(p.name)}</strong>${diamonds(p.score)}</div>${descHtml}</div>`;
  }).join("");

  // Merits / Flaws / Backgrounds
  const ratedList = (items: WoDRated[], label: string) => items.length
    ? `<div><h4 style="${shS}">${escapeHtml(label)}</h4><ul style="margin:0;padding-left:16px;color:#cfc7b8;line-height:1.65;">${items.map(m => `<li>${escapeHtml(m.name)} ${diamonds(m.score)}</li>`).join("")}</ul></div>`
    : "";
  const bgHtml = (sheet.backgrounds ?? []).length
    ? `<h4 style="${shS}">Backgrounds</h4><ul style="margin:0;padding-left:16px;color:#cfc7b8;line-height:1.65;">${(sheet.backgrounds ?? []).map(b => `<li>${escapeHtml(b.name)} ${diamonds(b.score)}</li>`).join("")}</ul>`
    : "";

  // Equipment
  const gearItems = [...(sheet.weapons ?? []), ...(sheet.equipment ?? [])].filter(i => i.name);
  const gearHtml = gearItems.length
    ? `<div style="margin-top:18px;border:1px solid rgba(160,170,180,.28);padding:14px 18px;background:rgba(0,0,0,.3);"><h3 style="${hS}">Equipment</h3><ul style="margin:0;padding-left:16px;color:#cfc7b8;line-height:1.65;">${gearItems.map(i => { const detail = [("damage" in i ? i.damage : undefined), i.notes].filter(Boolean).join(" · "); return `<li>${escapeHtml(i.name)}${detail ? ` <span style="color:#607083;font-size:11px;">(${escapeHtml(detail)})</span>` : ""}</li>`; }).join("")}</ul></div>`
    : "";

  const notesHtml = sheet.notes
    ? `<div style="margin-top:18px;border:1px solid rgba(160,170,180,.28);padding:14px 18px;background:rgba(0,0,0,.3);"><h3 style="${hS}">Notes</h3><p style="color:#cfc7b8;line-height:1.6;white-space:pre-wrap;margin:0;">${escapeHtml(sheet.notes)}</p></div>`
    : "";

  if (isMage) {
    const MAGE_TALENTS = new Set(["Alertness","Athletics","Awareness","Brawl","Dodge","Empathy","Expression","Intimidation","Leadership","Streetwise","Subterfuge"]);
    const MAGE_SKILLS = new Set(["Animal Ken","Crafts","Drive","Etiquette","Firearms","Meditation","Melee","Performance","Stealth","Survival","Technology"]);
    const mageTalents: WoDRated[] = [], mageSkills: WoDRated[] = [], mageKnowledges: WoDRated[] = [];
    for (const ab of sheet.abilities ?? []) {
      if (MAGE_TALENTS.has(ab.name)) mageTalents.push(ab);
      else if (MAGE_SKILLS.has(ab.name)) mageSkills.push(ab);
      else mageKnowledges.push(ab);
    }
    const mageSpheres = (() => {
      const defaults = ["Correspondence","Entropy","Forces","Life","Matter","Mind","Prime","Spirit","Time"];
      const existing = new Map((sheet.powers ?? []).map((p) => [p.name.toLowerCase(), p]));
      return defaults.map((name) => existing.get(name.toLowerCase()) || { name, score: 0 });
    })();
    const mageList = (items: WoDRated[]) =>
      `<ul class="mage-rated">${items.map((item) => `<li><span>${escapeHtml(item.name)}${item.notes ? `<em>${escapeHtml(item.notes)}</em>` : ""}</span>${diamonds(item.score)}</li>`).join("")}</ul>`;
    const mageTextList = (items: { name: string; notes?: string }[], empty: string) =>
      items.length ? `<ul class="mage-lines">${items.map((item) => `<li><b>${escapeHtml(item.name)}</b>${item.notes ? `<span>${escapeHtml(item.notes)}</span>` : ""}</li>`).join("")}</ul>` : `<p class="mage-empty">${escapeHtml(empty)}</p>`;
    const textBlock = (title: string, lines?: string[]) =>
      `<section class="mage-panel"><h4>${escapeHtml(title)}</h4>${lines?.length ? `<ul class="mage-lines">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : `<p class="mage-empty">-</p>`}</section>`;
    const mageHeaderFacts = [
      ["Player", sheet.player],
      ["Chronicle", sheet.chronicle],
      ["Nature", sheet.nature],
      ["Demeanor", sheet.demeanor],
      ["Essence", sheet.essence],
      ["Tradition", sheet.tradition || sheet.clan],
      ["Affiliation", sheet.affiliation || sheet.sect],
      ["Concept", sheet.concept]
    ].map(([label, value]) => `<div><span>${escapeHtml(String(label))}</span><b>${escapeHtml(String(value || "-"))}</b></div>`).join("");
    const poolPanel = (label: string, current: number | undefined, max: number | undefined, fallbackMax = 10) => {
      const cap = Math.max(1, max ?? current ?? fallbackMax);
      return `<div class="mage-pool"><span>${escapeHtml(label)}</span>${boxRow(current, cap)}<b>${escapeHtml(String(current ?? 0))}${max != null ? ` / ${max}` : ""}</b></div>`;
    };
    const gear = [...(sheet.weapons ?? []), ...(sheet.equipment ?? [])];

    return `
<section class="mage-sheet">
  <header class="mage-header">
    <div class="mage-sigil">${portrait}</div>
    <div>
      <span class="mage-kicker">Mage: The Ascension</span>
      <h3>${escapeHtml(sheet.name || "Unnamed Mage")}</h3>
      <p>${escapeHtml([sheet.tradition || sheet.clan, sheet.essence, sheet.concept].filter(Boolean).join(" - ") || "Awakened character")}</p>
    </div>
    <div class="mage-header-facts">${mageHeaderFacts}</div>
  </header>

  <div class="mage-grid mage-attrs">
    <section class="mage-panel"><h4>Physical</h4>${attrRow("Strength", a.strength)}${attrRow("Dexterity", a.dexterity)}${attrRow("Stamina", a.stamina)}</section>
    <section class="mage-panel"><h4>Social</h4>${attrRow("Charisma", a.charisma)}${attrRow("Manipulation", a.manipulation)}${attrRow("Appearance", a.appearance)}</section>
    <section class="mage-panel"><h4>Mental</h4>${attrRow("Perception", a.perception)}${attrRow("Intelligence", a.intelligence)}${attrRow("Wits", a.wits)}</section>
  </div>

  <div class="mage-grid mage-abilities">
    <section class="mage-panel"><h4>Talents</h4>${mageList(mageTalents)}</section>
    <section class="mage-panel"><h4>Skills</h4>${mageList(mageSkills)}</section>
    <section class="mage-panel"><h4>Knowledges</h4>${mageList(mageKnowledges)}</section>
  </div>

  <div class="mage-main">
    <section class="mage-panel mage-spheres"><h4>Spheres</h4>${mageList(mageSpheres)}</section>
    <section class="mage-panel"><h4>Backgrounds</h4>${mageList(sheet.backgrounds ?? [])}</section>
    <section class="mage-panel"><h4>Resonance</h4>${mageList(sheet.resonance ?? [])}</section>
    <section class="mage-panel"><h4>Focus</h4>${mageTextList(sheet.focus ?? [], "No focus tools recorded.")}</section>
  </div>

  <div class="mage-pools">
    ${poolPanel("Arete", sheet.humanity, 10)}
    ${poolPanel("Willpower", wpc, wp)}
    ${poolPanel("Quintessence", sheet.quintessence_current ?? bpc, sheet.quintessence ?? bp)}
    ${poolPanel("Paradox", sheet.paradox, 10)}
  </div>

  <div class="mage-bottom">
    <section class="mage-panel"><h4>Rotes</h4>${mageTextList(sheet.rotes ?? [], "No rotes recorded.")}</section>
    <section class="mage-panel"><h4>Wonders</h4>${mageTextList(sheet.wonders ?? [], "No wonders recorded.")}</section>
    <section class="mage-panel"><h4>Merits &amp; Flaws</h4>${mageList([...(sheet.merits ?? []), ...(sheet.flaws ?? []).map((f) => ({ ...f, name: `Flaw: ${f.name}` }))])}</section>
    <section class="mage-panel"><h4>Gear &amp; Combat</h4>${gear.length ? mageTextList(gear.map((item) => ({ name: item.name, notes: [("damage" in item ? item.damage : undefined), item.notes].filter(Boolean).join(" - ") || undefined })), "No gear recorded.") : `<p class="mage-empty">No gear recorded.</p>`}</section>
  </div>

  <div class="mage-bottom">
    ${textBlock("History", sheet.history)}
    ${textBlock("Description", sheet.description)}
    ${sheet.notes ? `<section class="mage-panel"><h4>Notes</h4><p>${escapeHtml(sheet.notes)}</p></section>` : ""}
  </div>
</section>`;
  }

  return `
<div style="background:#080b0d;color:#d8d1c4;border:1px solid rgba(160,170,180,.24);padding:18px;margin:20px 0;font-family:Georgia,'Times New Roman',serif;box-shadow:0 0 28px rgba(0,0,0,.42) inset;">
  <section style="border:1px solid rgba(160,170,180,.28);background:linear-gradient(135deg,rgba(8,10,12,.98),rgba(18,22,25,.9));padding:18px;margin-bottom:18px;">
    <div style="display:grid;grid-template-columns:220px 1fr;gap:22px;align-items:center;">
      <div>
        <h3 style="margin:0 0 14px;color:#ff3834;font-size:13px;letter-spacing:.18em;text-transform:uppercase;">Visage</h3>
        <div style="display:grid;grid-template-columns:74px 1fr;gap:14px;align-items:center;">
          ${portrait}
          <div>
            <div style="color:#6f7782;font-size:9px;text-transform:uppercase;letter-spacing:.14em;">${sheet.clan ? "Clan" : "Type"}</div>
            <div style="color:#f1eadb;font-size:18px;font-variant:small-caps;">${escapeHtml(sheet.clan || sheet.concept || info.powerLabel)}</div>
            <div style="color:#6f7782;font-size:9px;text-transform:uppercase;letter-spacing:.14em;margin-top:8px;">Archetype / Concept</div>
            <div style="color:#cfc7b8;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml([sheet.nature, sheet.concept].filter(Boolean).join("/") || "-")}</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:16px;text-align:center;">${hFieldsHtml}</div>
    </div>
  </section>

  <div style="display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:18px;margin-bottom:18px;">
    <section style="${sS}"><h3 style="${hS}">Physical Attributes</h3>${attrRow("Strength", a.strength)}${attrRow("Dexterity", a.dexterity)}${attrRow("Stamina", a.stamina)}</section>
    <section style="${sS}"><h3 style="${hS}">Social Attributes</h3>${attrRow("Charisma", a.charisma)}${attrRow("Manipulation", a.manipulation)}${attrRow("Appearance", a.appearance)}</section>
    <section style="${sS}"><h3 style="${hS}">Mental Attributes</h3>${attrRow("Perception", a.perception)}${attrRow("Intelligence", a.intelligence)}${attrRow("Wits", a.wits)}</section>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,minmax(220px,1fr));gap:18px;margin-bottom:18px;">
    <section style="${sS}min-height:300px;"><h3 style="${hS}">${escapeHtml(labelA)}</h3>${abilRows(colA as WoDRated[])}</section>
    <section style="${sS}min-height:300px;"><h3 style="${hS}">${escapeHtml(labelB)}</h3>${abilRows(colB as WoDRated[])}</section>
    <section style="${sS}min-height:300px;"><h3 style="${hS}">${escapeHtml(labelC)}</h3>${abilRows(colC as WoDRated[])}</section>
  </div>

  <div style="display:grid;grid-template-columns:minmax(280px,1fr) minmax(280px,1fr);gap:18px;margin-bottom:18px;">
    <section style="${sS}">
      <h3 style="${hS}">${escapeHtml(info.powerLabel)}</h3>
      ${powersHtml || `<div style="color:#4a5562;font-size:11px;padding:8px 0;">No ${escapeHtml(info.powerLabel.toLowerCase())} recorded.</div>`}
    </section>
    <section style="${sS}">
      <h3 style="${hS}">Merits &amp; Flaws</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:16px;">${ratedList(sheet.merits ?? [], "Merits")}${ratedList(sheet.flaws ?? [], "Flaws")}</div>
      ${bgHtml}
    </section>
  </div>

  <div style="display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:18px;">
    <section style="${sS}">
      <h3 style="${hS}">Health</h3>
      <div style="text-align:center;">${boxRow(0, 7)}<div style="color:#7e8793;font-family:Consolas,monospace;font-size:10px;margin-top:10px;">Tracked in play</div></div>
    </section>
    <section style="${sS}">
      <h3 style="${hS}">Willpower</h3>
      <div style="text-align:center;">${boxRow(wpc, wp)}<div style="color:#ff3834;font-size:22px;margin-top:10px;">${wpc}</div></div>
    </section>
    ${bp > 0 ? `<section style="${sS}"><h3 style="${hS}">${escapeHtml(info.poolLabel)}</h3><div style="text-align:center;">${boxRow(bpc, bp)}<div style="color:#ff3834;font-family:Consolas,monospace;font-size:12px;margin-top:10px;">${bpc} / ${bp}</div></div></section>` : `<section style="${sS}"><h3 style="${hS}">${escapeHtml(info.poolLabel)}</h3><div style="text-align:center;color:#4a5562;font-size:11px;">Track in play</div></section>`}
    ${gn > 0 ? `<section style="${sS}"><h3 style="${hS}">Gnosis</h3><div style="text-align:center;">${boxRow(gnc, gn)}<div style="color:#ff3834;font-family:Consolas,monospace;font-size:12px;margin-top:10px;">${gnc} / ${gn}</div></div></section>` : ""}
    <section style="${sS}">
      <h3 style="${hS}">${escapeHtml(morality)}</h3>
      <div style="text-align:center;">${hum > 0 ? `<div style="color:#ff3834;font-size:28px;">${hum}</div>${diamonds(hum, 10)}` : `<div style="color:#4a5562;font-size:11px;">Set value</div>`}</div>
    </section>
    <section style="${sS}">
      <h3 style="${hS}">Virtues</h3>
      <div style="display:grid;gap:8px;color:#cfc7b8;font-size:11px;"><div>${escapeHtml(info.virtueNames[0])} ${diamonds(v.first)}</div><div>${escapeHtml(info.virtueNames[1])} ${diamonds(v.second)}</div><div>${escapeHtml(info.virtueNames[2])} ${diamonds(v.third)}</div></div>
    </section>
  </div>
  ${gearHtml}${notesHtml}
</div>`;
}

/**
 * Sheet templates are written multi-line and indented for readability, but
 * Markdown reads a 4-space-indented line as a code block and a blank line as the
 * end of a raw-HTML block. Either one shreds the sheet into escaped source text
 * (it only bites when optional sections render empty). Collapsing the whitespace
 * between tags leaves one HTML block that `marked` passes through untouched.
 */
function compactSheetHtml(html: string) {
  return html.replace(/>\s+</g, "><").trim();
}

/** Expand fenced `traveller-sheet` YAML blocks into the designed sheet. */
function expandTravellerSheets(content: string) {
  return content.replace(/```traveller-sheet\s*\n([\s\S]*?)```/g, (_match, inner) => {
    return `\n\n${compactSheetHtml(renderTravellerSheetHtml(String(inner)))}\n\n`;
  });
}

/** Expand fenced `wod-sheet` YAML blocks into the WoD character sheet. */
function expandWoDSheets(content: string) {
  return content.replace(/```wod-sheet\s*\n([\s\S]*?)```/g, (_match, inner) => {
    return `\n\n${compactSheetHtml(renderWoDSheetHtml(String(inner)))}\n\n`;
  });
}

// ---- D&D 5e / Pathfinder 2e character sheet ----

const DND_ABILITIES: { key: string; label: string; short: string }[] = [
  { key: "str", label: "Strength",     short: "STR" },
  { key: "dex", label: "Dexterity",    short: "DEX" },
  { key: "con", label: "Constitution", short: "CON" },
  { key: "int", label: "Intelligence", short: "INT" },
  { key: "wis", label: "Wisdom",       short: "WIS" },
  { key: "cha", label: "Charisma",     short: "CHA" }
];

const DND_SKILLS: { name: string; ability: string }[] = [
  { name: "Acrobatics",      ability: "dex" }, { name: "Animal Handling", ability: "wis" },
  { name: "Arcana",          ability: "int" }, { name: "Athletics",       ability: "str" },
  { name: "Deception",       ability: "cha" }, { name: "History",         ability: "int" },
  { name: "Insight",         ability: "wis" }, { name: "Intimidation",    ability: "cha" },
  { name: "Investigation",   ability: "int" }, { name: "Medicine",        ability: "wis" },
  { name: "Nature",          ability: "int" }, { name: "Perception",      ability: "wis" },
  { name: "Performance",     ability: "cha" }, { name: "Persuasion",      ability: "cha" },
  { name: "Religion",        ability: "int" }, { name: "Sleight of Hand", ability: "dex" },
  { name: "Stealth",         ability: "dex" }, { name: "Survival",        ability: "wis" }
];

const PF2_SKILLS: { key: string; name: string; ability: string }[] = [
  { key: "acrobatics",   name: "Acrobatics",   ability: "dex" },
  { key: "arcana",       name: "Arcana",       ability: "int" },
  { key: "athletics",    name: "Athletics",    ability: "str" },
  { key: "crafting",     name: "Crafting",     ability: "int" },
  { key: "deception",    name: "Deception",    ability: "cha" },
  { key: "diplomacy",    name: "Diplomacy",    ability: "cha" },
  { key: "intimidation", name: "Intimidation", ability: "cha" },
  { key: "lore",         name: "Lore",         ability: "int" },
  { key: "medicine",     name: "Medicine",     ability: "wis" },
  { key: "nature",       name: "Nature",       ability: "wis" },
  { key: "occultism",    name: "Occultism",    ability: "int" },
  { key: "performance",  name: "Performance",  ability: "cha" },
  { key: "religion",     name: "Religion",     ability: "wis" },
  { key: "society",      name: "Society",      ability: "int" },
  { key: "stealth",      name: "Stealth",      ability: "dex" },
  { key: "survival",     name: "Survival",     ability: "wis" },
  { key: "thievery",     name: "Thievery",     ability: "dex" }
];

const PF2_RANK_BONUS: Record<string, number> = { U: 0, T: 2, E: 4, M: 6, L: 8 };
const PF2_RANK_LABEL: Record<string, string> = { U: "Untrained", T: "Trained", E: "Expert", M: "Master", L: "Legendary" };

const SAVE_ABBREV: Record<string, string> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha"
};

function dndAbilMod(score: number) { return Math.floor((score - 10) / 2); }
function dndProfBonus(level: number) { return Math.ceil(level / 4) + 1; }
function dndFmt(n: number) { return n >= 0 ? `+${n}` : String(n); }
function pf2Rank(value: unknown, fallback = "U") {
  const raw = String(value ?? fallback).trim().toUpperCase();
  if (raw === "UNTRAINED") return "U";
  if (raw === "TRAINED") return "T";
  if (raw === "EXPERT") return "E";
  if (raw === "MASTER") return "M";
  if (raw === "LEGENDARY") return "L";
  return PF2_RANK_BONUS[raw] != null ? raw : fallback;
}

function normalizeDnDSheet(input: unknown) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const system = String(raw.system || "") === "pathfinder2" ? "pathfinder2" as const : "dnd5e" as const;
  const abilRaw = raw.ability_scores && typeof raw.ability_scores === "object" && !Array.isArray(raw.ability_scores)
    ? raw.ability_scores as Record<string, unknown> : {};
  const spellRaw = raw.spellcasting && typeof raw.spellcasting === "object" && !Array.isArray(raw.spellcasting)
    ? raw.spellcasting as Record<string, unknown> : null;
  const deathRaw = raw.death_saves && typeof raw.death_saves === "object" && !Array.isArray(raw.death_saves)
    ? raw.death_saves as Record<string, unknown> : {};
  const coinsRaw = raw.coins && typeof raw.coins === "object" && !Array.isArray(raw.coins)
    ? raw.coins as Record<string, unknown> : {};
  const skillRankRaw = raw.skill_ranks && typeof raw.skill_ranks === "object" && !Array.isArray(raw.skill_ranks)
    ? raw.skill_ranks as Record<string, unknown> : {};
  const saveRankRaw = raw.save_ranks && typeof raw.save_ranks === "object" && !Array.isArray(raw.save_ranks)
    ? raw.save_ranks as Record<string, unknown> : {};
  const rankMap = (value: Record<string, unknown>) => Object.fromEntries(
    Object.entries(value).map(([key, rank]) => [key.trim().toLowerCase().replace(/\s+/g, "_"), pf2Rank(rank)])
  );
  const level = Math.max(1, asNumber(raw.level, 1));
  const profBonus = raw.proficiency_bonus != null ? asNumber(raw.proficiency_bonus) : dndProfBonus(level);
  const savesRaw = asStringArray(raw.saving_throw_proficiencies).map((s) => {
    const low = s.toLowerCase();
    return SAVE_ABBREV[low] ?? low;
  });
  const attacks = asRecordArray(raw.attacks).map((a) => ({
    name: String(a.name || ""), bonus: a.bonus ? String(a.bonus) : undefined,
    damage: a.damage ? String(a.damage) : undefined, notes: a.notes ? String(a.notes) : undefined
  })).filter((a) => a.name);
  const spells = spellRaw && Array.isArray(spellRaw.spells)
    ? spellRaw.spells.flatMap((s: unknown) => {
        if (!s || typeof s !== "object" || Array.isArray(s)) return [];
        const sr = s as Record<string, unknown>;
        return [{ level: Number(sr.level ?? 0), slots: asOptionalNumber(sr.slots), used: asOptionalNumber(sr.used), list: asStringArray(sr.list) }];
      })
    : [];
  const equipment = [
    ...asRecordArray(raw.equipment).map((e) => ({ name: String(e.name || e.item || ""), quantity: asOptionalNumber(e.quantity), notes: e.notes ? String(e.notes) : undefined })),
    ...compactRecords(raw.equipment, (name, parts) => ({ name, quantity: parts[0] && Number.isFinite(+parts[0]) ? +parts[0] : undefined, notes: (parts[0] && Number.isFinite(+parts[0]) ? parts.slice(1) : parts).join(", ") || undefined }))
  ].filter((e) => e.name);
  const actions = [
    ...asRecordArray(raw.actions).map((a) => ({
      name: String(a.name || ""),
      action: a.action ? String(a.action) : undefined,
      traits: asStringArray(a.traits),
      notes: a.notes ? String(a.notes) : undefined
    })),
    ...compactRecords(raw.actions, (name, parts) => ({ name, action: parts[0], traits: [], notes: parts.slice(1).join(", ") || undefined }))
  ].filter((a) => a.name);
  const feats = [
    ...asRecordArray(raw.feats).map((f) => ({
      name: String(f.name || ""),
      type: f.type ? String(f.type) : undefined,
      level: asOptionalNumber(f.level),
      notes: f.notes ? String(f.notes) : undefined
    })),
    ...compactRecords(raw.feats, (name, parts) => ({ name, type: parts[0], level: parts[1] && Number.isFinite(+parts[1]) ? +parts[1] : undefined, notes: parts.slice(parts[1] && Number.isFinite(+parts[1]) ? 2 : 1).join(", ") || undefined }))
  ].filter((f) => f.name);
  const scores: Record<string, number> = {};
  for (const { key } of DND_ABILITIES) scores[key] = asNumber(abilRaw[key], 10);
  return {
    system, name: raw.name ? String(raw.name) : undefined,
    class: raw.class ? String(raw.class) : undefined, subclass: raw.subclass ? String(raw.subclass) : undefined,
    level, race: raw.race ? String(raw.race) : undefined,
    ancestry: raw.ancestry ? String(raw.ancestry) : (raw.race ? String(raw.race) : undefined),
    heritage: raw.heritage ? String(raw.heritage) : undefined,
    background: raw.background ? String(raw.background) : undefined, alignment: raw.alignment ? String(raw.alignment) : undefined,
    deity: raw.deity ? String(raw.deity) : undefined,
    size: raw.size ? String(raw.size) : undefined,
    keyAbility: raw.key_ability ? String(raw.key_ability) : undefined,
    xp: asOptionalNumber(raw.xp), player: raw.player ? String(raw.player) : undefined,
    portrait: raw.portrait ? String(raw.portrait) : undefined,
    inspiration: Boolean(raw.inspiration),
    personalityTraits: raw.personality_traits ? String(raw.personality_traits) : undefined,
    ideals: raw.ideals ? String(raw.ideals) : undefined,
    bonds: raw.bonds ? String(raw.bonds) : undefined,
    flaws: raw.flaws ? String(raw.flaws) : undefined,
    appearance: {
      age: raw.age ? String(raw.age) : undefined,
      height: raw.height ? String(raw.height) : undefined,
      weight: raw.weight ? String(raw.weight) : undefined,
      eyes: raw.eyes ? String(raw.eyes) : undefined,
      skin: raw.skin ? String(raw.skin) : undefined,
      hair: raw.hair ? String(raw.hair) : undefined
    },
    scores, profBonus, saveProfSet: new Set(savesRaw),
    skillProfs: new Set(asStringArray(raw.skill_proficiencies).map((s) => s.toLowerCase())),
    skillExpert: new Set(asStringArray(raw.skill_expertise).map((s) => s.toLowerCase())),
    saveRanks: rankMap(saveRankRaw),
    skillRanks: rankMap(skillRankRaw),
    perceptionRank: pf2Rank(raw.perception_rank),
    ac: asOptionalNumber(raw.ac), classDc: asOptionalNumber(raw.class_dc), initiative: asOptionalNumber(raw.initiative), speed: asOptionalNumber(raw.speed),
    hpMax: asOptionalNumber(raw.hp_max), hpCurrent: asOptionalNumber(raw.hp_current ?? raw.hp_max), hpTemp: asOptionalNumber(raw.hp_temp),
    heroPoints: asOptionalNumber(raw.hero_points),
    armor: raw.armor ? String(raw.armor) : undefined,
    shield: raw.shield ? String(raw.shield) : undefined,
    conditions: asStringArray(raw.conditions),
    hitDice: raw.hit_dice ? String(raw.hit_dice) : undefined,
    deathSuccesses: asNumber(deathRaw.successes, 0), deathFailures: asNumber(deathRaw.failures, 0),
    passivePerception: asOptionalNumber(raw.passive_perception),
    attacks, actions,
    spellcasting: spellRaw ? {
      ability: spellRaw.ability ? String(spellRaw.ability).toLowerCase() : undefined,
      saveDC: asOptionalNumber(spellRaw.spell_save_dc),
      attack: spellRaw.spell_attack ? String(spellRaw.spell_attack) : undefined,
      focusPoints: spellRaw.focus_points && typeof spellRaw.focus_points === "object" && !Array.isArray(spellRaw.focus_points)
        ? { current: asOptionalNumber((spellRaw.focus_points as Record<string, unknown>).current), max: asOptionalNumber((spellRaw.focus_points as Record<string, unknown>).max) }
        : null,
      spells
    } : null,
    feats,
    features: asStringArray(raw.features), languages: asStringArray(raw.languages),
    proficiencies: asStringArray(raw.proficiencies), equipment,
    coins: {
      cp: asOptionalNumber(coinsRaw.cp),
      sp: asOptionalNumber(coinsRaw.sp),
      ep: asOptionalNumber(coinsRaw.ep),
      gp: asOptionalNumber(coinsRaw.gp),
      pp: asOptionalNumber(coinsRaw.pp)
    },
    backstory: raw.backstory ? String(raw.backstory) : undefined,
    allies: raw.allies ? String(raw.allies) : undefined,
    treasure: raw.treasure ? String(raw.treasure) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined
  };
}

function renderDnDSheetHtml(rawInput: string) {
  let parsed: unknown;
  try { parsed = yaml.parse(rawInput) || {}; }
  catch (error) {
    return `<section class="dnd-sheet dnd-sheet-error"><p>D&amp;D sheet data could not be parsed: ${escapeHtml(error instanceof Error ? error.message : "invalid YAML")}</p></section>`;
  }
  const s = normalizeDnDSheet(parsed);
  const abilMod = (key: string) => dndAbilMod(s.scores[key] ?? 10);
  const profIcon = (prof: boolean, expert = false) =>
    expert ? `<span class="dnd-prof-icon expert" title="Expertise">★</span>`
    : prof  ? `<span class="dnd-prof-icon proficient" title="Proficient">●</span>`
    :          `<span class="dnd-prof-icon" title="Not proficient">○</span>`;
  const classSub = [s.class, s.subclass].filter(Boolean).join(" / ");
  const byline = [classSub ? `${classSub} ${s.level}` : null, s.race, s.background].filter((p): p is string => !!p).map(escapeHtml).join(" · ");
  const portrait = s.portrait
    ? `<img src="${escapeHtml(mediaPath(s.portrait))}" alt="${escapeHtml(s.name || "portrait")}" loading="lazy" />`
    : `<div class="dnd-portrait-placeholder"><span>${escapeHtml((s.name || " ").charAt(0).toUpperCase())}</span></div>`;
  const deathBox = (filled: boolean) => `<span class="dnd-death-box${filled ? " filled" : ""}"></span>`;
  const deathRow = (count: number, sym: string) => `<span>${sym}</span>${Array.from({ length: 3 }, (_, i) => deathBox(i < count)).join("")}`;
  const hpMax = s.hpMax ?? 0;
  const hpCur = s.hpCurrent ?? hpMax;
  const hpPct = hpMax > 0 ? Math.min(100, Math.round((hpCur / hpMax) * 100)) : 0;

  const abilitiesHtml = DND_ABILITIES.map(({ key, label, short }) => {
    const score = s.scores[key] ?? 10;
    const mod = dndAbilMod(score);
    const saveProf = s.saveProfSet.has(key) || s.saveProfSet.has(short.toLowerCase());
    const saveBonus = mod + (saveProf ? s.profBonus : 0);
    return `<div class="dnd-ability-card" data-roll="1d20" data-mod="${mod}" data-label="${escapeHtml(label)} check">
  <span class="dnd-ability-short">${short}</span>
  <span class="dnd-ability-score">${score}</span>
  <span class="dnd-ability-mod">${dndFmt(mod)}</span>
  <span class="dnd-ability-label">${escapeHtml(label)}</span>
  <span class="dnd-save-row">${profIcon(saveProf)}Save ${dndFmt(saveBonus)}</span>
</div>`;
  }).join("");

  const skillsHtml = DND_SKILLS.map(({ name, ability }) => {
    const expert = s.skillExpert.has(name.toLowerCase());
    const prof   = s.skillProfs.has(name.toLowerCase()) || expert;
    const bonus  = abilMod(ability) + (expert ? s.profBonus * 2 : prof ? s.profBonus : 0);
    return `<li data-roll="1d20" data-mod="${bonus}" data-label="${escapeHtml(name)}">${profIcon(prof, expert)}<span>${escapeHtml(name)}</span><span class="dnd-skill-abrev">${ability.toUpperCase()}</span><span class="dnd-skill-bonus">${dndFmt(bonus)}</span></li>`;
  }).join("");

  const savesHtml = DND_ABILITIES.map(({ key, label, short }) => {
    const saveProf = s.saveProfSet.has(key) || s.saveProfSet.has(short.toLowerCase());
    const saveBonus = abilMod(key) + (saveProf ? s.profBonus : 0);
    return `<li data-roll="1d20" data-mod="${saveBonus}" data-label="${escapeHtml(label)} save">${profIcon(saveProf)}<span>${escapeHtml(label)}</span><span class="dnd-skill-bonus">${dndFmt(saveBonus)}</span></li>`;
  }).join("");

  const sheetTextBox = (label: string, value?: string) =>
    `<div class="dnd-textbox"><p>${value ? escapeHtml(value) : "&nbsp;"}</p><span>${escapeHtml(label)}</span></div>`;

  const appearance = Object.entries(s.appearance)
    .filter(([, value]) => value)
    .map(([key, value]) => `<div><b>${escapeHtml(key)}</b><span>${escapeHtml(String(value))}</span></div>`)
    .join("");

  const coinsHtml = ["cp", "sp", "ep", "gp", "pp"].map((coin) =>
    `<div><span>${coin.toUpperCase()}</span><b>${escapeHtml(String((s.coins as Record<string, number | undefined>)[coin] ?? ""))}</b></div>`
  ).join("");

  const attacksHtml = s.attacks.length ? `
<div class="dnd-section">
  <h4>Attacks</h4>
  <table class="dnd-attacks-table">
    <thead><tr><th>Name</th><th>Attack</th><th>Damage / Type</th></tr></thead>
    <tbody>${s.attacks.map((a) => `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.bonus || "—")}</td><td>${escapeHtml([a.damage, a.notes].filter(Boolean).join(" · ") || "—")}</td></tr>`).join("")}</tbody>
  </table>
</div>` : "";

  let spellsHtml = "";
  if (s.spellcasting) {
    const sc = s.spellcasting;
    const scLine = [sc.ability?.toUpperCase(), sc.saveDC ? `DC ${sc.saveDC}` : null, sc.attack ? `${sc.attack} atk` : null].filter(Boolean).join(" · ");
    const spellGroupsHtml = sc.spells.map((sl) => {
      const label = sl.level === 0 ? "Cantrips" : `Level ${sl.level}${sl.slots ? ` (${sl.slots - (sl.used ?? 0)}/${sl.slots} slots)` : ""}`;
      return `<div class="dnd-spell-group"><span class="dnd-spell-level-label">${escapeHtml(label)}</span><span class="dnd-spell-list">${escapeHtml(sl.list.join(", ") || "—")}</span></div>`;
    }).join("");
    spellsHtml = `
<div class="dnd-section">
  <h4>Spellcasting <span>${escapeHtml(scLine)}</span></h4>
  <div class="dnd-spells">${spellGroupsHtml}</div>
</div>`;
  }

  const featuresHtml = s.features.length ? `
<div class="dnd-section">
  <h4>Features &amp; Traits</h4>
  <ul class="dnd-feature-list">${s.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
</div>` : "";

  const equipHtml = s.equipment.length ? `
<div class="dnd-section">
  <h4>Equipment</h4>
  <p class="dnd-equip-list">${s.equipment.map((e) => {
    const qty = e.quantity && e.quantity > 1 ? ` ×${e.quantity}` : "";
    return `<span>${escapeHtml(e.name + qty + (e.notes ? ` (${e.notes})` : ""))}</span>`;
  }).join(" · ")}</p>
</div>` : "";

  const miscRows = [
    s.languages.length && `<div class="dnd-misc-row"><b>Languages</b> ${escapeHtml(s.languages.join(", "))}</div>`,
    s.proficiencies.length && `<div class="dnd-misc-row"><b>Proficiencies</b> ${escapeHtml(s.proficiencies.join(", "))}</div>`,
    appearance && `<div class="dnd-misc-row dnd-appearance-row"><b>Appearance</b><div class="dnd-appearance-grid">${appearance}</div></div>`,
    s.backstory && `<div class="dnd-misc-row"><b>Backstory</b> ${escapeHtml(s.backstory)}</div>`,
    s.allies && `<div class="dnd-misc-row"><b>Allies</b> ${escapeHtml(s.allies)}</div>`,
    s.treasure && `<div class="dnd-misc-row"><b>Treasure</b> ${escapeHtml(s.treasure)}</div>`,
    s.notes && `<div class="dnd-misc-row"><b>Notes</b> ${escapeHtml(s.notes)}</div>`
  ].filter(Boolean).join("");

  if (s.system === "pathfinder2") {
    const rankBonus = (rank: string) => rank === "U" ? 0 : s.level + (PF2_RANK_BONUS[rank] ?? 0);
    const rankFor = (map: Record<string, string>, key: string, legacySet?: Set<string>) => {
      const normalized = key.trim().toLowerCase().replace(/\s+/g, "_");
      if (map[normalized]) return map[normalized];
      if (legacySet?.has(key.toLowerCase())) return "T";
      return "U";
    };
    const pf2Total = (ability: string, rank: string) => abilMod(ability) + rankBonus(rank);
    const pf2Identity = [
      [classSub || s.class || "-", "Class"],
      [s.ancestry || "-", "Ancestry"],
      [s.heritage || "-", "Heritage"],
      [s.background || "-", "Background"],
      [s.player || "-", "Player"],
      [s.deity || "-", "Deity"],
      [s.size || "Medium", "Size"],
      [s.keyAbility || "-", "Key Ability"]
    ].map(([value, label]) => `<div><b>${escapeHtml(String(value))}</b><span>${escapeHtml(String(label))}</span></div>`).join("");

    const pf2Abilities = DND_ABILITIES.map(({ key, label, short }) => {
      const score = s.scores[key] ?? 10;
      return `<div class="pf2-ability" data-roll="1d20" data-mod="${abilMod(key)}" data-label="${escapeHtml(label)} check">
  <span>${short}</span><strong>${score}</strong><b>${dndFmt(abilMod(key))}</b><small>${escapeHtml(label)}</small>
</div>`;
    }).join("");

    const pf2SaveRows = [
      { key: "fortitude", label: "Fortitude", ability: "con" },
      { key: "reflex", label: "Reflex", ability: "dex" },
      { key: "will", label: "Will", ability: "wis" }
    ].map(({ key, label, ability }) => {
      const rank = rankFor(s.saveRanks, key, s.saveProfSet);
      const bonus = pf2Total(ability, rank);
      return `<li data-roll="1d20" data-mod="${bonus}" data-label="${escapeHtml(label)} save"><span class="pf2-rank pf2-rank-${rank.toLowerCase()}" title="${escapeHtml(PF2_RANK_LABEL[rank] || rank)}">${rank}</span><span>${escapeHtml(label)}</span><small>${ability.toUpperCase()}</small><b>${dndFmt(bonus)}</b></li>`;
    }).join("");

    const perceptionRank = rankFor({ perception: s.perceptionRank }, "perception");
    const perceptionBonus = pf2Total("wis", perceptionRank);
    const pf2SkillRows = PF2_SKILLS.map(({ key, name, ability }) => {
      const rank = rankFor(s.skillRanks, key, s.skillProfs);
      const bonus = pf2Total(ability, rank);
      return `<li data-roll="1d20" data-mod="${bonus}" data-label="${escapeHtml(name)}"><span class="pf2-rank pf2-rank-${rank.toLowerCase()}" title="${escapeHtml(PF2_RANK_LABEL[rank] || rank)}">${rank}</span><span>${escapeHtml(name)}</span><small>${ability.toUpperCase()}</small><b>${dndFmt(bonus)}</b></li>`;
    }).join("");

    const pf2AttackRows = s.attacks.length
      ? s.attacks.map((a) => `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.bonus || "-")}</td><td>${escapeHtml(a.damage || "-")}</td><td>${escapeHtml(a.notes || "")}</td></tr>`).join("")
      : `<tr><td colspan="4">No attacks recorded.</td></tr>`;

    const pf2ActionRows = s.actions.length
      ? s.actions.map((a) => `<li><b>${escapeHtml(a.name)}</b><span>${escapeHtml([a.action, ...(a.traits || [])].filter(Boolean).join(" - "))}</span>${a.notes ? `<p>${escapeHtml(a.notes)}</p>` : ""}</li>`).join("")
      : `<li><b>Action</b><span>Add actions in the sheet YAML.</span></li>`;

    const pf2FeatRows = [...s.feats.map((f) => `<li><b>${escapeHtml(f.name)}</b><span>${escapeHtml([f.type, f.level != null ? `Level ${f.level}` : null].filter(Boolean).join(" - "))}</span>${f.notes ? `<p>${escapeHtml(f.notes)}</p>` : ""}</li>`),
      ...s.features.map((f) => `<li><b>${escapeHtml(f)}</b><span>Feature</span></li>`)].join("");

    const pf2EquipmentRows = s.equipment.length
      ? s.equipment.map((e) => `<li><span>${escapeHtml(e.name)}</span><b>${escapeHtml(e.quantity != null ? String(e.quantity) : "")}</b><small>${escapeHtml(e.notes || "")}</small></li>`).join("")
      : `<li><span>No equipment recorded.</span><b></b><small></small></li>`;

    const focus = s.spellcasting?.focusPoints;
    const pf2SpellGroups = s.spellcasting?.spells.length
      ? s.spellcasting.spells.map((sl) => `<div class="pf2-spell-row"><b>${sl.level === 0 ? "Cantrips" : `Rank ${sl.level}`}</b><span>${escapeHtml(sl.list.join(", ") || "-")}</span><small>${sl.slots ? `${sl.slots - (sl.used ?? 0)}/${sl.slots}` : ""}</small></div>`).join("")
      : `<div class="pf2-spell-row"><b>Spells</b><span>No spells recorded.</span><small></small></div>`;

    return `
<section class="dnd-sheet pf2-sheet">
  <header class="pf2-header">
    ${portrait}
    <div class="pf2-title">
      <span>Pathfinder Second Edition</span>
      <strong>${escapeHtml(s.name || "Unnamed Character")}</strong>
      <small>Level ${s.level}${classSub ? ` - ${escapeHtml(classSub)}` : ""}</small>
    </div>
    <div class="pf2-hero"><b>${s.heroPoints ?? 1}</b><span>Hero Points</span></div>
  </header>

  <div class="pf2-identity">${pf2Identity}</div>
  <div class="pf2-body">
    <aside class="pf2-left">
      <div class="pf2-abilities">${pf2Abilities}</div>
      <section class="pf2-panel"><h4>Perception</h4><div class="pf2-perception" data-roll="1d20" data-mod="${perceptionBonus}" data-label="Perception"><span class="pf2-rank pf2-rank-${perceptionRank.toLowerCase()}" title="${escapeHtml(PF2_RANK_LABEL[perceptionRank] || perceptionRank)}">${perceptionRank}</span><b>${dndFmt(perceptionBonus)}</b><small>WIS</small></div></section>
      <section class="pf2-panel"><h4>Saving Throws</h4><ul class="pf2-list">${pf2SaveRows}</ul></section>
      <section class="pf2-panel pf2-skills-panel"><h4>Skills</h4><ul class="pf2-list">${pf2SkillRows}</ul></section>
    </aside>

    <main class="pf2-main">
      <div class="pf2-stat-row">
        <div><b>${s.ac ?? 10}</b><span>Armor Class</span></div>
        <div><b>${s.classDc ?? "-"}</b><span>Class DC</span></div>
        <div><b>${s.speed ?? 25} ft</b><span>Speed</span></div>
        <div><b>${dndFmt(s.initiative ?? perceptionBonus)}</b><span>Initiative</span></div>
      </div>
      <section class="pf2-hp">
        <h4>Hit Points</h4>
        <strong>${hpCur || 0} / ${hpMax || 0}</strong>
        <div class="pf2-hp-bar"><span style="width:${hpPct}%"></span></div>
        <p>${escapeHtml([s.armor && `Armor: ${s.armor}`, s.shield && `Shield: ${s.shield}`, s.hpTemp ? `Temp HP: ${s.hpTemp}` : null].filter(Boolean).join(" - ") || "No armor or shield notes.")}</p>
      </section>
      <section class="pf2-panel"><h4>Strikes &amp; Attacks</h4><table class="pf2-table"><thead><tr><th>Name</th><th>Attack</th><th>Damage</th><th>Traits / Notes</th></tr></thead><tbody>${pf2AttackRows}</tbody></table></section>
      <section class="pf2-panel"><h4>Actions &amp; Activities</h4><ul class="pf2-card-list">${pf2ActionRows}</ul></section>
      <section class="pf2-panel"><h4>Spellcasting${s.spellcasting?.ability ? ` <span>${escapeHtml(s.spellcasting.ability.toUpperCase())}</span>` : ""}</h4>
        <div class="pf2-spell-meta"><span>DC ${s.spellcasting?.saveDC ?? "-"}</span><span>Attack ${escapeHtml(s.spellcasting?.attack || "-")}</span><span>Focus ${focus?.current ?? "-"} / ${focus?.max ?? "-"}</span></div>
        ${pf2SpellGroups}
      </section>
    </main>

    <aside class="pf2-right">
      <section class="pf2-panel"><h4>Feats &amp; Features</h4><ul class="pf2-card-list">${pf2FeatRows || `<li><b>No feats recorded.</b><span>Add feats in the sheet YAML.</span></li>`}</ul></section>
      <section class="pf2-panel"><h4>Equipment</h4><ul class="pf2-equipment">${pf2EquipmentRows}</ul><div class="pf2-coins">${coinsHtml}</div></section>
      <section class="pf2-panel"><h4>Conditions</h4><p>${escapeHtml(s.conditions.join(", ") || "No active conditions.")}</p></section>
      <section class="pf2-panel"><h4>Notes</h4><p>${escapeHtml([s.backstory, s.notes].filter(Boolean).join("\n\n") || "-")}</p></section>
    </aside>
  </div>
</section>`;
  }

  return `
<section class="dnd-sheet dnd-sheet-5e">
  <div class="dnd-header">
    ${portrait}
    <div class="dnd-header-text">
      <strong class="dnd-name">${escapeHtml(s.name || "Unnamed Character")}</strong>
      ${byline ? `<span class="dnd-byline">${byline}</span>` : ""}
    </div>
    <div class="dnd-header-grid">
      <div><b>${escapeHtml(classSub || "-")}</b><span>Class &amp; Level</span></div>
      <div><b>${escapeHtml(s.background || "-")}</b><span>Background</span></div>
      <div><b>${escapeHtml(s.player || "-")}</b><span>Player Name</span></div>
      <div><b>${escapeHtml(s.race || "-")}</b><span>Race</span></div>
      <div><b>${escapeHtml(s.alignment || "-")}</b><span>Alignment</span></div>
      <div><b>${s.xp != null ? s.xp.toLocaleString() : "-"}</b><span>Experience Points</span></div>
    </div>
  </div>

  <div class="dnd-body">
    <aside class="dnd-left-rail">
      <div class="dnd-inspiration-row"><div class="dnd-inspiration-box">${s.inspiration ? "X" : ""}</div><span>Inspiration</span></div>
      <div class="dnd-prof-badge"><span class="dnd-prof-val">${dndFmt(s.profBonus)}</span><span class="dnd-prof-label">Proficiency Bonus</span></div>
      <div class="dnd-abilities">${abilitiesHtml}</div>
      <div class="dnd-list-panel"><h4>Saving Throws</h4><ul class="dnd-skills">${savesHtml}</ul></div>
      <div class="dnd-list-panel"><h4>Skills</h4><ul class="dnd-skills">${skillsHtml}</ul></div>
      <div class="dnd-passive">${s.passivePerception ?? 10 + abilMod("wis")} Passive Wisdom (Perception)</div>
      <div class="dnd-section dnd-proficiency-box"><h4>Other Proficiencies &amp; Languages</h4><p>${escapeHtml([...s.proficiencies, ...s.languages].join(", ") || "-")}</p></div>
    </aside>

    <main class="dnd-center-col">
      <div class="dnd-combat-stats">
        <div class="dnd-combat-block dnd-shield"><span class="dnd-combat-val">${s.ac ?? "-"}</span><span class="dnd-combat-label">Armor Class</span></div>
        <div class="dnd-combat-block"><span class="dnd-combat-val">${dndFmt(s.initiative ?? abilMod("dex"))}</span><span class="dnd-combat-label">Initiative</span></div>
        <div class="dnd-combat-block"><span class="dnd-combat-val">${s.speed ?? 30}ft</span><span class="dnd-combat-label">Speed</span></div>
      </div>
      <div class="dnd-hp-block">
        <span class="dnd-hp-label">Hit Point Maximum ${hpMax || ""}</span>
        <div class="dnd-hp-numbers"><span class="dnd-hp-current">${hpCur || ""}</span>${s.hpTemp ? `<span class="dnd-hp-temp"> +${s.hpTemp} temp</span>` : ""}</div>
        <div class="dnd-hp-bar"><div class="dnd-hp-fill" style="width:${hpPct}%"></div></div>
        <span class="dnd-hp-label">Current Hit Points</span>
      </div>
      <div class="dnd-small-pair">
        <div class="dnd-section"><h4>Hit Dice</h4><p>${escapeHtml(s.hitDice || "-")}</p></div>
        <div class="dnd-death-saves"><span class="dnd-death-label">Death Saves</span><div class="dnd-death-row">${deathRow(s.deathSuccesses, "Successes")}</div><div class="dnd-death-row">${deathRow(s.deathFailures, "Failures")}</div></div>
      </div>
      ${attacksHtml}
      ${equipHtml}
      <div class="dnd-section dnd-coins"><h4>Coins</h4>${coinsHtml}</div>
    </main>

    <aside class="dnd-right-rail">
      ${sheetTextBox("Personality Traits", s.personalityTraits)}
      ${sheetTextBox("Ideals", s.ideals)}
      ${sheetTextBox("Bonds", s.bonds)}
      ${sheetTextBox("Flaws", s.flaws)}
      ${featuresHtml || `<div class="dnd-section"><h4>Features &amp; Traits</h4><p>-</p></div>`}
      ${spellsHtml}
      ${miscRows ? `<div class="dnd-section">${miscRows}</div>` : ""}
    </aside>
  </div>
</section>`;

}

/** Expand fenced `dnd-sheet` YAML blocks into the D&D 5e character sheet. */
function expandDnDSheets(content: string) {
  return content.replace(/```dnd-sheet\s*\n([\s\S]*?)```/g, (_match, inner) => {
    return `\n\n${compactSheetHtml(renderDnDSheetHtml(String(inner)))}\n\n`;
  });
}

// ══ Sword Chronicle sheet (Green Ronin Chronicle System) ══════════════════════

/** Sheet order, matching the printed GRR2750e sheet. */
const swordChronicleAbilities = [
  "Agility", "Animal Handling", "Athletics", "Awareness", "Cunning", "Deception",
  "Endurance", "Fighting", "Healing", "Knowledge", "Language", "Marksmanship",
  "Persuasion", "Status", "Stealth", "Survival", "Thievery", "Warfare", "Will"
];

/** Every Chronicle ability starts at rank 2 unless the sheet says otherwise. */
const swordChronicleDefaultRating = 2;

function normalizeSwordSpecialties(value: unknown): SwordChronicleSpecialty[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((entry): SwordChronicleSpecialty | null => {
      if (typeof entry === "string") {
        // "Long Blades 3" / "Long Blades" — a trailing integer is the bonus-dice rank.
        const match = /^(.*?)[\s:]+(\d+)$/.exec(entry.trim());
        if (match) return { name: match[1].trim(), rank: Number(match[2]) };
        return { name: entry.trim(), rank: 1 };
      }
      if (entry && typeof entry === "object") {
        const raw = entry as Record<string, unknown>;
        const name = String(raw.name ?? "").trim();
        if (!name) return null;
        const rank = raw.rank ?? raw.rating ?? raw.level ?? raw.bonus;
        return { name, rank: rank == null ? 1 : Number(rank) };
      }
      return null;
    })
    .filter((entry): entry is SwordChronicleSpecialty => Boolean(entry?.name));
}

function normalizeSwordAbilities(value: unknown): SwordChronicleAbility[] {
  const found = new Map<string, SwordChronicleAbility>();
  const put = (name: string, rating: unknown, specialties: unknown) => {
    const clean = String(name).trim();
    if (!clean) return;
    const numeric = rating == null || rating === "" ? undefined : Number(rating);
    found.set(clean.toLowerCase(), {
      name: clean,
      rating: Number.isFinite(numeric) ? numeric : undefined,
      specialties: normalizeSwordSpecialties(specialties)
    });
  };

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const raw = entry as Record<string, unknown>;
      put(String(raw.name ?? ""), raw.rating ?? raw.rank ?? raw.value, raw.specialties ?? raw.specialities);
    }
  } else if (value && typeof value === "object") {
    for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const raw = entry as Record<string, unknown>;
        put(name, raw.rating ?? raw.rank ?? raw.value, raw.specialties ?? raw.specialities);
      } else if (Array.isArray(entry)) {
        put(name, undefined, entry);
      } else {
        put(name, entry, undefined);
      }
    }
  }

  // A sheet with no abilities is a blank one: show the full printed list. When
  // abilities *are* given, show exactly those — settings vary the list (Kingdom
  // Divided swaps Warfare for Warcraft and adds Admiralty/Nautical), so padding
  // to the stock list would invent ranks the character does not have.
  if (found.size === 0) {
    return swordChronicleAbilities.map((name) => ({ name, rating: swordChronicleDefaultRating, specialties: [] }));
  }
  return [...found.values()]
    .map((ability) => ({ ...ability, rating: ability.rating ?? swordChronicleDefaultRating }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeSwordChronicleSheet(input: unknown): SwordChronicleSheet {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const strList = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : value ? [String(value)] : [];
  const num = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const armorRaw = (raw.armor || raw.armour) as Record<string, unknown> | undefined;
  const appearanceRaw = (raw.appearance || {}) as Record<string, unknown>;

  return {
    system: "sword-chronicle",
    name: raw.name ? String(raw.name) : undefined,
    age: raw.age as number | string | undefined,
    gender: raw.gender ? String(raw.gender) : undefined,
    house: raw.house ? String(raw.house) : undefined,
    portrait: raw.portrait ? String(raw.portrait) : undefined,
    heraldry: raw.heraldry ? String(raw.heraldry) : undefined,
    motto: raw.motto ? String(raw.motto) : undefined,
    abilities: normalizeSwordAbilities(raw.abilities),
    defensiveBonus: num(raw.defensiveBonus) ?? 0,
    destiny: num(raw.destiny) ?? 0,
    destinySpent: num(raw.destinySpent) ?? 0,
    qualities: strList(raw.qualities),
    benefits: strList(raw.benefits),
    drawbacks: strList(raw.drawbacks),
    armor: armorRaw && typeof armorRaw === "object"
      ? { name: armorRaw.name ? String(armorRaw.name) : undefined, rating: num(armorRaw.rating), penalty: num(armorRaw.penalty) }
      : undefined,
    attacks: Array.isArray(raw.attacks)
      ? (raw.attacks as Record<string, unknown>[])
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => ({
            name: String(entry.name ?? ""),
            test: entry.test ? String(entry.test) : undefined,
            dice: entry.dice ? String(entry.dice) : undefined,
            damage: entry.damage ? String(entry.damage) : undefined,
            qualities: entry.qualities ? String(entry.qualities) : undefined
          }))
          .filter((entry) => entry.name)
      : [],
    damage: num(raw.damage) ?? 0,
    injuries: num(raw.injuries) ?? 0,
    wounds: num(raw.wounds) ?? 0,
    equipment: strList(raw.equipment),
    retainers: Array.isArray(raw.retainers)
      ? (raw.retainers as unknown[])
          .map((entry) =>
            typeof entry === "string"
              ? { name: entry }
              : entry && typeof entry === "object"
                ? { name: String((entry as any).name ?? ""), notes: (entry as any).notes ? String((entry as any).notes) : undefined }
                : null
          )
          .filter((entry): entry is { name: string; notes?: string } => Boolean(entry?.name))
      : [],
    allies: strList(raw.allies),
    enemies: strList(raw.enemies),
    oaths: strList(raw.oaths),
    appearance: {
      height: appearanceRaw.height ? String(appearanceRaw.height) : undefined,
      weight: appearanceRaw.weight ? String(appearanceRaw.weight) : undefined,
      eyes: appearanceRaw.eyes ? String(appearanceRaw.eyes) : undefined,
      hair: appearanceRaw.hair ? String(appearanceRaw.hair) : undefined,
      mannerisms: appearanceRaw.mannerisms ? String(appearanceRaw.mannerisms) : undefined,
      features: appearanceRaw.features ? String(appearanceRaw.features) : undefined
    },
    history: raw.history ? String(raw.history) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined
  };
}

function swordTrack(filled: number, total: number, className: string) {
  return `<span class="scsheet-track ${className}">${Array.from({ length: total }, (_, index) =>
    `<i class="${index < filled ? "on" : ""}"></i>`
  ).join("")}</span>`;
}

function renderSwordChronicleSheetHtml(rawInput: string) {
  let parsed: unknown;
  try {
    parsed = yaml.parse(rawInput) || {};
  } catch (error) {
    return `<section class="scsheet scsheet-error"><p>Sword Chronicle sheet data could not be parsed: ${escapeHtml(error instanceof Error ? error.message : "invalid YAML")}</p></section>`;
  }
  const sheet = normalizeSwordChronicleSheet(parsed);
  const rate = (name: string) =>
    sheet.abilities.find((ability) => ability.name.toLowerCase() === name.toLowerCase())?.rating ?? swordChronicleDefaultRating;

  const armorPenalty = sheet.armor?.penalty ?? 0;
  const intrigueDefense = rate("Awareness") + rate("Cunning") + rate("Status");
  const combatDefense = rate("Agility") + rate("Athletics") + rate("Awareness") + (sheet.defensiveBonus ?? 0) - armorPenalty;
  const composure = rate("Will") * 3;
  const health = rate("Endurance") * 3;

  const destinyTotal = Math.max(sheet.destiny ?? 0, 9);
  const destinyUsed = sheet.destinySpent ?? 0;
  const destinyDots = Array.from({ length: destinyTotal }, (_, index) => {
    const available = index < (sheet.destiny ?? 0);
    const spent = index < destinyUsed;
    return `<i class="${spent ? "spent" : available ? "on" : ""}"></i>`;
  }).join("");

  const abilityColumns = splitColumns(sheet.abilities, 2);
  const abilityRow = (ability: SwordChronicleAbility) => {
    const rating = ability.rating ?? swordChronicleDefaultRating;
    const specialties = (ability.specialties || [])
      .map((specialty) => {
        const bonus = specialty.rank ?? 1;
        return `<span class="scsheet-spec">${escapeHtml(specialty.name)} <b>${bonus}B</b></span>`;
      })
      .join("");
    return `<li class="scsheet-ability">
      <span class="scsheet-ability-main">
        <span class="scsheet-rating">${rating}</span>
        <span class="scsheet-ability-name">${escapeHtml(ability.name)}</span>
      </span>
      <span class="scsheet-specs">${specialties || `<span class="scsheet-empty-inline">—</span>`}</span>
    </li>`;
  };

  const portrait = sheet.portrait
    ? `<img src="${escapeHtml(mediaPath(sheet.portrait))}" alt="${escapeHtml(sheet.name || "Portrait")}" loading="lazy" />`
    : `<span>Portrait</span>`;

  const listOr = (items: string[], empty: string) =>
    items.length ? `<ul class="scsheet-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="scsheet-empty">${empty}</p>`;

  const attacksHtml = sheet.attacks?.length
    ? `<table class="scsheet-attacks"><thead><tr><th>Attack Test</th><th>Dice</th><th>Weapon</th><th>Damage &amp; Special Qualities</th></tr></thead><tbody>${sheet.attacks
        .map(
          (attack) => `<tr><td>${escapeHtml(attack.test || "-")}</td><td>${escapeHtml(attack.dice || "-")}</td><td>${escapeHtml(attack.name)}</td><td>${escapeHtml(detail([attack.damage, attack.qualities]) || "-")}</td></tr>`
        )
        .join("")}</tbody></table>`
    : `<p class="scsheet-empty">No attacks recorded.</p>`;

  const appearance = sheet.appearance || {};
  const appearanceRows = [
    ["Height", appearance.height],
    ["Weight", appearance.weight],
    ["Eye Colour", appearance.eyes],
    ["Hair Colour", appearance.hair],
    ["Mannerisms", appearance.mannerisms],
    ["Distinguishing Features", appearance.features]
  ].filter(([, value]) => Boolean(value));

  return `
<section class="scsheet">
  <header class="scsheet-head">
    <div class="scsheet-portrait">${portrait}</div>
    <div class="scsheet-ident">
      <strong class="scsheet-name">${escapeHtml(sheet.name || "Unnamed Character")}</strong>
      <div class="scsheet-facts">
        <span><b>Age</b>${escapeHtml(String(sheet.age ?? "-"))}</span>
        <span><b>Gender</b>${escapeHtml(sheet.gender || "-")}</span>
        <span><b>House</b>${escapeHtml(sheet.house || "-")}</span>
      </div>
      ${sheet.motto ? `<em class="scsheet-motto">“${escapeHtml(sheet.motto)}”</em>` : ""}
      ${sheet.heraldry ? `<span class="scsheet-heraldry"><b>Heraldry</b> ${escapeHtml(sheet.heraldry)}</span>` : ""}
    </div>
  </header>

  <div class="scsheet-derived">
    <div class="scsheet-stat"><span class="scsheet-stat-val">${intrigueDefense}</span><span class="scsheet-stat-key">Intrigue Defense</span><span class="scsheet-stat-formula">Awareness + Cunning + Status</span></div>
    <div class="scsheet-stat"><span class="scsheet-stat-val">${combatDefense}</span><span class="scsheet-stat-key">Combat Defense</span><span class="scsheet-stat-formula">Agility + Athletics + Awareness${sheet.defensiveBonus ? " + Bonus" : ""}${armorPenalty ? " − Armor Penalty" : ""}</span></div>
    <div class="scsheet-stat"><span class="scsheet-stat-val">${composure}</span><span class="scsheet-stat-key">Composure</span><span class="scsheet-stat-formula">Will ranks × 3</span></div>
    <div class="scsheet-stat"><span class="scsheet-stat-val">${health}</span><span class="scsheet-stat-key">Health</span><span class="scsheet-stat-formula">Endurance ranks × 3</span></div>
  </div>

  <section class="scsheet-panel">
    <h4>Destiny Points <span>${sheet.destiny ?? 0} earned · ${destinyUsed} spent</span></h4>
    <span class="scsheet-track scsheet-destiny">${destinyDots}</span>
  </section>

  <section class="scsheet-panel">
    <h4>Abilities <span>Rating is the test dice pool · Specialties add bonus dice</span></h4>
    <div class="scsheet-ability-cols">${abilityColumns
      .map((column) => `<ul class="scsheet-abilities">${column.map(abilityRow).join("")}</ul>`)
      .join("")}</div>
  </section>

  <section class="scsheet-panel">
    <h4>Combat <span>${sheet.armor?.name ? `${escapeHtml(sheet.armor.name)} · AR ${sheet.armor.rating ?? "-"} · Penalty ${armorPenalty}` : "No armor worn"}</span></h4>
    ${attacksHtml}
    <div class="scsheet-tracks">
      <div><b>Damage</b>${swordTrack(sheet.damage ?? 0, Math.max(health, 1), "scsheet-damage")}<span class="scsheet-track-count">${sheet.damage ?? 0} / ${health}</span></div>
      <div><b>Injuries</b>${swordTrack(sheet.injuries ?? 0, 7, "scsheet-injuries")}<span class="scsheet-track-count">${sheet.injuries ?? 0} / 7</span></div>
      <div><b>Wounds</b>${swordTrack(sheet.wounds ?? 0, 7, "scsheet-wounds")}<span class="scsheet-track-count">${sheet.wounds ?? 0} / 7</span></div>
    </div>
  </section>

  <section class="scsheet-panel">
    <div class="scsheet-cols">
      <div>
        <h4>Ancestry &amp; Other Qualities</h4>
        ${listOr([...(sheet.qualities || []), ...(sheet.benefits || []), ...(sheet.drawbacks || [])], "No qualities recorded.")}
        <h4>Equipment</h4>
        ${listOr(sheet.equipment || [], "No equipment recorded.")}
        <h4>Retainers</h4>
        ${sheet.retainers?.length
          ? `<ul class="scsheet-list">${sheet.retainers.map((retainer) => `<li><span>${escapeHtml(retainer.name)}</span><span>${escapeHtml(retainer.notes || "")}</span></li>`).join("")}</ul>`
          : `<p class="scsheet-empty">No retainers recorded.</p>`}
      </div>
      <div>
        <h4>Allies</h4>${listOr(sheet.allies || [], "None recorded.")}
        <h4>Enemies</h4>${listOr(sheet.enemies || [], "None recorded.")}
        <h4>Oaths</h4>${listOr(sheet.oaths || [], "None sworn.")}
      </div>
    </div>
  </section>

  ${appearanceRows.length || sheet.history || sheet.notes
    ? `<section class="scsheet-panel">
        ${appearanceRows.length ? `<h4>Appearance</h4><div class="scsheet-appearance">${appearanceRows.map(([label, value]) => `<span><b>${escapeHtml(String(label))}</b>${escapeHtml(String(value))}</span>`).join("")}</div>` : ""}
        ${sheet.history ? `<h4>Personal History</h4><p class="scsheet-prose">${escapeHtml(sheet.history)}</p>` : ""}
        ${sheet.notes ? `<h4>Notes</h4><p class="scsheet-prose">${escapeHtml(sheet.notes)}</p>` : ""}
      </section>`
    : ""}
</section>`;
}

/** Expand fenced `sword-chronicle-sheet` YAML blocks into the Sword Chronicle sheet. */
function expandSwordChronicleSheets(content: string) {
  return content.replace(/```sword-chronicle-sheet\s*\n([\s\S]*?)```/g, (_match, inner) => {
    return `\n\n${compactSheetHtml(renderSwordChronicleSheetHtml(String(inner)))}\n\n`;
  });
}

// ---- ALIEN RPG (Year Zero) character sheet ----

/**
 * Four attributes, each parenting three skills, exactly as the printed sheet
 * groups them. Display-only, like every other sheet renderer here.
 */
const ALIEN_ATTRS: { key: string; label: string; skills: { key: string; label: string }[] }[] = [
  { key: "strength", label: "Strength", skills: [
    { key: "close_combat", label: "Close Combat" },
    { key: "heavy_machinery", label: "Heavy Machinery" },
    { key: "stamina", label: "Stamina" }] },
  { key: "agility", label: "Agility", skills: [
    { key: "ranged_combat", label: "Ranged Combat" },
    { key: "mobility", label: "Mobility" },
    { key: "piloting", label: "Piloting" }] },
  { key: "wits", label: "Wits", skills: [
    { key: "observation", label: "Observation" },
    { key: "survival", label: "Survival" },
    { key: "comtech", label: "Comtech" }] },
  { key: "empathy", label: "Empathy", skills: [
    { key: "command", label: "Command" },
    { key: "manipulation", label: "Manipulation" },
    { key: "medical_aid", label: "Medical Aid" }] }
];

const ALIEN_CONDITIONS = ["starving", "dehydrated", "exhausted", "freezing"];
const ALIEN_CONSUMABLES = ["air", "food", "power", "water"];

function alienNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function renderAlienSheetHtml(rawInput: string): string {
  let sheet: Record<string, any>;
  try {
    sheet = (yaml.parse(rawInput.trim()) || {}) as Record<string, any>;
  } catch (error) {
    return `<section class="alien-sheet alien-sheet-error"><p>ALIEN sheet data could not be parsed: ${escapeHtml(error instanceof Error ? error.message : "invalid YAML")}</p></section>`;
  }

  const attrs = sheet.attributes || {};
  const skills = sheet.skills || {};
  const esc = (v: unknown) => escapeHtml(String(v ?? ""));

  const pips = (filled: number, total: number, cls: string) =>
    Array.from({ length: total }, (_, i) =>
      `<span class="alien-pip${i < filled ? ` alien-pip-on ${cls}` : ""}"></span>`).join("");

  const attrBlocks = ALIEN_ATTRS.map((group) => {
    const rows = group.skills.map((s) =>
      `<div class="alien-skill"><span>${esc(s.label)}</span><b>${alienNum(skills[s.key])}</b></div>`).join("");
    return `<div class="alien-attr">
      <div class="alien-attr-head"><span>${esc(group.label)}</span><b>${alienNum(attrs[group.key])}</b></div>
      ${rows}
    </div>`;
  }).join("");

  const list = (items: unknown, empty: string) => {
    const arr = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!arr.length) return `<p class="alien-empty">${esc(empty)}</p>`;
    return `<ul class="alien-list">${arr.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  };

  const weapons = Array.isArray(sheet.weapons) ? sheet.weapons : [];
  const weaponRows = weapons.length
    ? weapons.map((w: any) => `<tr><td>${esc(w?.name)}</td><td>${esc(w?.bonus ?? "")}</td><td>${esc(w?.damage ?? "")}</td><td>${esc(w?.range ?? "")}</td></tr>`).join("")
    : `<tr><td colspan="4" class="alien-empty">No weapons carried.</td></tr>`;

  const conditions = ALIEN_CONDITIONS.map((c) => {
    const on = Boolean(sheet.conditions && sheet.conditions[c]);
    return `<span class="alien-cond${on ? " alien-cond-on" : ""}">${esc(c)}</span>`;
  }).join("");

  const consumables = ALIEN_CONSUMABLES.map((c) => {
    const v = sheet.consumables ? sheet.consumables[c] : undefined;
    return `<div class="alien-consumable"><span>${esc(c)}</span><b>${v == null ? "—" : esc(v)}</b></div>`;
  }).join("");

  const health = alienNum(sheet.health);
  const healthMax = alienNum(sheet.health_max) || Math.max(health, alienNum(attrs.strength) || 3);
  const stress = alienNum(sheet.stress);
  const radiation = alienNum(sheet.radiation);

  return `<section class="alien-sheet">
  <header class="alien-head">
    <div>
      <h3>${esc(sheet.name || "Unnamed Crew")}</h3>
      <p class="alien-career">${esc(sheet.career || "")}${sheet.appearance ? ` · ${esc(sheet.appearance)}` : ""}</p>
    </div>
    <div class="alien-points">
      <span>XP <b>${alienNum(sheet.experience)}</b></span>
      <span>Story <b>${alienNum(sheet.story_points)}</b></span>
    </div>
  </header>

  <div class="alien-tracks">
    <div class="alien-track"><span>Health</span><div class="alien-pips">${pips(health, healthMax, "alien-pip-health")}</div><b>${health}/${healthMax}</b></div>
    <div class="alien-track"><span>Stress</span><div class="alien-pips">${pips(stress, 10, "alien-pip-stress")}</div><b>${stress}</b></div>
    <div class="alien-track"><span>Radiation</span><div class="alien-pips">${pips(radiation, 10, "alien-pip-rad")}</div><b>${radiation}</b></div>
  </div>

  <div class="alien-grid">${attrBlocks}</div>

  <div class="alien-cols">
    <div class="alien-panel"><h4>Talents</h4>${list(sheet.talents, "No talents yet.")}</div>
    <div class="alien-panel"><h4>Personal Agenda</h4><p>${esc(sheet.agenda || "Undeclared.")}</p></div>
    <div class="alien-panel"><h4>Relationships</h4>
      <div class="alien-rel"><span>Buddy</span><b>${esc(sheet.buddy || "—")}</b></div>
      <div class="alien-rel"><span>Rival</span><b>${esc(sheet.rival || "—")}</b></div>
    </div>
  </div>

  <div class="alien-panel">
    <h4>Weapons</h4>
    <table class="alien-table"><thead><tr><th>Weapon</th><th>Bonus</th><th>Damage</th><th>Range</th></tr></thead><tbody>${weaponRows}</tbody></table>
    <div class="alien-armor"><span>Armor</span><b>${esc(sheet.armor || "None")}</b><span>Rating</span><b>${alienNum(sheet.armor_rating)}</b></div>
  </div>

  <div class="alien-cols">
    <div class="alien-panel"><h4>Conditions</h4><div class="alien-conds">${conditions}</div></div>
    <div class="alien-panel"><h4>Consumables</h4><div class="alien-consumables">${consumables}</div></div>
  </div>

  <div class="alien-cols">
    <div class="alien-panel"><h4>Gear</h4>${list(sheet.gear, "Nothing but the jumpsuit.")}</div>
    <div class="alien-panel"><h4>Signature Item</h4><p>${esc(sheet.signature_item || "—")}</p>
      ${sheet.critical_injuries ? `<h4>Critical Injuries</h4>${list(sheet.critical_injuries, "None.")}` : ""}
    </div>
  </div>
  ${sheet.notes ? `<p class="alien-notes">${esc(sheet.notes)}</p>` : ""}
</section>`;
}

/** Expand fenced `alien-sheet` YAML blocks into the ALIEN RPG character sheet. */
function expandAlienSheets(content: string) {
  return content.replace(/```alien-sheet\s*\n([\s\S]*?)```/g, (_match, inner) => {
    return `\n\n${compactSheetHtml(renderAlienSheetHtml(String(inner)))}\n\n`;
  });
}

// ══ Inventory block ═══════════════════════════════════════════════════════════

type InventoryItem = { name?: string; qty?: number | string; weight?: number | string; value?: string; notes?: string };

function renderInventoryHtml(inner: string): string {
  let data: Record<string, unknown>;
  try { data = yaml.parse(inner.trim()) || {}; } catch { return `<p class="sheet-error">inventory: invalid YAML</p>`; }
  const items: InventoryItem[] = Array.isArray(data.items) ? data.items as InventoryItem[] : [];
  const title = data.title ? escapeHtml(String(data.title)) : "Inventory";
  const hasCols = { qty: items.some(i => i.qty != null), weight: items.some(i => i.weight != null), value: items.some(i => i.value != null), notes: items.some(i => i.notes != null) };

  const rows = items.map(item => {
    const cells = [
      `<td>${escapeHtml(String(item.name || ""))}</td>`,
      hasCols.qty ? `<td class="inv-num">${escapeHtml(String(item.qty ?? ""))}</td>` : "",
      hasCols.weight ? `<td class="inv-num">${escapeHtml(String(item.weight ?? ""))}</td>` : "",
      hasCols.value ? `<td>${escapeHtml(String(item.value ?? ""))}</td>` : "",
      hasCols.notes ? `<td class="inv-notes">${escapeHtml(String(item.notes ?? ""))}</td>` : ""
    ].join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  const headers = [
    `<th>Item</th>`,
    hasCols.qty ? `<th class="inv-num">Qty</th>` : "",
    hasCols.weight ? `<th class="inv-num">Weight</th>` : "",
    hasCols.value ? `<th>Value</th>` : "",
    hasCols.notes ? `<th>Notes</th>` : ""
  ].join("");

  return `<div class="inv-block"><h3>${title}</h3><table class="inv-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function expandInventory(content: string) {
  return content.replace(/```inventory\s*\n([\s\S]*?)```/g, (_match, inner) => `\n\n${renderInventoryHtml(String(inner))}\n\n`);
}

// ══ Tracker block ═════════════════════════════════════════════════════════════

type TrackerResource = { name?: string; current?: number | string; max?: number | string; color?: string };

function renderTrackerHtml(inner: string): string {
  let data: Record<string, unknown>;
  try { data = yaml.parse(inner.trim()) || {}; } catch { return `<p class="sheet-error">tracker: invalid YAML</p>`; }
  const resources: TrackerResource[] = Array.isArray(data.resources) ? data.resources as TrackerResource[] : [];
  const title = data.title ? escapeHtml(String(data.title)) : "Resources";

  const rows = resources.map(r => {
    const cur = Number(r.current ?? 0);
    const max = Number(r.max ?? 1);
    const pct = Math.round(Math.max(0, Math.min(100, (cur / max) * 100)));
    const color = r.color ? escapeHtml(String(r.color)) : "var(--gold)";
    return `<div class="tracker-row"><span class="tracker-label">${escapeHtml(String(r.name || ""))}</span><div class="tracker-bar"><div class="tracker-fill" style="width:${pct}%;background:${color}"></div></div><span class="tracker-val">${cur}/${max}</span></div>`;
  }).join("");

  return `<div class="tracker-block"><h3>${title}</h3>${rows}</div>`;
}

function expandTrackers(content: string) {
  return content.replace(/```tracker\s*\n([\s\S]*?)```/g, (_match, inner) => `\n\n${renderTrackerHtml(String(inner))}\n\n`);
}

// ══ Traits block ══════════════════════════════════════════════════════════════

type TraitEntry = { name?: string; value?: string | number; description?: string; type?: string };

function renderTraitsHtml(inner: string): string {
  let data: Record<string, unknown>;
  try { data = yaml.parse(inner.trim()) || {}; } catch { return `<p class="sheet-error">traits: invalid YAML</p>`; }
  const items: TraitEntry[] = Array.isArray(data.traits) ? data.traits as TraitEntry[] : [];
  const title = data.title ? escapeHtml(String(data.title)) : "Traits & Abilities";

  const chips = items.map(t => {
    const name = escapeHtml(String(t.name || ""));
    const val = t.value != null ? `<span class="trait-val">${escapeHtml(String(t.value))}</span>` : "";
    const desc = t.description ? ` title="${escapeHtml(String(t.description))}"` : "";
    const cls = t.type ? ` trait-type-${escapeHtml(t.type)}` : "";
    return `<span class="trait-chip${cls}"${desc}>${name}${val}</span>`;
  }).join("");

  return `<div class="traits-block"><h3>${title}</h3><div class="traits-grid">${chips}</div></div>`;
}

function expandTraits(content: string) {
  return content.replace(/```traits\s*\n([\s\S]*?)```/g, (_match, inner) => `\n\n${renderTraitsHtml(String(inner))}\n\n`);
}

/** Expand `![[Page]]` or `:::include [[Page]]:::` embeds inline (one level). */
function expandIncludes(content: string, resolve?: IncludeResolver) {
  if (!resolve) return content;
  // Handle both ![[Page]] and :::include [[Page Name]]::: syntaxes.
  const expanded = content
    .replace(/!\[\[([^\]]+?)\]\]/g, (_match, inner) => {
      const target = String(inner).split("#")[0].split("|")[0].trim();
      const included = resolve(target);
      if (included == null) return `*(missing embed: ${target})*`;
      return `\n\n---\n\n${included}\n\n---\n\n`;
    })
    .replace(/:::include\s+\[\[([^\]]+?)\]\]\s*:::/g, (_match, inner) => {
      const target = String(inner).split("#")[0].split("|")[0].trim();
      const included = resolve(target);
      if (included == null) return `*(missing embed: ${target})*`;
      return `\n\n---\n\n${included}\n\n---\n\n`;
    });
  return expanded;
}

/**
 * Render campaign Markdown to sanitized HTML.
 * - `player`/`handout` modes strip `:::gm` secret blocks entirely.
 * - `gm` mode renders each secret block as a styled `.gm-block` section.
 * - `[[Wiki Links]]` become anchors via the optional resolver.
 * Output is always passed through DOMPurify, so untrusted page bodies cannot
 * inject script or event-handler attributes.
 */
export function renderMarkdown(
  content: string,
  mode: RenderMode,
  resolve?: WikiLinkResolver,
  resolveMedia?: MediaPathResolver,
  resolveInclude?: IncludeResolver,
  visibleGroups?: Set<string>
) {
  content = expandIncludes(content, resolveInclude);
  content = expandGalleries(content, resolveMedia);
  content = expandTravellerSheets(content);
  content = expandWoDSheets(content);
  content = expandDnDSheets(content);
  content = expandSwordChronicleSheets(content);
  content = expandAlienSheets(content);
  content = expandInventory(content);
  content = expandTrackers(content);
  content = expandTraits(content);
  let html: string;
  if (mode !== "gm") {
    html = renderInline(stripGmBlocks(content, visibleGroups), resolve, resolveMedia);
  } else {
    // GM sees all :::gm blocks highlighted, and :::secret blocks with a group label
    let out = "";
    let last = 0;
    // Interleave :::gm and :::secret blocks
    const combined = [...content.matchAll(gmBlockSplitter), ...content.matchAll(secretBlockPattern)]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const match of combined) {
      const index = match.index ?? 0;
      out += renderInline(content.slice(last, index), resolve, resolveMedia);
      if (match[0].startsWith(":::gm")) {
        out += `<section class="gm-block"><strong>GM</strong>${renderInline(match[1], resolve, resolveMedia)}</section>`;
      } else {
        // :::secret group="..." — match[1] = group name, match[2] = content
        out += `<section class="secret-block"><strong class="secret-block-label">Secret: ${escapeHtml(match[1])}</strong>${renderInline(match[2], resolve, resolveMedia)}</section>`;
      }
      last = index + match[0].length;
    }
    out += renderInline(content.slice(last), resolve, resolveMedia);
    html = out;
  }
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-label", "data-missing", "data-target", "data-roll", "data-mod", "style"] });
}

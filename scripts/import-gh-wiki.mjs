#!/usr/bin/env node
// Convert a cloned GitHub wiki (`*.wiki.git`) into a CampaignRepo campaign repo.
//
// Usage:
//   node scripts/import-gh-wiki.mjs <wikiDir> <outDir> [--game Fantasy] [--name "Campaign Name"]
//
// - Pages  -> <outDir>/wiki/pages/<slug>.md  (with CampaignRepo frontmatter)
// - Images -> <outDir>/wiki/media/<file>
// - *-Template / *_Template pages -> <outDir>/wiki/templates/<game>/
// Categories/tags are derived from the wiki's _Sidebar.md taxonomy.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const [wikiDir, outDir, ...rest] = process.argv.slice(2);
if (!wikiDir || !outDir) {
  console.error("Usage: node scripts/import-gh-wiki.mjs <wikiDir> <outDir> [--game Fantasy] [--name \"Name\"]");
  process.exit(1);
}
const opts = Object.fromEntries(
  rest.reduce((acc, cur, i, arr) => (cur.startsWith("--") ? [...acc, [cur.slice(2), arr[i + 1]]] : acc), [])
);
const gameType = opts.game || "Fantasy";
const campaignName = opts.name || "Imported Campaign";

const SECTION_MAP = {
  Characters: { category: "character", tags: ["pc"] },
  "Noble Houses": { category: "npc", tags: ["faction", "noble-house"] },
  "Mikado Houses": { category: "npc", tags: ["faction", "mikado-house"] },
  "Countries & Regions": { category: "location", tags: ["region"] },
  "Lore & History": { category: "event", tags: ["lore"] },
  Ancestry: { category: "game", tags: ["ancestry"] },
  "Societies & Organizations": { category: "npc", tags: ["faction", "society"] },
  "Guilds of Leandan": { category: "npc", tags: ["faction", "guild"] },
  "Game Sessions": { category: "event", tags: ["session"] },
  "Rules & Items": { category: "game", tags: ["rules"] }
};

function tagSlug(label) {
  return label.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

// --- Parse _Sidebar.md into slug -> { category, tags } --------------------
function parseSidebar(text) {
  const taxonomy = new Map();
  let section = null;
  let subTag = null;
  for (const line of text.split(/\r?\n/)) {
    const sectionMatch = /^###\s+(?:[^\sA-Za-z0-9]+\s*)?(.+?)\s*$/.exec(line);
    if (sectionMatch) {
      const name = sectionMatch[1].trim();
      section = SECTION_MAP[name] || { category: "npc", tags: [tagSlug(name)] };
      subTag = null;
      continue;
    }
    const boldMatch = /^\s*\*\*(.+?)\*\*\s*$/.exec(line);
    if (boldMatch) {
      subTag = tagSlug(boldMatch[1]);
      continue;
    }
    // [[Display|Slug]]
    const linkMatch = /\[\[([^|\]]+)\|([^\]]+)\]\]/.exec(line);
    if (section && linkMatch) {
      const slug = linkMatch[2].trim();
      const tags = [...section.tags];
      if (subTag && !tags.includes(subTag)) tags.push(subTag);
      taxonomy.set(slug, { category: section.category, tags });
    }
  }
  return taxonomy;
}

// --- Body transforms ------------------------------------------------------
function convertBody(raw) {
  let body = raw.replace(/\r\n/g, "\n");
  // Drop the first H1 (duplicated by frontmatter name).
  body = body.replace(/^\s*#\s+.+\n+/, "");
  // Images: uploads/x -> /wiki/media/x
  body = body.replace(/!\[([^\]]*)\]\(uploads\/([^)]+)\)/g, (_m, alt, file) => `![${alt}](/wiki/media/${file})`);
  // Inline links [text](target) -> [[target|text]] for internal wiki targets.
  body = body.replace(/(^|[^!])\[([^\]]+)\]\(([^)]+)\)/g, (full, pre, textLabel, target) => {
    const t = target.trim();
    if (/^(https?:|mailto:|#|\/wiki\/media\/)/i.test(t)) return full; // external / media / anchor
    const base = decodeURIComponent(t.split("/").pop()).trim();
    return `${pre}[[${base}|${textLabel}]]`;
  });
  return body.trim() + "\n";
}

function deriveSummary(body) {
  for (const block of body.split(/\n{2,}/)) {
    const line = block.trim();
    if (!line || line.startsWith("#") || line.startsWith("!") || line.startsWith("[[") || /^\*[^*]/.test(line)) continue;
    const clean = line.replace(/[*_`>]/g, "").replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2").replace(/\s+/g, " ").trim();
    if (clean.length > 20) return clean.slice(0, 180);
  }
  return "";
}

function firstHeading(raw) {
  const m = /^\s*#\s+(.+)$/m.exec(raw);
  return m ? m[1].trim() : null;
}

function parseSessionDate(slug, raw) {
  const m = /\((\d{1,2})-(\d{1,2})-(\d{2})\)/.exec(slug);
  if (!m) return undefined;
  const [, mm, dd, yy] = m;
  return `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

// --- Run ------------------------------------------------------------------
const sidebar = fs.existsSync(path.join(wikiDir, "_Sidebar.md"))
  ? parseSidebar(fs.readFileSync(path.join(wikiDir, "_Sidebar.md"), "utf8"))
  : new Map();

const pagesDir = path.join(outDir, "wiki", "pages");
const mediaDir = path.join(outDir, "wiki", "media");
const tmplDir = path.join(outDir, "wiki", "templates", gameType);
const importsDir = path.join(outDir, "wiki", "imports", "characters");
const searchDir = path.join(outDir, "wiki", "search");
for (const d of [pagesDir, mediaDir, tmplDir, importsDir, searchDir]) fs.mkdirSync(d, { recursive: true });

const skip = new Set(["_Sidebar.md", "_Footer.md"]);
const entries = fs.readdirSync(wikiDir).filter((f) => f.endsWith(".md") && !skip.has(f));
const stats = { pages: 0, templates: 0, media: 0, byCategory: {} };

for (const file of entries) {
  const slug = file.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(wikiDir, file), "utf8");
  const name = firstHeading(raw) || slug.replace(/-/g, " ");
  const body = convertBody(raw);

  const isTemplate = /[-_]template$/i.test(slug);
  const tax = sidebar.get(slug) || { category: "npc", tags: ["misc"] };
  const eventDate = tax.category === "event" ? parseSessionDate(slug, raw) : undefined;

  const frontmatter = {
    category: isTemplate ? "npc" : tax.category,
    type: isTemplate ? "npc" : tax.category,
    name,
    summary: deriveSummary(body),
    tags: isTemplate ? ["template"] : tax.tags,
    visibility: "players",
    approvalStatus: "approved",
    knownToPlayers: true,
    keyLinks: [],
    aliases: [],
    ...(eventDate ? { eventDate } : {})
  };

  const serialized = `---\n${YAML.stringify(frontmatter).trim()}\n---\n\n${body}`;
  const dest = isTemplate ? path.join(tmplDir, `${slug}.md`) : path.join(pagesDir, `${slug}.md`);
  fs.writeFileSync(dest, serialized);
  if (isTemplate) {
    stats.templates++;
  } else {
    stats.pages++;
    stats.byCategory[tax.category] = (stats.byCategory[tax.category] || 0) + 1;
  }
}

// Copy media
const uploads = path.join(wikiDir, "uploads");
if (fs.existsSync(uploads)) {
  for (const file of fs.readdirSync(uploads)) {
    const src = path.join(uploads, file);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(mediaDir, file));
      stats.media++;
    }
  }
}

// campaign.yaml, search snapshot, README, gitkeep
const campaignYaml = {
  name: campaignName,
  gameType,
  categories: ["character", "npc", "location", "event", "game"],
  visibilityDefault: "players",
  approvalDefault: "approved",
  importedFrom: "GitHub wiki"
};
fs.writeFileSync(path.join(outDir, "wiki", "campaign.yaml"), YAML.stringify(campaignYaml));
fs.writeFileSync(path.join(searchDir, "index.json"), "[]\n");
fs.writeFileSync(path.join(importsDir, ".gitkeep"), "");
fs.writeFileSync(
  path.join(outDir, "README.md"),
  `# ${campaignName}\n\nThis repository is managed by CampaignRepo.\n\n- Pages: \`/wiki/pages\`\n- Media: \`/wiki/media\`\n- Templates: \`/wiki/templates\`\n- Search snapshot: \`/wiki/search/index.json\`\n- Config: \`/wiki/campaign.yaml\`\n\nImported from a GitHub wiki. Manual edits are fine if frontmatter is preserved.\n`
);

console.log(JSON.stringify(stats, null, 2));

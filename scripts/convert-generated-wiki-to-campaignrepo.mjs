#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const [sourceWikiDir, targetRepoDir] = process.argv.slice(2);

if (!sourceWikiDir || !targetRepoDir) {
  console.error("Usage: node scripts/convert-generated-wiki-to-campaignrepo.mjs <sourceWikiDir> <targetRepoDir>");
  process.exit(1);
}

const categories = {
  characters: { category: "npc", tags: ["generated", "character"] },
  episodes: { category: "event", tags: ["generated", "episode"] },
  factions: { category: "organization", tags: ["generated", "faction"] },
  items: { category: "item", tags: ["generated"] },
  locations: { category: "location", tags: ["generated"] },
  ships: { category: "vehicle", tags: ["generated", "ship"] },
  ".": { category: "lore", tags: ["generated", "index"] },
};

function walkMarkdown(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full, base));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(path.relative(base, full));
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "page";
}

function firstHeading(raw, fallback) {
  const match = raw.match(/^\s*#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function stripFirstHeading(raw) {
  return raw.replace(/^\s*#\s+.+\r?\n+/, "").trimStart();
}

function deriveSummary(body) {
  for (const block of body.split(/\n{2,}/)) {
    const line = block
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find((part) => part && !part.startsWith("#") && !part.startsWith("*("));
    if (!line) continue;
    const clean = line
      .replace(/^[-*]\s+/, "")
      .replace(/\*\*/g, "")
      .replace(/[*_`>]/g, "")
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length > 20) return clean.slice(0, 220);
  }
  return "";
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function sourceLinkKey(fromRel, target) {
  const cleanTarget = decodeURIComponent(target.split("#")[0]).replace(/\\/g, "/");
  if (!cleanTarget || /^(https?:|mailto:|#|\/)/i.test(cleanTarget)) return null;
  const fromDir = path.posix.dirname(toPosix(fromRel));
  return path.posix.normalize(path.posix.join(fromDir, cleanTarget));
}

function convertLinks(body, rel, relToSlug) {
  return body.replace(/(^|[^!])\[([^\]]+)\]\(([^)]+)\)/g, (full, prefix, label, target) => {
    const key = sourceLinkKey(rel, target);
    if (!key || !key.toLowerCase().endsWith(".md")) return full;
    const slug = relToSlug.get(key);
    if (!slug) return full;
    return `${prefix}[[${slug}|${label.trim()}]]`;
  });
}

function baseCategory(rel, raw) {
  const dir = toPosix(path.dirname(rel));
  const config = categories[dir] || categories["."];
  if (dir === "characters" && /\bplayer character\b/i.test(raw)) {
    return { category: "character", tags: ["generated", "player-character"] };
  }
  return config;
}

function episodeNumberFromName(name) {
  const match = name.match(/^Episode\s+(\d+):/i);
  return match ? Number(match[1]) : undefined;
}

const sourceRoot = path.resolve(sourceWikiDir);
const targetRoot = path.resolve(targetRepoDir);
const pagesDir = path.join(targetRoot, "wiki", "pages");
const searchDir = path.join(targetRoot, "wiki", "search");

if (!fs.existsSync(sourceRoot)) throw new Error(`Source wiki dir not found: ${sourceRoot}`);
if (!fs.existsSync(path.join(targetRoot, ".git"))) throw new Error(`Target is not a git repo: ${targetRoot}`);

const relFiles = walkMarkdown(sourceRoot);
const usedSlugs = new Map();
const relToSlug = new Map();

for (const rel of relFiles) {
  const raw = fs.readFileSync(path.join(sourceRoot, rel), "utf8");
  const name = firstHeading(raw, path.basename(rel, ".md"));
  let slug = rel === "index.md" ? "index" : slugify(name);
  const current = usedSlugs.get(slug) || 0;
  usedSlugs.set(slug, current + 1);
  if (current > 0) slug = `${slug}-${current + 1}`;
  relToSlug.set(toPosix(rel), slug);
}

fs.rmSync(pagesDir, { recursive: true, force: true });
fs.mkdirSync(pagesDir, { recursive: true });
fs.mkdirSync(searchDir, { recursive: true });

const stats = { pages: 0, byCategory: {}, linkTargets: relToSlug.size };
const searchDocs = [];

for (const rel of relFiles) {
  const full = path.join(sourceRoot, rel);
  const raw = fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n");
  const name = firstHeading(raw, path.basename(rel, ".md"));
  const slug = relToSlug.get(toPosix(rel));
  const categoryInfo = baseCategory(rel, raw);
  const body = convertLinks(stripFirstHeading(raw), rel, relToSlug);
  const episodeNumber = episodeNumberFromName(name);
  const frontmatter = {
    name,
    category: categoryInfo.category,
    type: categoryInfo.category,
    summary: deriveSummary(body),
    visibility: "gm",
    approvalStatus: "approved",
    knownToPlayers: false,
    keyLinks: [],
    tags: categoryInfo.tags,
    aliases: [],
    importedFrom: "Attackers of Opportunity wiki pipeline",
    ...(episodeNumber ? { episodeNumber } : {}),
  };

  const serialized = `---\n${YAML.stringify(frontmatter).trim()}\n---\n\n${body.trim()}\n`;
  fs.writeFileSync(path.join(pagesDir, `${slug}.md`), serialized, "utf8");
  const links = Array.from(body.matchAll(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g)).map((match) => match[1].trim());
  searchDocs.push({
    id: `10:${slug}`,
    campaignId: 10,
    campaignName: "Attackers of Opportunity",
    slug,
    title: frontmatter.name,
    category: frontmatter.category,
    summary: frontmatter.summary,
    tags: frontmatter.tags,
    aliases: frontmatter.aliases,
    visibility: frontmatter.visibility,
    approvalStatus: frontmatter.approvalStatus,
    text: body.trim(),
    playerText: body.trim(),
    links,
    backlinks: [],
    keyLinks: frontmatter.keyLinks,
  });
  stats.pages += 1;
  stats.byCategory[categoryInfo.category] = (stats.byCategory[categoryInfo.category] || 0) + 1;
}

const docsBySlug = new Map(searchDocs.map((doc) => [doc.slug, doc]));
for (const doc of searchDocs) {
  for (const target of doc.links) {
    const targetDoc = docsBySlug.get(target);
    if (targetDoc && !targetDoc.backlinks.includes(doc.slug)) {
      targetDoc.backlinks.push(doc.slug);
    }
  }
}
for (const doc of searchDocs) {
  doc.links = Array.from(new Set(doc.links)).sort((a, b) => a.localeCompare(b));
  doc.backlinks.sort((a, b) => a.localeCompare(b));
}
fs.writeFileSync(path.join(searchDir, "index.json"), JSON.stringify(searchDocs, null, 2) + "\n", "utf8");

const readme = `# Attackers of Opportunity\n\nThis repository is managed by CampaignRepo.\n\nThe wiki content in \`wiki/pages\` was converted from the generated Attackers of Opportunity transcript wiki.\n`;
fs.writeFileSync(path.join(targetRoot, "README.md"), readme, "utf8");

console.log(JSON.stringify(stats, null, 2));

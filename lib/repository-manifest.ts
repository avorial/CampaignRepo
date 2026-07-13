import type { SearchDocument, WikiPage } from "@/lib/types";
import type { StorageAdapter } from "@/lib/storage";
import { normalizeFrontmatter } from "@/lib/markdown";
import { slugify } from "@/lib/slug";

export const repositoryManifestPath = ".campaignrepo/index.json";
export const repositoryManifestSchemaVersion = 1;

export type RepositoryManifestPage = {
  id: string;
  title: string;
  path: string;
  type: string;
  tags: string[];
  links: string[];
  aliases?: string[];
  summary?: string;
  visibility?: "gm" | "players";
  approvalStatus?: "approved" | "unapproved" | "rejected";
  keyLinks?: string[];
  parent?: string;
  cover?: string;
  sha?: string;
};

export type RepositoryManifest = {
  schemaVersion: 1;
  generatedAt: string;
  generatedFromTree?: string;
  pages: RepositoryManifestPage[];
};

export type ManifestValidationResult = {
  ok: boolean;
  errors: string[];
};

export function pageIdFromSlug(slug: string, type = "page") {
  return `${slugify(type) || "page"}-${slugify(slug) || "untitled"}`;
}

function isSafeRepoPath(path: string) {
  return Boolean(path) && !path.startsWith("/") && !path.startsWith("\\") && !path.includes("..") && path.endsWith(".md");
}

export function validateRepositoryManifest(value: unknown): ManifestValidationResult {
  const errors: string[] = [];
  const manifest = value as RepositoryManifest | null;
  if (!manifest || typeof manifest !== "object") return { ok: false, errors: ["Manifest must be an object."] };
  if (manifest.schemaVersion !== repositoryManifestSchemaVersion) errors.push(`Unsupported manifest schemaVersion: ${String((manifest as any).schemaVersion)}`);
  if (!Array.isArray(manifest.pages)) errors.push("Manifest pages must be an array.");
  if (errors.length) return { ok: false, errors };

  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const [index, page] of manifest.pages.entries()) {
    if (!page || typeof page !== "object") {
      errors.push(`Page ${index} must be an object.`);
      continue;
    }
    if (!page.id || typeof page.id !== "string") errors.push(`Page ${index} is missing id.`);
    if (!page.title || typeof page.title !== "string") errors.push(`Page ${index} is missing title.`);
    if (!isSafeRepoPath(page.path)) errors.push(`Page ${page.id || index} has invalid path.`);
    if (!page.type || typeof page.type !== "string") errors.push(`Page ${page.id || index} is missing type.`);
    if (!Array.isArray(page.tags)) errors.push(`Page ${page.id || index} tags must be an array.`);
    if (!Array.isArray(page.links)) errors.push(`Page ${page.id || index} links must be an array.`);
    const idKey = page.id?.toLowerCase();
    if (idKey) {
      if (ids.has(idKey)) errors.push(`Duplicate page id: ${page.id}`);
      ids.add(idKey);
    }
    const pathKey = page.path?.toLowerCase();
    if (pathKey) {
      if (paths.has(pathKey)) errors.push(`Duplicate page path: ${page.path}`);
      paths.add(pathKey);
    }
  }

  for (const page of manifest.pages) {
    for (const link of page.links || []) {
      if (String(link).startsWith("unresolved:")) continue;
      if (!ids.has(String(link).toLowerCase())) errors.push(`Page ${page.id} links to unknown id: ${link}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function readRepositoryManifestText(text: string): RepositoryManifest {
  const parsed = JSON.parse(text) as RepositoryManifest;
  const validation = validateRepositoryManifest(parsed);
  if (!validation.ok) throw new Error(`CampaignRepo index is invalid: ${validation.errors.join("; ")}`);
  return parsed;
}

function slugFromManifestPath(path: string) {
  const name = path.split("/").pop() || path;
  return name.replace(/\.md$/i, "");
}

function pageFromManifestEntry(entry: RepositoryManifestPage): WikiPage {
  const frontmatter = normalizeFrontmatter({
    name: entry.title,
    title: entry.title,
    category: entry.type || "lore",
    type: entry.type || "lore",
    summary: entry.summary || "",
    tags: entry.tags || [],
    aliases: entry.aliases || [],
    visibility: entry.visibility || "gm",
    approvalStatus: entry.approvalStatus || "approved",
    knownToPlayers: entry.visibility === "players",
    keyLinks: entry.keyLinks || [],
    parent: entry.parent,
    cover: entry.cover
  }, entry.title);
  return {
    slug: slugFromManifestPath(entry.path),
    sha: entry.sha,
    frontmatter,
    content: "",
    raw: "",
    outgoingLinks: (entry.links || []).map((target) => ({ target, label: target })),
    backlinks: []
  };
}

export async function readRepositoryManifestSnapshot(storage: StorageAdapter) {
  const file = await storage.getTextFile(repositoryManifestPath);
  const manifest = readRepositoryManifestText(file.text);
  const backlinks = new Map<string, string[]>();
  for (const page of manifest.pages) {
    for (const target of page.links) backlinks.set(target, [...(backlinks.get(target) || []), page.id]);
  }
  return {
    pages: manifest.pages
      .map((entry) => {
        const page = pageFromManifestEntry(entry);
        return { ...page, backlinks: backlinks.get(entry.id) || [] };
      })
      .sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name)),
    manifest
  };
}

export function manifestPageFromSearchDocument(doc: SearchDocument): RepositoryManifestPage | null {
  if (!doc.slug || doc.category === "media" || doc.slug.startsWith("media/")) return null;
  const type = String(doc.category || "lore");
  return {
    id: pageIdFromSlug(doc.slug, type),
    title: doc.title || doc.slug.replace(/-/g, " "),
    path: `wiki/pages/${doc.slug}.md`,
    type,
    tags: doc.tags || [],
    links: doc.links || [],
    aliases: doc.aliases || [],
    summary: doc.summary || "",
    visibility: doc.visibility,
    approvalStatus: doc.approvalStatus,
    keyLinks: doc.keyLinks || []
  };
}

export function manifestPageFromWikiPage(slug: string, path: string, page: WikiPage): RepositoryManifestPage {
  return {
    id: pageIdFromSlug(slug, page.frontmatter.type || page.frontmatter.category),
    title: page.frontmatter.name,
    path,
    type: page.frontmatter.category,
    tags: page.frontmatter.tags || [],
    links: page.outgoingLinks.map((link) => `unresolved:${slugify(link.target) || "link"}`),
    aliases: page.frontmatter.aliases || [],
    summary: page.frontmatter.summary || "",
    visibility: page.frontmatter.visibility,
    approvalStatus: page.frontmatter.approvalStatus,
    keyLinks: page.frontmatter.keyLinks || [],
    parent: page.frontmatter.parent,
    cover: page.frontmatter.cover,
    sha: page.sha
  };
}

export function buildRepositoryManifestFromSearchDocuments(docs: SearchDocument[]): RepositoryManifest {
  const pages = docs.flatMap((doc) => {
    const page = manifestPageFromSearchDocument(doc);
    return page ? [page] : [];
  });
  const targetToId = new Map<string, string>();
  for (const doc of docs) {
    const page = manifestPageFromSearchDocument(doc);
    if (!page) continue;
    targetToId.set(doc.slug.toLowerCase(), page.id);
    targetToId.set((doc.title || "").toLowerCase(), page.id);
    for (const alias of doc.aliases || []) targetToId.set(alias.toLowerCase(), page.id);
  }
  for (const doc of docs) {
    const page = manifestPageFromSearchDocument(doc);
    if (!page) continue;
    const existing = pages.find((entry) => entry.path === page.path);
    if (existing) {
      existing.links = (doc.links || []).map((link) => {
        const key = String(link).trim().toLowerCase();
        return targetToId.get(key) || targetToId.get(slugify(key)) || `unresolved:${slugify(key) || "link"}`;
      });
    }
  }
  return {
    schemaVersion: repositoryManifestSchemaVersion,
    generatedAt: new Date().toISOString(),
    pages
  };
}

export function upsertManifestPage(manifest: RepositoryManifest | null, entry: RepositoryManifestPage): RepositoryManifest {
  const next: RepositoryManifest = manifest
    ? { ...manifest, generatedAt: new Date().toISOString(), pages: [...manifest.pages] }
    : { schemaVersion: repositoryManifestSchemaVersion, generatedAt: new Date().toISOString(), pages: [] };
  const existing = next.pages.findIndex((page) => page.id === entry.id || page.path === entry.path);
  if (existing >= 0) next.pages[existing] = { ...next.pages[existing], ...entry };
  else next.pages.push(entry);
  return next;
}

export function serializeRepositoryManifest(manifest: RepositoryManifest) {
  const validation = validateRepositoryManifest(manifest);
  if (!validation.ok) throw new Error(`Cannot write invalid CampaignRepo index: ${validation.errors.join("; ")}`);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

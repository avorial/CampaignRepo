import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage } from "@/lib/markdown";
import { aliasMapFromPages, resolveTarget } from "@/lib/links";
import { REL_TYPE_MAP } from "@/lib/relationships";
import { readPageCache } from "@/lib/page-cache";
import { readRepositoryManifestText, repositoryManifestPath } from "@/lib/repository-manifest";

export const dynamic = "force-dynamic";

type Severity = "error" | "warn" | "info";
type Finding = { type: string; severity: Severity; slug?: string; title: string; detail: string };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [files, media] = await Promise.all([
    storage.listDirectoryTextFiles("wiki/pages"),
    storage.listDirectory("wiki/media")
  ]);
  const pages = files.map((f) => parsePage(f.name.replace(/\.md$/, ""), f.text ?? "", f.sha));
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const aliasMap = aliasMapFromPages(pages);
  const mediaNames = new Set(media.filter((e) => e.type === "file").map((e) => e.name));

  const findings: Finding[] = [];

  const aliasOwners = new Map<string, string[]>();
  for (const page of pages) {
    for (const alias of page.frontmatter.aliases || []) {
      const key = alias.trim().toLowerCase();
      if (key) aliasOwners.set(key, [...(aliasOwners.get(key) || []), page.frontmatter.name || page.slug]);
    }
  }
  for (const [alias, owners] of aliasOwners) {
    if (owners.length > 1) {
      findings.push({ type: "duplicate-alias", severity: "warn", title: `Alias "${alias}"`, detail: `Used by ${owners.length} pages: ${owners.join(", ")}` });
    }
  }

  for (const page of pages) {
    const name = page.frontmatter.name?.trim();
    if (!name) {
      findings.push({ type: "empty-name", severity: "error", slug: page.slug, title: page.slug, detail: "Page has no name in its frontmatter." });
    }
    if (page.frontmatter.approvalStatus !== "approved") {
      findings.push({ type: "unapproved", severity: "info", slug: page.slug, title: name || page.slug, detail: `approvalStatus: ${page.frontmatter.approvalStatus}` });
    }
    if (page.frontmatter.parent) {
      const parent = bySlug.get(page.frontmatter.parent);
      if (!parent) {
        findings.push({ type: "invalid-parent", severity: "error", slug: page.slug, title: name || page.slug, detail: `Parent "${page.frontmatter.parent}" does not exist.` });
      } else if (parent.frontmatter.category !== page.frontmatter.category) {
        findings.push({ type: "parent-mismatch", severity: "warn", slug: page.slug, title: name || page.slug, detail: `Parent "${parent.frontmatter.name}" is ${parent.frontmatter.category}, not ${page.frontmatter.category} — it won't nest in the sidebar.` });
      }
    }
    for (const link of page.outgoingLinks) {
      if (!bySlug.has(resolveTarget(aliasMap, link.target))) {
        findings.push({ type: "broken-link", severity: "warn", slug: page.slug, title: name || page.slug, detail: `Links to "${link.target}", which has no matching page.` });
      }
    }
    for (const rel of page.frontmatter.relationships || []) {
      const target = resolveTarget(aliasMap, rel.target);
      if (!target || !bySlug.has(target)) {
        findings.push({ type: "broken-relationship", severity: "warn", slug: page.slug, title: name || page.slug, detail: `Relationship "${rel.type}" points at "${rel.target}", which has no matching page.` });
      }
      if (target === page.slug) {
        findings.push({ type: "self-relationship", severity: "info", slug: page.slug, title: name || page.slug, detail: `Relationship "${rel.type}" points back to the same page.` });
      }
      if (rel.type && !REL_TYPE_MAP.has(rel.type)) {
        findings.push({ type: "unknown-relationship-type", severity: "info", slug: page.slug, title: name || page.slug, detail: `Relationship type "${rel.type}" is not in CampaignRepo's relationship type registry.` });
      }
    }
    for (const match of page.content.matchAll(/\/wiki\/media\/([^\s)"'#?]+)/g)) {
      const file = decodeURIComponent(match[1]).split("/").pop();
      if (file && !mediaNames.has(file)) {
        findings.push({ type: "missing-media", severity: "error", slug: page.slug, title: name || page.slug, detail: `References missing media: ${file}` });
      }
    }
  }

  // Orphaned pages: no incoming links and no parent — they exist but can't be discovered.
  const linkedSlugs = new Set<string>();
  for (const page of pages) {
    for (const link of page.outgoingLinks) {
      const resolved = resolveTarget(aliasMap, link.target);
      if (resolved) linkedSlugs.add(resolved);
    }
    for (const key of page.frontmatter.keyLinks || []) {
      const resolved = resolveTarget(aliasMap, key);
      if (resolved) linkedSlugs.add(resolved);
    }
  }
  for (const page of pages) {
    if (!linkedSlugs.has(page.slug) && !page.frontmatter.parent) {
      const name = page.frontmatter.name?.trim() || page.slug;
      findings.push({ type: "orphaned-page", severity: "info", slug: page.slug, title: name, detail: "No other page links here and no parent is set — this page is undiscoverable." });
    }
  }

  // Oversized media files (> 1 MB for images; > 10 MB for any file).
  const WARN_SIZE = 1 * 1024 * 1024;
  const ERROR_SIZE = 10 * 1024 * 1024;
  for (const entry of media) {
    if (entry.type !== "file" || !entry.size || entry.name === ".gitkeep") continue;
    if (entry.size >= ERROR_SIZE) {
      findings.push({ type: "oversized-file", severity: "error", title: entry.name, detail: `${(entry.size / 1024 / 1024).toFixed(1)} MB — exceeds 10 MB hard limit for GitHub API uploads.` });
    } else if (entry.size >= WARN_SIZE) {
      findings.push({ type: "oversized-file", severity: "warn", title: entry.name, detail: `${(entry.size / 1024 / 1024).toFixed(1)} MB — consider compressing to keep the repo lean.` });
    }
  }

  // Unused media: files in wiki/media that are not referenced by any page content or cover field.
  const referencedMedia = new Set<string>();
  for (const page of pages) {
    // Content references: /wiki/media/<name> or wiki/media/<name>
    for (const match of page.raw.matchAll(/wiki\/media\/([^\s)"'#?>\]]+)/g)) {
      const file = decodeURIComponent(match[1]).split("/").pop();
      if (file) referencedMedia.add(file);
    }
    // Cover frontmatter
    if (page.frontmatter.cover) {
      const coverFile = page.frontmatter.cover.split("/").pop();
      if (coverFile) referencedMedia.add(coverFile);
    }
  }
  for (const entry of media) {
    if (entry.type !== "file" || entry.name === ".gitkeep") continue;
    if (!referencedMedia.has(entry.name)) {
      findings.push({ type: "unused-media", severity: "info", title: entry.name, detail: `Not referenced by any page — safe to delete from the media manager.` });
    }
  }

  // Maps: validate pins pointing at non-existent pages or missing media, and routes with invalid pin indices.
  try {
    const mapFiles = await storage.listDirectoryTextFiles("wiki/maps", ".json");
    const parsedMaps = mapFiles
      .filter((mf) => mf.name.endsWith(".json"))
      .map((mf) => {
        const slug = mf.name.replace(/\.json$/, "");
        try { return { slug, data: JSON.parse(mf.text ?? "{}") as Record<string, unknown> }; } catch { return null; }
      })
      .filter((m): m is { slug: string; data: Record<string, unknown> } => m !== null);
    const mapSlugs = new Set(parsedMaps.map((m) => m.slug));

    for (const { slug: mapName, data: mapData } of parsedMaps) {
      const title = mapData.name ? String(mapData.name) : mapName;
      const pins = Array.isArray(mapData.pins) ? mapData.pins as Array<Record<string, unknown>> : [];
      const routes = Array.isArray(mapData.routes) ? mapData.routes as Array<Record<string, unknown>> : [];

      // Base map image
      if (typeof mapData.image === "string" && mapData.image && !mediaNames.has(mapData.image.split("/").pop() || "")) {
        findings.push({ type: "broken-map-image", severity: "error", title, detail: `Map background image "${mapData.image}" is missing from media.` });
      }

      for (const [i, pin] of pins.entries()) {
        if (typeof pin.pageSlug === "string" && pin.pageSlug && !bySlug.has(pin.pageSlug)) {
          findings.push({ type: "broken-map-pin", severity: "warn", title, detail: `Pin ${i + 1} "${pin.label || pin.pageSlug}" links to page "${pin.pageSlug}" which does not exist.` });
        }
        if (typeof pin.mapSlug === "string" && pin.mapSlug && !mapSlugs.has(pin.mapSlug)) {
          findings.push({ type: "broken-map-pin", severity: "warn", title, detail: `Pin ${i + 1} "${pin.label || pin.mapSlug}" links to nested map "${pin.mapSlug}" which does not exist.` });
        }
        if (typeof pin.image === "string" && pin.image && !mediaNames.has(pin.image.split("/").pop() || "")) {
          findings.push({ type: "broken-map-pin", severity: "warn", title, detail: `Pin ${i + 1} "${pin.label || ""}" references missing image "${pin.image}".` });
        }
      }
      for (const [i, route] of routes.entries()) {
        const from = Number(route.fromIndex ?? -1);
        const to = Number(route.toIndex ?? -1);
        if (from < 0 || from >= pins.length || to < 0 || to >= pins.length) {
          findings.push({ type: "broken-map-route", severity: "warn", title, detail: `Route ${i + 1} "${route.label || ""}" references an out-of-bounds pin index.` });
        }
      }
    }
  } catch { /* maps not found */ }

  // Generated state: the manifest, search snapshot, and page cache are
  // disposable outputs rebuilt from page source. When they disagree with the
  // source, the source is right — report the drift and point at Repair.
  const generated = {
    pageFiles: pages.length,
    manifestPages: null as number | null,
    searchDocs: null as number | null,
    cacheRows: 0,
    cacheRefreshedAt: null as string | null,
    cacheRefreshError: null as string | null
  };
  try {
    const manifestFile = await storage.getTextFile(repositoryManifestPath);
    try {
      generated.manifestPages = readRepositoryManifestText(manifestFile.text).pages.length;
      if (generated.manifestPages !== pages.length) {
        findings.push({
          type: "stale-manifest",
          severity: "warn",
          title: "Repository manifest drift",
          detail: `The manifest lists ${generated.manifestPages} pages but the repo has ${pages.length} page files. Run Repair indexes to rebuild it from source.`
        });
      }
    } catch (error) {
      findings.push({
        type: "invalid-manifest",
        severity: "error",
        title: "Repository manifest invalid",
        detail: `${error instanceof Error ? error.message : "Manifest could not be parsed."} Run Repair indexes to rebuild it from source.`
      });
    }
  } catch {
    findings.push({
      type: "missing-manifest",
      severity: "info",
      title: "Repository manifest missing",
      detail: "This repo has no .campaignrepo/index.json yet; navigation falls back to slower paths. Run Repair indexes to generate it."
    });
  }
  try {
    const searchFile = await storage.getTextFile("wiki/search/index.json");
    const docs = JSON.parse(searchFile.text) as Array<{ slug?: string; category?: string }>;
    const pageDocs = docs.filter((doc) => doc?.slug && doc.category !== "media" && !String(doc.slug).startsWith("media/"));
    generated.searchDocs = pageDocs.length;
    if (pageDocs.length !== pages.length) {
      findings.push({
        type: "stale-search-index",
        severity: "warn",
        title: "Search snapshot drift",
        detail: `The search snapshot has ${pageDocs.length} page documents but the repo has ${pages.length} page files. Run Repair indexes to rebuild it from source.`
      });
    }
  } catch {
    findings.push({
      type: "missing-search-index",
      severity: "info",
      title: "Search snapshot missing",
      detail: "wiki/search/index.json is missing or unreadable. Run Repair indexes to regenerate it."
    });
  }
  const cache = readPageCache(campaign.id);
  generated.cacheRows = cache.pages.length;
  generated.cacheRefreshedAt = cache.refreshedAt;
  generated.cacheRefreshError = cache.refreshError;
  if (cache.refreshError) {
    findings.push({
      type: "cache-refresh-error",
      severity: "warn",
      title: "Page cache refresh failed",
      detail: `Last refresh error: ${cache.refreshError}`
    });
  }
  const sourceBodies = new Map(pages.map((page) => [page.slug, Boolean(page.content.trim())]));
  for (const row of cache.pages) {
    if (!row.content.trim() && sourceBodies.get(row.slug)) {
      findings.push({
        type: "empty-cache-body",
        severity: "error",
        slug: row.slug,
        title: row.frontmatter.name || row.slug,
        detail: "The cached copy of this page lost its body while the source still has content. Opening the page or running Repair indexes fixes the cached copy."
      });
    }
  }

  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});
  return NextResponse.json({ pageCount: pages.length, mediaCount: media.filter((e) => e.type === "file").length, findings, counts, generated });
}

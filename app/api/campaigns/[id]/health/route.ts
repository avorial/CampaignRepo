import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { parsePage } from "@/lib/markdown";
import { aliasMapFromPages, resolveTarget } from "@/lib/links";

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

  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});
  return NextResponse.json({ pageCount: pages.length, findings, counts });
}

import { slugify } from "@/lib/slug";
import type { WikiPage } from "@/lib/types";

export interface AliasablePage {
  slug: string;
  name: string;
  aliases: string[];
}

export interface ResolvedLink {
  slug: string;
  missing: boolean;
}

/**
 * Build a lowercase lookup from page slug, display name, and aliases to the
 * canonical slug. Shared by search indexing, the relationship graph, and the
 * wiki-link renderer so link resolution behaves identically everywhere.
 */
export function buildAliasMap(pages: AliasablePage[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const page of pages) {
    aliases.set(page.slug.toLowerCase(), page.slug);
    if (page.name) aliases.set(page.name.toLowerCase(), page.slug);
    for (const alias of page.aliases || []) aliases.set(alias.toLowerCase(), page.slug);
  }
  return aliases;
}

/** Convenience: build an alias map directly from parsed WikiPages. */
export function aliasMapFromPages(pages: WikiPage[]): Map<string, string> {
  return buildAliasMap(
    pages.map((page) => ({ slug: page.slug, name: page.frontmatter.name, aliases: page.frontmatter.aliases || [] }))
  );
}

/** Resolve a `[[target]]` to a canonical slug, falling back to slugify. */
export function resolveTarget(aliasMap: Map<string, string>, target: string): string {
  return aliasMap.get(target.trim().toLowerCase()) || slugify(target);
}

/** Resolve a link target and report whether it points at a known page. */
export function resolveLinkTarget(
  aliasMap: Map<string, string>,
  knownSlugs: Set<string>,
  target: string
): ResolvedLink {
  const slug = resolveTarget(aliasMap, target);
  return { slug, missing: !knownSlugs.has(slug) };
}

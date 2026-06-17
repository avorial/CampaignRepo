import type { WikiPageFrontmatter } from "@/lib/types";
import packsJson from "@/lib/template-packs.json";

export interface TemplateDef {
  slug: string;
  frontmatter: WikiPageFrontmatter;
  body: string;
}

// Built-in template packs keyed by game system. Source of truth lives in
// scripts/build-packs.mjs, which regenerates template-packs.json.
export const templatePacks = packsJson as unknown as Record<string, TemplateDef[]>;

/** Templates seeded into a new repo for a system (falls back to Custom). */
export function packFor(gameType: string): TemplateDef[] {
  return templatePacks[gameType] || templatePacks.Custom || [];
}

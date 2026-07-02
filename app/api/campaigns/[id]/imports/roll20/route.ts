import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { defaultFrontmatter } from "@/lib/templates";
import { serializePage } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import { scheduleSearchIndexRebuild } from "@/lib/search";

export const dynamic = "force-dynamic";

const schema = z.object({
  json: z.unknown(),
  visibility: z.enum(["gm", "players"]).default("gm"),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved"),
  includeHandouts: z.boolean().default(true)
});

type R20Entry = Record<string, unknown>;

function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return html
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `${"#".repeat(Number(n))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) =>
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) => `- ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n")
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
      let n = 0;
      return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) => `${++n}. ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parse the Roll20 campaign export JSON (schema_version 2) or array of character objects. */
function extractEntries(raw: unknown): { type: "character" | "handout"; entry: R20Entry }[] {
  const result: { type: "character" | "handout"; entry: R20Entry }[] = [];
  if (!raw || typeof raw !== "object") return result;

  const obj = raw as Record<string, unknown>;

  // Full campaign export: { schema_version, campaign, characters, handouts }
  const chars = Array.isArray(obj.characters) ? obj.characters as R20Entry[] :
                Array.isArray(obj.Chars) ? obj.Chars as R20Entry[] : [];
  for (const c of chars) result.push({ type: "character", entry: c });

  const handouts = Array.isArray(obj.handouts) ? obj.handouts as R20Entry[] :
                   Array.isArray(obj.Handouts) ? obj.Handouts as R20Entry[] : [];
  for (const h of handouts) result.push({ type: "handout", entry: h });

  // Array of characters directly
  if (Array.isArray(raw)) {
    for (const item of raw as R20Entry[]) {
      if (typeof item !== "object" || !item) continue;
      // If it has `bio` key it's likely a character
      if (typeof item.name === "string") result.push({ type: "character", entry: item });
    }
  }

  // Single character object
  if (!result.length && typeof obj.name === "string") result.push({ type: "character", entry: obj });

  return result;
}

/** Parse Roll20 character attributes into a quick stat summary. */
function buildSummary(attrs: unknown): string {
  if (!Array.isArray(attrs)) return "";
  const attrMap: Record<string, string> = {};
  for (const a of attrs as R20Entry[]) {
    if (typeof a.name === "string" && (typeof a.current === "string" || typeof a.current === "number")) {
      attrMap[a.name.toLowerCase()] = String(a.current);
    }
  }
  const parts: string[] = [];
  const cls = attrMap["class"] || attrMap["character_class"] || "";
  const race = attrMap["race"] || attrMap["character_race"] || "";
  const level = attrMap["level"] || attrMap["character_level"] || "";
  if (race) parts.push(race);
  if (cls) parts.push(cls);
  if (level) parts.push(`Level ${level}`);
  return parts.join(", ");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage configured" }, { status: 400 });

  const input = schema.parse(await req.json());
  const entries = extractEntries(input.json);
  if (!entries.length) return NextResponse.json({ error: "No characters or handouts found. Paste a Roll20 campaign export JSON." }, { status: 400 });

  const results: { slug: string; name: string; created: boolean; error?: string }[] = [];

  for (const { type, entry } of entries) {
    if (type === "handout" && !input.includeHandouts) continue;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name) continue;

    const category = type === "character" ? "character" : "lore";

    const bioHtml = typeof entry.bio === "string" ? entry.bio :
                    typeof entry.notes === "string" ? entry.notes : "";
    const gmHtml = typeof entry.gmnotes === "string" ? entry.gmnotes : "";

    let body = htmlToMarkdown(bioHtml);
    if (gmHtml) {
      const gmMd = htmlToMarkdown(gmHtml);
      if (gmMd) body += `\n\n:::gm\n${gmMd}\n:::`;
    }

    const summary = buildSummary(entry.attributes) || body.split("\n")[0].slice(0, 200);
    const r20Id = typeof entry.id === "string" ? entry.id : undefined;

    const slug = slugify(name) || `roll20-${Date.now()}`;
    const path = `wiki/pages/${slug}.md`;

    const frontmatter = {
      ...defaultFrontmatter(name, category),
      summary,
      visibility: input.visibility as "gm" | "players",
      approvalStatus: input.approvalStatus as "approved" | "unapproved" | "rejected",
      sourceImport: "roll20",
      ...(r20Id ? { foundryId: `roll20:${r20Id}` } : {})
    };

    try {
      let existingSha: string | undefined;
      try { const ex = await storage.getTextFile(path); existingSha = ex.sha; } catch { /* new */ }
      await storage.putFile(path, serializePage(frontmatter, body), `CampaignRepo: Roll20 import — ${name}`, existingSha);
      results.push({ slug, name, created: !existingSha });
    } catch (e) {
      results.push({ slug, name, created: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  scheduleSearchIndexRebuild(campaign);
  const created = results.filter((r) => r.created && !r.error).length;
  const updated = results.filter((r) => !r.created && !r.error).length;
  return NextResponse.json({ results, created, updated, errors: results.filter((r) => r.error).length, total: results.length });
}

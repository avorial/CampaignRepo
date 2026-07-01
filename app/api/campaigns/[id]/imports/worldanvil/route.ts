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

const bodySchema = z.object({
  json: z.unknown(),
  visibility: z.enum(["gm", "players"]).default("gm"),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved")
});

const WA_CATEGORY_MAP: Record<string, string> = {
  character: "character",
  person: "character",
  npc: "npc",
  location: "location",
  settlement: "location",
  region: "location",
  continent: "location",
  planet: "location",
  geographicLocation: "location",
  building: "location",
  myth: "lore",
  legend: "lore",
  tradition: "lore",
  ritual: "lore",
  law: "lore",
  lore: "lore",
  document: "lore",
  language: "lore",
  technology: "lore",
  organization: "faction",
  faction: "faction",
  ethnicGroup: "faction",
  item: "item",
  vehicle: "item",
  weapon: "item",
  armor: "item",
  spell: "spell",
  condition: "lore",
  species: "species",
  race: "species",
  creature: "creature",
  monster: "creature",
  event: "event",
  historicalevent: "event",
  militaryConflict: "event",
  rank: "lore",
  profession: "lore",
  material: "item",
  deity: "lore",
  religion: "religion"
};

function mapEntityClass(entityClass: string): string {
  const key = (entityClass || "").toLowerCase().replace(/\s+/g, "");
  for (const [k, v] of Object.entries(WA_CATEGORY_MAP)) {
    if (key === k.toLowerCase()) return v;
  }
  return "lore";
}

function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return html
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n")
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<ul[^>]*>|<\/ul>/gi, "")
    .replace(/<ol[^>]*>|<\/ol>/gi, "")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<section[^>]*class="[^"]*secret[^"]*"[^>]*>[\s\S]*?<\/section>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractArticles(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.articles)) return obj.articles as Array<Record<string, unknown>>;
    if (Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>;
    // Single article
    if (typeof obj.title === "string" || typeof obj.name === "string") return [obj];
  }
  return [];
}

function extractTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((t) => {
      if (typeof t === "string") return t;
      if (t && typeof t === "object" && typeof (t as Record<string, unknown>).title === "string") return (t as Record<string, unknown>).title as string;
      return "";
    }).filter(Boolean);
  }
  if (typeof tags === "string") return tags.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage configured" }, { status: 400 });

  let parsed: unknown;
  try {
    const input = bodySchema.parse(await req.json());
    parsed = input.json;
    const visibility = input.visibility;
    const approvalStatus = input.approvalStatus;

    const articles = extractArticles(parsed);
    if (!articles.length) return NextResponse.json({ error: "No articles found. Paste the full World Anvil JSON export." }, { status: 400 });

    const results: { slug: string; name: string; created: boolean; error?: string }[] = [];

    for (const article of articles) {
      const name = (typeof article.title === "string" && article.title) ||
                   (typeof article.name === "string" && article.name) || "";
      if (!name.trim()) continue;

      const entityClass = typeof article.entityClass === "string" ? article.entityClass :
                          typeof article.type === "string" ? article.type :
                          typeof article.category === "string" ? article.category : "";
      const category = mapEntityClass(entityClass);

      const rawContent = typeof article.content === "string" ? article.content :
                         typeof article.body === "string" ? article.body : "";
      const body = htmlToMarkdown(rawContent);

      const summary = typeof article.excerpt === "string" ? htmlToMarkdown(article.excerpt) :
                      typeof article.summary === "string" ? htmlToMarkdown(article.summary) :
                      body.split("\n")[0].slice(0, 200);

      const tags = extractTags(article.tags);
      const slug = slugify(name) || `wa-${Date.now()}`;
      const path = `wiki/pages/${slug}.md`;

      const frontmatter = {
        ...defaultFrontmatter(name, category),
        summary,
        tags,
        visibility,
        approvalStatus,
        sourceImport: "worldanvil"
      };

      try {
        let existingSha: string | undefined;
        try { const ex = await storage.getTextFile(path); existingSha = ex.sha; } catch { /* new */ }
        await storage.putFile(path, serializePage(frontmatter, body), `CampaignRepo: World Anvil import — ${name}`, existingSha);
        results.push({ slug, name, created: !existingSha });
      } catch (e) {
        results.push({ slug, name, created: false, error: e instanceof Error ? e.message : "Unknown error" });
      }
    }

    scheduleSearchIndexRebuild(campaign);
    const created = results.filter((r) => r.created && !r.error).length;
    const updated = results.filter((r) => !r.created && !r.error).length;
    const errors = results.filter((r) => r.error).length;
    return NextResponse.json({ results, created, updated, errors, total: results.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid JSON" }, { status: 400 });
  }
}

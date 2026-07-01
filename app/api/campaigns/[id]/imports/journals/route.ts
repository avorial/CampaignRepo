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
  json: z.union([z.record(z.any()), z.array(z.any())]),
  visibility: z.enum(["gm", "players"]).default("gm"),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved"),
  category: z.string().default("lore")
});

type JournalEntry = { _id?: string; name?: string; pages?: JournalPage[]; content?: string; folder?: string; flags?: Record<string, unknown> };
type JournalPage = { _id?: string; name?: string; text?: { content?: string; markdown?: string }; type?: string };

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, n, t) => `${"#".repeat(Number(n))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gis, (_, t) => `${t.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, inner) => inner.replace(/<li[^>]*>(.*?)<\/li>/gis, (_m: string, li: string) => `- ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n")
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, inner) => { let n = 0; return inner.replace(/<li[^>]*>(.*?)<\/li>/gis, (_m: string, li: string) => `${++n}. ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n"; })
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractEntries(raw: unknown): JournalEntry[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is JournalEntry => typeof item === "object" && item !== null && "name" in item);
  }
  const obj = raw as Record<string, unknown>;
  if (obj.name && (obj.pages || obj.content)) return [obj as JournalEntry];
  if (Array.isArray(obj.journals)) return obj.journals as JournalEntry[];
  if (Array.isArray(obj.pages)) return [obj as JournalEntry];
  return [];
}

function entryToMarkdown(entry: JournalEntry): string {
  const pages = entry.pages || [];
  if (pages.length === 0 && entry.content) return htmlToMarkdown(entry.content);
  return pages
    .filter((p) => p.type !== "image")
    .map((p) => {
      const heading = pages.length > 1 && p.name ? `## ${p.name}\n\n` : "";
      const md = p.text?.markdown || (p.text?.content ? htmlToMarkdown(p.text.content) : "");
      return heading + md;
    })
    .join("\n\n")
    .trim();
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
  if (!entries.length) return NextResponse.json({ error: "No journal entries found. Paste a Foundry Journal JSON or array of entries." }, { status: 400 });

  const results: { slug: string; name: string; created: boolean; error?: string }[] = [];

  for (const entry of entries) {
    const name = String(entry.name || "Imported entry");
    const content = entryToMarkdown(entry);
    const slug = slugify(name) || `journal-${Date.now()}`;
    const path = `wiki/pages/${slug}.md`;

    const frontmatter = {
      ...defaultFrontmatter(name, input.category),
      visibility: input.visibility as "gm" | "players",
      approvalStatus: input.approvalStatus as "approved" | "unapproved" | "rejected",
      sourceImport: "foundry-journal"
    };

    try {
      let existingSha: string | undefined;
      try { const existing = await storage.getTextFile(path); existingSha = existing.sha; } catch { /* new */ }
      await storage.putFile(path, serializePage(frontmatter, content), `CampaignRepo: Foundry journal import — ${name}`, existingSha);
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

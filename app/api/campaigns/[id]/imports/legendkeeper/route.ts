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
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved")
});

type LKNode = Record<string, unknown>;

const LK_TYPE_MAP: Record<string, string> = {
  article: "lore",
  character: "character",
  npc: "npc",
  location: "location",
  place: "location",
  town: "location",
  city: "location",
  region: "location",
  organization: "organization",
  faction: "organization",
  item: "item",
  artifact: "item",
  event: "event",
  lore: "lore",
  note: "lore",
  quest: "lore",
  creature: "npc",
  monster: "npc",
  spell: "spell",
  deity: "lore",
  god: "lore"
};

function mapLKType(type: string): string {
  const key = (type || "").toLowerCase().trim();
  return LK_TYPE_MAP[key] ?? "lore";
}

/** Convert a ProseMirror JSON doc to Markdown. */
function pmToMarkdown(node: unknown, depth = 0): string {
  if (!node || typeof node !== "object") return "";
  const n = node as LKNode;
  const type = String(n.type || "");
  const content = Array.isArray(n.content) ? n.content as LKNode[] : [];
  const children = () => content.map(c => pmToMarkdown(c, depth)).join("");

  switch (type) {
    case "doc": return children();
    case "paragraph": return children() + "\n\n";
    case "heading": return "#".repeat(Number(n.attrs && (n.attrs as LKNode).level) || 1) + " " + children() + "\n\n";
    case "text": {
      let text = typeof n.text === "string" ? n.text : "";
      const marks = Array.isArray(n.marks) ? n.marks as LKNode[] : [];
      for (const mark of marks) {
        const mt = String(mark.type || "");
        if (mt === "bold" || mt === "strong") text = `**${text}**`;
        else if (mt === "italic" || mt === "em") text = `*${text}*`;
        else if (mt === "code") text = `\`${text}\``;
        else if (mt === "link") {
          const href = mark.attrs && typeof (mark.attrs as LKNode).href === "string" ? (mark.attrs as LKNode).href as string : "";
          text = href ? `[${text}](${href})` : text;
        }
      }
      return text;
    }
    case "hard_break": return "\n";
    case "horizontal_rule": return "\n---\n\n";
    case "bullet_list": return content.map(c => pmToMarkdown(c, depth)).join("") + "\n";
    case "ordered_list": {
      let i = Number((n.attrs as LKNode | undefined)?.start ?? 1);
      return content.map(c => {
        const inner = pmToMarkdown(c, depth).replace(/\n\n$/, "");
        return `${i++}. ${inner}\n`;
      }).join("") + "\n";
    }
    case "list_item": return `- ${children().replace(/\n\n$/, "")}\n`;
    case "blockquote": return children().split("\n").map(l => l ? `> ${l}` : l).join("\n") + "\n";
    case "code_block": {
      const lang = String((n.attrs as LKNode | undefined)?.language ?? "");
      return `\`\`\`${lang}\n${children()}\`\`\`\n\n`;
    }
    case "image": {
      const src = String((n.attrs as LKNode | undefined)?.src ?? "");
      const alt = String((n.attrs as LKNode | undefined)?.alt ?? "");
      return src ? `![${alt}](${src})\n\n` : "";
    }
    default: return children();
  }
}

function extractContent(entry: LKNode): string {
  // ProseMirror JSON
  if (entry.content && typeof entry.content === "object" && !Array.isArray(entry.content)) {
    return pmToMarkdown(entry.content).trim();
  }
  // Older LK format: array of content nodes
  if (Array.isArray(entry.content)) {
    return pmToMarkdown({ type: "doc", content: entry.content }).trim();
  }
  // Plain text / HTML fallback
  if (typeof entry.body === "string") return entry.body.replace(/<[^>]+>/g, "").trim();
  if (typeof entry.text === "string") return entry.text.trim();
  return "";
}

function extractEntries(raw: unknown): LKNode[] {
  if (Array.isArray(raw)) return raw as LKNode[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // Standard LK export format
    if (Array.isArray(obj.entries)) return obj.entries as LKNode[];
    if (Array.isArray(obj.pages)) return obj.pages as LKNode[];
    if (Array.isArray(obj.articles)) return obj.articles as LKNode[];
    if (Array.isArray(obj.nodes)) return obj.nodes as LKNode[];
    if (Array.isArray(obj.items)) return obj.items as LKNode[];
    // Campaign-level export with world data
    if (Array.isArray(obj.world)) return obj.world as LKNode[];
    // Single entry
    if (typeof obj.title === "string" || typeof obj.name === "string") return [obj];
  }
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

  const input = schema.parse(await req.json());
  const entries = extractEntries(input.json);
  if (!entries.length) return NextResponse.json({ error: "No entries found. Paste a LegendKeeper JSON export." }, { status: 400 });

  const results: { slug: string; name: string; created: boolean; error?: string }[] = [];

  for (const entry of entries) {
    const name = (typeof entry.title === "string" && entry.title) ||
                 (typeof entry.name === "string" && entry.name) || "";
    if (!name.trim()) continue;

    const entryType = typeof entry.type === "string" ? entry.type : typeof entry.category === "string" ? entry.category : "";
    const category = mapLKType(entryType);
    const body = extractContent(entry);
    const summary = typeof entry.summary === "string" ? entry.summary :
                    typeof entry.excerpt === "string" ? entry.excerpt :
                    body.split("\n")[0].slice(0, 200);

    const rawTags = Array.isArray(entry.tags) ? (entry.tags as unknown[]).map(t =>
      typeof t === "string" ? t : typeof t === "object" && t && typeof (t as LKNode).name === "string" ? (t as LKNode).name as string : ""
    ).filter(Boolean) : [];

    const slug = slugify(name) || `lk-${Date.now()}`;
    const path = `wiki/pages/${slug}.md`;
    const lkId = typeof entry.id === "string" ? entry.id : undefined;

    const frontmatter = {
      ...defaultFrontmatter(name, category),
      summary,
      tags: rawTags,
      visibility: input.visibility as "gm" | "players",
      approvalStatus: input.approvalStatus as "approved" | "unapproved" | "rejected",
      sourceImport: "legendkeeper",
      ...(lkId ? { foundryId: `lk:${lkId}` } : {})
    };

    try {
      let existingSha: string | undefined;
      try { const ex = await storage.getTextFile(path); existingSha = ex.sha; } catch { /* new */ }
      await storage.putFile(path, serializePage(frontmatter, body), `CampaignRepo: LegendKeeper import — ${name}`, existingSha);
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

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
  files: z.array(z.object({ name: z.string(), content: z.string() })).min(1).max(500),
  defaultCategory: z.string().default("lore"),
  visibility: z.enum(["gm", "players"]).default("gm"),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved"),
  folderAsCategory: z.boolean().default(true)
});

function parseObsidianFrontmatter(content: string): { fm: Record<string, unknown>; body: string } {
  if (!content.startsWith("---")) return { fm: {}, body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { fm: {}, body: content };
  const yamlBlock = content.slice(3, end).trim();
  const body = content.slice(end + 4).trimStart();
  const fm: Record<string, unknown> = {};
  for (const line of yamlBlock.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (!key) continue;
    if (val.startsWith("[") && val.endsWith("]")) {
      fm[key] = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    } else {
      fm[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return { fm, body };
}

function inferCategory(fileName: string, defaultCategory: string, useFolderAsCategory: boolean): string {
  if (!useFolderAsCategory) return defaultCategory;
  const parts = fileName.replace(/\\/g, "/").split("/");
  if (parts.length > 1) {
    const folder = parts[parts.length - 2].toLowerCase();
    const direct: Record<string, string> = {
      character: "character", characters: "character",
      npc: "npc", npcs: "npc", people: "character",
      location: "location", locations: "location", places: "location",
      faction: "faction", factions: "faction",
      item: "item", items: "item",
      lore: "lore", notes: "lore",
      event: "event", events: "event",
      session: "session", sessions: "session",
      quest: "quest", quests: "quest",
      creature: "creature", creatures: "creature"
    };
    if (direct[folder]) return direct[folder];
  }
  return defaultCategory;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage configured" }, { status: 400 });

  const input = bodySchema.parse(await req.json());
  const results: { slug: string; name: string; created: boolean; error?: string }[] = [];

  for (const file of input.files) {
    const baseName = file.name.replace(/\\/g, "/").split("/").pop()!.replace(/\.md$/i, "");
    const { fm, body } = parseObsidianFrontmatter(file.content);

    const name = (typeof fm.title === "string" && fm.title) ||
                 (typeof fm.name === "string" && fm.name) ||
                 baseName;
    if (!name.trim()) continue;

    const category = (typeof fm.category === "string" && fm.category) ||
                     inferCategory(file.name, input.defaultCategory, input.folderAsCategory);
    const rawTags = Array.isArray(fm.tags) ? fm.tags.map(String) :
                    (typeof fm.tags === "string" ? fm.tags.split(/[,\s]+/).filter(Boolean) : []);
    const summary = (typeof fm.summary === "string" && fm.summary) ||
                    (typeof fm.description === "string" ? fm.description : "");
    const slug = slugify(name) || `obsidian-${Date.now()}`;
    const path = `wiki/pages/${slug}.md`;

    const frontmatter = {
      ...defaultFrontmatter(name, category),
      summary,
      tags: rawTags,
      visibility: input.visibility,
      approvalStatus: input.approvalStatus,
      sourceImport: "obsidian"
    };

    try {
      let existingSha: string | undefined;
      try { const ex = await storage.getTextFile(path); existingSha = ex.sha; } catch { /* new */ }
      await storage.putFile(path, serializePage(frontmatter, body), `CampaignRepo: Obsidian import — ${name}`, existingSha);
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
}

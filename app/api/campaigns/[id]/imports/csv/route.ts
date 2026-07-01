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
  csv: z.string().min(1),
  visibility: z.enum(["gm", "players"]).default("gm"),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved"),
  defaultCategory: z.string().default("npc")
});

/** Minimal RFC4180-ish CSV parser. Handles quoted fields with embedded commas/newlines. */
function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let field = "";
  let inQuote = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuote = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim())) lines.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim())) lines.push(row);

  if (lines.length < 2) return [];
  const headers = lines[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] || "").trim(); });
    return obj;
  });
}

function colAlias(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) if (row[k]) return row[k];
  return "";
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
  const rows = parseCsv(input.csv);
  if (!rows.length) return NextResponse.json({ error: "No rows found. Check the CSV format." }, { status: 400 });

  const results: { slug: string; name: string; created: boolean; error?: string }[] = [];

  for (const row of rows) {
    const name = colAlias(row, "name", "title", "character", "npc");
    if (!name) continue;

    const category = colAlias(row, "category", "type") || input.defaultCategory;
    const summary = colAlias(row, "summary", "description", "bio", "biography");
    const content = colAlias(row, "content", "notes", "body", "text");
    const tagsRaw = colAlias(row, "tags", "tag");
    const tags = tagsRaw ? tagsRaw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [];
    const visibilityRaw = colAlias(row, "visibility");

    const frontmatter = {
      ...defaultFrontmatter(name, category),
      summary: summary || "",
      tags,
      visibility: (visibilityRaw === "players" ? "players" : input.visibility) as "gm" | "players",
      approvalStatus: input.approvalStatus as "approved" | "unapproved" | "rejected",
      sourceImport: "csv"
    };

    const slug = slugify(name) || `imported-${Date.now()}`;
    const path = `wiki/pages/${slug}.md`;
    const pageContent = content || "";

    try {
      let existingSha: string | undefined;
      try {
        const existing = await storage.getTextFile(path);
        existingSha = existing.sha;
      } catch { /* new */ }

      await storage.putFile(path, serializePage(frontmatter, pageContent), `CampaignRepo: CSV import — ${name}`, existingSha);
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

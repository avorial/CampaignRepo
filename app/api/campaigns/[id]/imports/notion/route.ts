import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { defaultFrontmatter } from "@/lib/templates";
import { serializePage } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import { scheduleSearchIndexRebuild } from "@/lib/search";

const bodySchema = z.object({
  files: z.array(z.object({ name: z.string(), content: z.string() })).min(1).max(500),
  defaultCategory: z.string().default("lore"),
  visibility: z.enum(["gm", "players"]).default("gm"),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved")
});

function cleanNotionFilename(fileName: string): string {
  const base = fileName.replace(/\\/g, "/").split("/").pop()!.replace(/\.md$/i, "");
  // Notion appends a short hex ID after the title: "My Page 1a2b3c4d" or "My Page 1a2b3c4d-e5f6-..."
  return base.replace(/\s+[0-9a-f]{8,}$/i, "").trim();
}

function parseNotionMarkdown(content: string): { fm: Record<string, string[]>; body: string } {
  const fm: Record<string, string[]> = {};

  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3);
    if (end !== -1) {
      const yamlBlock = content.slice(3, end).trim();
      const body = content.slice(end + 4).trimStart();
      for (const line of yamlBlock.split("\n")) {
        const colon = line.indexOf(":");
        if (colon === -1) continue;
        const key = line.slice(0, colon).trim().toLowerCase();
        const val = line.slice(colon + 1).trim().replace(/^["']|["']$/g, "");
        if (key && val) fm[key] = [val];
      }
      return { fm, body };
    }
  }

  // Notion sometimes exports properties as leading "Key: value" lines before the page body
  const lines = content.split("\n");
  let bodyStart = 0;
  while (bodyStart < lines.length) {
    const line = lines[bodyStart];
    const m = line.match(/^([A-Za-z][A-Za-z\s]{0,24}):\s+(.+)$/);
    if (m) {
      const key = m[1].trim().toLowerCase();
      const val = m[2].trim();
      fm[key] = val.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
      bodyStart++;
    } else if (line.trim() === "") {
      bodyStart++;
    } else {
      break;
    }
  }
  return { fm, body: lines.slice(bodyStart).join("\n").trimStart() };
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
    const name = cleanNotionFilename(file.name);
    if (!name) continue;

    const { fm, body } = parseNotionMarkdown(file.content);
    const category = fm.category?.[0] || fm.type?.[0] || input.defaultCategory;
    const tags = fm.tags || fm.tag || [];
    const summary = fm.summary?.[0] || fm.description?.[0] || "";
    const slug = slugify(name) || `notion-${Date.now()}`;
    const path = `wiki/pages/${slug}.md`;

    const frontmatter = {
      ...defaultFrontmatter(name, category),
      summary,
      tags,
      visibility: input.visibility,
      approvalStatus: input.approvalStatus,
      sourceImport: "notion"
    };

    try {
      let existingSha: string | undefined;
      try { const ex = await storage.getTextFile(path); existingSha = ex.sha; } catch { /* new */ }
      await storage.putFile(path, serializePage(frontmatter, body), `CampaignRepo: Notion import — ${name}`, existingSha);
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

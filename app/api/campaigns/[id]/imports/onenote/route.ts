import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, isConflictError } from "@/lib/storage";
import { defaultFrontmatter } from "@/lib/templates";
import { serializePage } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import { scheduleSearchIndexRebuild } from "@/lib/search";

export const dynamic = "force-dynamic";

const schema = z.object({
  files: z.array(z.object({ name: z.string(), content: z.string() })).min(1).max(500),
  category: z.string().default("lore"),
  visibility: z.enum(["gm", "players"]).default("gm"),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved"),
  folderAsSection: z.boolean().default(true)
});

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripOneNoteId(name: string) {
  return name
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.(html?|mhtml?|txt)$/i, "")
    .replace(/[_-]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function oneNoteSection(name: string) {
  const parts = name.replace(/\\/g, "/").split("/");
  return parts.length > 1 ? parts[parts.length - 2].replace(/[_-]/g, " ").trim() : "";
}

function extractMhtmlHtml(content: string) {
  const parts = content.split(/\r?\n--[^\r\n]+/);
  const htmlPart = parts.find((part) => /Content-Type:\s*text\/html/i.test(part));
  if (!htmlPart) return content;
  const body = htmlPart.replace(/^[\s\S]*?\r?\n\r?\n/, "");
  if (/Content-Transfer-Encoding:\s*base64/i.test(htmlPart)) {
    try {
      return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf-8");
    } catch {
      return body;
    }
  }
  return body.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/=\r?\n/g, "");
}

function extractTitle(html: string, filename: string): string {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) {
    const title = decodeEntities(titleMatch[1].replace(/<[^>]+>/g, "").trim());
    if (title && !/^OneNote$/i.test(title)) return title;
  }
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match) {
    const title = decodeEntities(h1Match[1].replace(/<[^>]+>/g, "").trim());
    if (title) return title;
  }
  return stripOneNoteId(filename) || "Untitled OneNote Page";
}

function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (bodyMatch ? bodyMatch[1] : html)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+(?:class|style|id|lang|dir|data-[a-z-]+)="[^"]*"/gi, "");
}

function htmlToMarkdown(html: string): string {
  return decodeEntities(html
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, n, text) => `${"#".repeat(Number(n))} ${text.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n\n")
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, "[$2]($1)")
    .replace(/<p[^>]*>(.*?)<\/p>/gis, (_, text) => {
      const cleaned = text.replace(/<[^>]+>/g, "").trim();
      return cleaned ? `${cleaned}\n\n` : "";
    })
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, inner) =>
      inner.replace(/<li[^>]*>(.*?)<\/li>/gis, (_m: string, li: string) => `- ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n")
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, inner) => {
      let n = 0;
      return inner.replace(/<li[^>]*>(.*?)<\/li>/gis, (_m: string, li: string) => `${++n}. ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n";
    })
    .replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, table) => table.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_r: string, row: string) => `| ${row.replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi, (_c: string, cell: string) => `${cell.replace(/<[^>]+>/g, "").trim()} | `).trim()}\n`))
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

function convertOneNoteFile(file: { name: string; content: string }, input: z.infer<typeof schema>) {
  const content = /\.(mhtml?)$/i.test(file.name) ? extractMhtmlHtml(file.content) : file.content;
  const isHtml = /\.(html?|mhtml?)$/i.test(file.name) || /<html|<body|<p[\s>]/i.test(content.slice(0, 1000));
  const title = isHtml ? extractTitle(content, file.name) : stripOneNoteId(file.name);
  const section = input.folderAsSection ? oneNoteSection(file.name) : "";
  const body = isHtml ? htmlToMarkdown(extractBody(content)) : content.trim();
  const finalBody = [
    section ? `> Imported from OneNote section: ${section}` : "",
    body || "(empty OneNote page)"
  ].filter(Boolean).join("\n\n");
  return { title, section, body: finalBody };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Storage not configured" }, { status: 400 });

  const input = schema.parse(await req.json());
  const results: { slug: string; name: string; created: boolean; error?: string }[] = [];
  let created = 0, updated = 0, errors = 0;

  for (const file of input.files) {
    const { title, section, body } = convertOneNoteFile(file, input);
    const slug = slugify(title) || `onenote-${Date.now()}`;
    const path = `wiki/pages/${slug}.md`;
    try {
      let sha: string | undefined;
      try {
        const existing = await storage.getTextFile(path);
        sha = existing.sha;
      } catch {
        // new file
      }
      const frontmatter = {
        ...defaultFrontmatter(title, input.category as import("@/lib/types").Category, input.visibility),
        summary: section ? `Imported from OneNote section: ${section}` : "",
        tags: ["onenote", ...(section ? [slugify(section)] : [])].filter(Boolean),
        approvalStatus: input.approvalStatus,
        sourceImport: "onenote"
      };
      await storage.putFile(path, serializePage(frontmatter, body), `CampaignRepo: ${sha ? "update" : "import"} OneNote page - ${title}`, sha);
      if (sha) updated++; else created++;
      results.push({ slug, name: title, created: !sha });
    } catch (err) {
      errors++;
      const msg = isConflictError(err) ? "Conflict - try again" : (err instanceof Error ? err.message : "Unknown error");
      results.push({ slug, name: title, created: false, error: msg });
    }
  }

  scheduleSearchIndexRebuild(campaign);
  return NextResponse.json({ results, created, updated, errors, total: input.files.length });
}

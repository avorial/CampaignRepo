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
  files: z.array(z.object({ name: z.string(), content: z.string() })).min(1),
  category: z.string().default("lore"),
  visibility: z.enum(["gm", "players"]).default("gm"),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved")
});

function extractTitle(html: string, filename: string): string {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (match) {
    const title = match[1]
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .trim();
    if (title) return title;
  }
  return filename.replace(/\.(html?|txt)$/i, "").replace(/[-_]/g, " ").trim() || "Untitled";
}

function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const raw = bodyMatch ? bodyMatch[1] : html;
  return raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Unwrap Google Docs <span> wrappers but keep their text
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    // Convert links before stripping other attributes
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, "[$2]($1)")
    // Strip remaining inline attributes
    .replace(/\s+(?:class|style|id|dir|data-[a-z-]+)="[^"]*"/gi, "");
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, n, t) => `${"#".repeat(Number(n))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gis, (_, t) => { const txt = t.replace(/<[^>]+>/g, "").trim(); return txt ? `${txt}\n\n` : ""; })
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<u[^>]*>(.*?)<\/u>/gi, "$1")
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, inner) =>
      inner.replace(/<li[^>]*>(.*?)<\/li>/gis, (_m: string, li: string) => `- ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n")
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, inner) => {
      let n = 0;
      return inner.replace(/<li[^>]*>(.*?)<\/li>/gis, (_m: string, li: string) => `${++n}. ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n";
    })
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, t) => `> ${t.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function convertDocument(file: { name: string; content: string }, category: string, visibility: "gm" | "players", approvalStatus: string) {
  const isHtml = /\.(html?)$/i.test(file.name) || /<html/i.test(file.content.slice(0, 200));
  const title = isHtml ? extractTitle(file.content, file.name) : file.name.replace(/\.txt$/i, "").replace(/[-_]/g, " ").trim() || "Untitled";
  const body = isHtml ? htmlToMarkdown(extractBody(file.content)) : file.content;
  return { title, body: body.trim() || "(empty document)", category, visibility, approvalStatus };
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
  const results = [];
  let created = 0, updated = 0, errors = 0;

  for (const file of input.files) {
    const { title, body, category, visibility, approvalStatus } = convertDocument(file, input.category, input.visibility, input.approvalStatus);
    const slug = slugify(title);
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
        ...defaultFrontmatter(title, category as import("@/lib/types").Category, visibility),
        approvalStatus: input.approvalStatus,
      };
      const content = serializePage(frontmatter, body);
      if (sha) {
        await storage.putFile(path, content, `CampaignRepo: update page from Google Docs — ${title}`, sha);
        updated++;
      } else {
        await storage.putFile(path, content, `CampaignRepo: import page from Google Docs — ${title}`);
        created++;
      }
      results.push({ slug, name: title, created: !sha });
    } catch (err) {
      errors++;
      const msg = isConflictError(err) ? "Conflict — try again" : (err instanceof Error ? err.message : "Unknown error");
      results.push({ slug: slugify(title), name: title, created: false, error: msg });
    }
  }

  scheduleSearchIndexRebuild(campaign);
  return NextResponse.json({ results, created, updated, errors, total: input.files.length });
}

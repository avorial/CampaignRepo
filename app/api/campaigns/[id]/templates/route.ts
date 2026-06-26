import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, type StorageAdapter } from "@/lib/storage";
import { parsePage, serializePage } from "@/lib/markdown";
import { categoryIds, defaultFrontmatter, gameTypes, starterBody } from "@/lib/templates";
import { slugify } from "@/lib/slug";
import type { GameType, WikiTemplate } from "@/lib/types";

const createSchema = z.object({
  name: z.string().min(1),
  gameType: z.enum(gameTypes as [string, ...string[]]),
  category: z.enum(categoryIds),
  summary: z.string().optional(),
  tags: z.array(z.string()).default([]),
  content: z.string().optional()
});

type CampaignRow = NonNullable<ReturnType<typeof getCampaign>>;

async function listTemplates(storage: StorageAdapter, campaign: CampaignRow) {
  const rootEntries = await storage.listDirectory("wiki/templates");
  const gameDirs = rootEntries.filter((entry) => entry.type === "dir");
  const templates: WikiTemplate[] = [];
  for (const dir of gameDirs) {
    const entries = await storage.listDirectory(dir.path);
    for (const entry of entries.filter((item) => item.type === "file" && item.name.endsWith(".md"))) {
      const file = await storage.getTextFile(entry.path);
      const slug = entry.name.replace(/\.md$/, "");
      const page = parsePage(slug, file.text, file.sha);
      templates.push({ slug, path: entry.path, sha: file.sha, gameType: dir.name as GameType, category: page.frontmatter.category, name: page.frontmatter.name, summary: page.frontmatter.summary, content: page.content });
    }
  }
  return templates.sort((a, b) => `${a.gameType}:${a.category}:${a.name}`.localeCompare(`${b.gameType}:${b.category}:${b.name}`));
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ templates: await listTemplates(storage, campaign) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = createSchema.parse(await req.json());
  const slug = slugify(input.name);
  const frontmatter = { ...defaultFrontmatter(input.name, input.category, "gm"), summary: input.summary || "", tags: input.tags.length ? input.tags : ["template", input.category] };
  const content = input.content?.trim() || starterBody(input.name, input.category, input.gameType as GameType);
  const path = `wiki/templates/${input.gameType}/${slug}.md`;
  await storage.putFile(path, serializePage(frontmatter, content), `CampaignRepo: create ${input.gameType} template ${input.name}`);
  return NextResponse.json({ template: { slug, path, gameType: input.gameType, category: input.category, name: input.name, summary: frontmatter.summary, content } });
}

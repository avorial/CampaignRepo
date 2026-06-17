import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign, getDb } from "@/lib/db";
import { putFile } from "@/lib/github";
import { defaultFrontmatter } from "@/lib/templates";
import { serializePage } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import { rebuildSearchIndex } from "@/lib/search";

const schema = z.object({
  source: z.enum(["foundry", "generic"]),
  sourceJson: z.record(z.any()),
  mapping: z
    .object({
      name: z.string().optional(),
      biography: z.string().optional(),
      items: z.string().optional(),
      category: z.string().optional(),
      summary: z.string().optional(),
      tags: z.string().optional()
    })
    .optional(),
  visibility: z.enum(["gm", "players"]),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"])
});

function getByPath(source: any, path: string) {
  if (!path.trim()) return undefined;
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function mappedValue(source: any, path?: string) {
  return path ? getByPath(source, path) : undefined;
}

function importName(source: any, mapping?: z.infer<typeof schema>["mapping"]) {
  return String(mappedValue(source, mapping?.name) || source.name || source.actor?.name || source.prototypeToken?.name || "Imported Character");
}

function importCategory(source: any, mapping?: z.infer<typeof schema>["mapping"]) {
  const category = String(mappedValue(source, mapping?.category) || source.type || "").toLowerCase();
  return category === "character" ? "character" : "npc";
}

function importTags(source: any, mapping?: z.infer<typeof schema>["mapping"]) {
  const value = mappedValue(source, mapping?.tags);
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function importBody(source: any, sourceName: string, mapping?: z.infer<typeof schema>["mapping"]) {
  const biography =
    mappedValue(source, mapping?.biography) ||
    getByPath(source, "system.biography.value") ||
    getByPath(source, "system.details.biography.value") ||
    source.description ||
    "";
  const itemSource = mappedValue(source, mapping?.items) || source.items;
  const items = Array.isArray(itemSource)
    ? itemSource.map((item: any) => `- ${item.name || item.label || item.type || String(item) || "Item"}`).join("\n")
    : "";
  return `# ${sourceName}

## Imported Summary

${biography || "Imported from JSON. Review and expand this page."}

## Items

${items}

:::gm
Source JSON is preserved for audit and re-import.
:::
`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = schema.parse(await req.json());
  const name = importName(input.sourceJson, input.mapping);
  const slug = slugify(name);
  const sourceId = String(input.sourceJson._id || input.sourceJson.id || slug);
  const sourcePath = `wiki/imports/characters/${input.source}/${sourceId}.json`;
  const frontmatter = {
    ...defaultFrontmatter(name, importCategory(input.sourceJson, input.mapping), input.visibility),
    approvalStatus: input.approvalStatus,
    summary: String(mappedValue(input.sourceJson, input.mapping?.summary) || ""),
    tags: importTags(input.sourceJson, input.mapping),
    sourceImport: sourcePath,
    foundryLink: input.source === "foundry" ? input.sourceJson.uuid || input.sourceJson._id : undefined
  };
  await putFile(user.githubToken, campaign, sourcePath, JSON.stringify(input.sourceJson, null, 2) + "\n", `CampaignRepo: import source JSON for ${name}`);
  await putFile(user.githubToken, campaign, `wiki/pages/${slug}.md`, serializePage(frontmatter, importBody(input.sourceJson, name, input.mapping)), `CampaignRepo: import character ${name}`);
  getDb().prepare("INSERT INTO imports (campaignId, source, sourceId, pageSlug) VALUES (?, ?, ?, ?)").run(campaign.id, input.source, sourceId, slug);
  await rebuildSearchIndex(user.githubToken, campaign);
  return NextResponse.json({ slug });
}

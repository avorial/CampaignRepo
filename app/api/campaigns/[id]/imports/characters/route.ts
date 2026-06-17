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
  visibility: z.enum(["gm", "players"]),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"])
});

function getByPath(source: any, path: string) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function importName(source: any) {
  return String(source.name || source.actor?.name || source.prototypeToken?.name || "Imported Character");
}

function importBody(source: any, sourceName: string) {
  const biography = getByPath(source, "system.biography.value") || getByPath(source, "system.details.biography.value") || source.description || "";
  const items = Array.isArray(source.items) ? source.items.map((item: any) => `- ${item.name || item.type || "Item"}`).join("\n") : "";
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
  const name = importName(input.sourceJson);
  const slug = slugify(name);
  const sourceId = String(input.sourceJson._id || input.sourceJson.id || slug);
  const sourcePath = `wiki/imports/characters/${input.source}/${sourceId}.json`;
  const frontmatter = {
    ...defaultFrontmatter(name, input.sourceJson.type === "character" ? "character" : "npc", input.visibility),
    approvalStatus: input.approvalStatus,
    sourceImport: sourcePath,
    foundryLink: input.source === "foundry" ? input.sourceJson.uuid || input.sourceJson._id : undefined
  };
  await putFile(user.githubToken, campaign, sourcePath, JSON.stringify(input.sourceJson, null, 2) + "\n", `CampaignRepo: import source JSON for ${name}`);
  await putFile(user.githubToken, campaign, `wiki/pages/${slug}.md`, serializePage(frontmatter, importBody(input.sourceJson, name)), `CampaignRepo: import character ${name}`);
  getDb().prepare("INSERT INTO imports (campaignId, source, sourceId, pageSlug) VALUES (?, ?, ?, ?)").run(campaign.id, input.source, sourceId, slug);
  await rebuildSearchIndex(user.githubToken, campaign);
  return NextResponse.json({ slug });
}

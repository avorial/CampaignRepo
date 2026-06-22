import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { deleteFile, getContent, getTextFile, GitHubError, listDirectory, putFile } from "@/lib/github";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const pinSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  pageSlug: z.string().optional().default(""),
  label: z.string().optional().default("")
});

const upsertSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  image: z.string().min(1),
  pins: z.array(pinSchema).default([])
});

const deleteSchema = z.object({ slug: z.string().min(1) });

async function loadMaps(token: string, campaign: NonNullable<ReturnType<typeof getCampaign>>) {
  const entries = await listDirectory(token, campaign, "wiki/maps");
  const maps = await Promise.all(
    entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const file = await getTextFile(token, campaign, entry.path);
        const data = JSON.parse(file.text || "{}");
        return { slug: entry.name.replace(/\.json$/, ""), name: data.name || entry.name, image: data.image || "", pins: Array.isArray(data.pins) ? data.pins : [], sha: file.sha };
      })
  );
  return maps.sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ maps: await loadMaps(user.githubToken, campaign) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = upsertSchema.parse(await req.json());
  const slug = input.slug || slugify(input.name);
  const path = `wiki/maps/${slug}.json`;
  let sha: string | undefined;
  try {
    sha = (await getContent(user.githubToken, campaign, path)).sha;
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) throw error;
  }
  const body = JSON.stringify({ name: input.name, image: input.image, pins: input.pins }, null, 2) + "\n";
  await putFile(user.githubToken, campaign, path, body, `CampaignRepo: save map ${input.name}`, sha);
  return NextResponse.json({ maps: await loadMaps(user.githubToken, campaign) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { slug } = deleteSchema.parse(await req.json());
  const path = `wiki/maps/${slug}.json`;
  try {
    const current = await getContent(user.githubToken, campaign, path);
    await deleteFile(user.githubToken, campaign, path, `CampaignRepo: delete map ${slug}`, current.sha);
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) throw error;
  }
  return NextResponse.json({ maps: await loadMaps(user.githubToken, campaign) });
}

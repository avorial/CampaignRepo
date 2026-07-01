import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError, type StorageAdapter } from "@/lib/storage";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const pinSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  label: z.string().optional().default(""),
  pageSlug: z.string().optional().default(""),
  mapSlug: z.string().optional().default(""),
  layer: z.string().optional().default("default"),
  icon: z.string().optional().default("📍"),
  discovered: z.boolean().optional().default(false)
});

const layerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  visibility: z.enum(["gm", "players"]).default("players")
});

const upsertSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  image: z.string().min(1),
  pins: z.array(pinSchema).default([]),
  layers: z.array(layerSchema).optional()
});

const deleteSchema = z.object({ slug: z.string().min(1) });

async function loadMaps(storage: StorageAdapter) {
  const entries = await storage.listDirectory("wiki/maps");
  const maps = await Promise.all(
    entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const file = await storage.getTextFile(entry.path);
        const data = JSON.parse(file.text || "{}");
        return { slug: entry.name.replace(/\.json$/, ""), name: data.name || entry.name, image: data.image || "", pins: Array.isArray(data.pins) ? data.pins : [], layers: Array.isArray(data.layers) ? data.layers : undefined, sha: file.sha };
      })
  );
  return maps.sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ maps: await loadMaps(storage) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = upsertSchema.parse(await req.json());
  const slug = input.slug || slugify(input.name);
  const path = `wiki/maps/${slug}.json`;
  let sha: string | undefined;
  try {
    sha = (await storage.getContent(path)).sha;
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }
  const body = JSON.stringify({ name: input.name, image: input.image, pins: input.pins, layers: input.layers }, null, 2) + "\n";
  await storage.putFile(path, body, `CampaignRepo: save map ${input.name}`, sha);
  return NextResponse.json({ maps: await loadMaps(storage) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { slug } = deleteSchema.parse(await req.json());
  const path = `wiki/maps/${slug}.json`;
  try {
    const current = await storage.getContent(path);
    await storage.deleteFile(path, `CampaignRepo: delete map ${slug}`, current.sha);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }
  return NextResponse.json({ maps: await loadMaps(storage) });
}

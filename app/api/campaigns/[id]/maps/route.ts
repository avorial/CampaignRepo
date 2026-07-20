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
  discovered: z.boolean().optional().default(false),
  image: z.string().optional().default("")
});

const layerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  visibility: z.enum(["gm", "players"]).default("players")
});

const regionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  label: z.string().optional().default(""),
  layer: z.string().optional().default("default"),
  color: z.string().optional().default("#4a90d9")
});

const routeSchema = z.object({
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0),
  label: z.string().optional().default(""),
  style: z.enum(["road", "river", "path", "wall"]).optional().default("road"),
  layer: z.string().optional().default("default")
});

const journeySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(z.number().int().min(0)).default([])
});

const scaleSchema = z.object({
  total: z.number().positive(),
  unit: z.string().min(1)
});

const upsertSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  image: z.string().min(1),
  pins: z.array(pinSchema).default([]),
  layers: z.array(layerSchema).optional(),
  regions: z.array(regionSchema).optional(),
  routes: z.array(routeSchema).optional(),
  journeys: z.array(journeySchema).optional(),
  scale: scaleSchema.optional()
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
        return {
          slug: entry.name.replace(/\.json$/, ""),
          name: data.name || entry.name,
          image: data.image || "",
          pins: Array.isArray(data.pins) ? data.pins : [],
          layers: Array.isArray(data.layers) ? data.layers : undefined,
          regions: Array.isArray(data.regions) ? data.regions : undefined,
          routes: Array.isArray(data.routes) ? data.routes : undefined,
          journeys: Array.isArray(data.journeys) ? data.journeys : undefined,
          scale: data.scale && typeof data.scale === "object" ? data.scale : undefined,
          sha: file.sha
        };
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
  const slug = input.slug || slugify(input.name) || "map";
  const path = `wiki/maps/${slug}.json`;
  let sha: string | undefined;
  try {
    sha = (await storage.getContent(path)).sha;
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }
  const body = JSON.stringify({
    name: input.name,
    image: input.image,
    pins: input.pins,
    layers: input.layers,
    regions: input.regions,
    routes: input.routes,
    journeys: input.journeys,
    scale: input.scale
  }, null, 2) + "\n";
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

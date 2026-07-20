import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError, type StorageAdapter } from "@/lib/storage";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["page", "note"]),
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
  pageSlug: z.string().optional(),
  text: z.string().optional(),
  color: z.string().optional()
});

const edgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional()
});

const upsertSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([])
});

const deleteSchema = z.object({ slug: z.string().min(1) });

async function loadBoards(storage: StorageAdapter) {
  try {
    const entries = await storage.listDirectory("wiki/boards");
    const boards = await Promise.all(
      entries
        .filter((e) => e.type === "file" && e.name.endsWith(".json"))
        .map(async (e) => {
          const file = await storage.getTextFile(e.path);
          const data = JSON.parse(file.text || "{}");
          return {
            slug: e.name.replace(/\.json$/, ""),
            name: data.name || e.name,
            nodes: Array.isArray(data.nodes) ? data.nodes : [],
            edges: Array.isArray(data.edges) ? data.edges : [],
            sha: file.sha
          };
        })
    );
    return boards.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    if (isNotFoundError(err)) return [];
    throw err;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ boards: await loadBoards(storage) });
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
  const slug = input.slug || slugify(input.name) || "board";
  const path = `wiki/boards/${slug}.json`;
  let sha: string | undefined;
  try { sha = (await storage.getContent(path)).sha; } catch (err) { if (!isNotFoundError(err)) throw err; }
  const body = JSON.stringify({ name: input.name, nodes: input.nodes, edges: input.edges }, null, 2) + "\n";
  await storage.putFile(path, body, `CampaignRepo: save board ${input.name}`, sha);
  return NextResponse.json({ boards: await loadBoards(storage) });
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
  const path = `wiki/boards/${slug}.json`;
  try {
    const current = await storage.getContent(path);
    await storage.deleteFile(path, `CampaignRepo: delete board ${slug}`, current.sha);
  } catch (err) { if (!isNotFoundError(err)) throw err; }
  return NextResponse.json({ boards: await loadBoards(storage) });
}

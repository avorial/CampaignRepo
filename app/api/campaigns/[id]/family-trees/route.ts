import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import type { CampaignFamilyTree } from "@/lib/types";

export const dynamic = "force-dynamic";

function slugifyTreeId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "family-tree";
}

function cleanId(value: unknown, fallback: string) {
  const raw = typeof value === "string" ? value : fallback;
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function normalizeImagePath(campaignId: number, image?: unknown) {
  if (typeof image !== "string") return undefined;
  const value = image.trim();
  if (!value) return undefined;
  const servedPrefix = `/campaign-media/${campaignId}/`;
  if (value.startsWith(servedPrefix)) return `wiki/media/${value.slice(servedPrefix.length)}`;
  return value;
}

function normalizeTree(campaignId: number, raw: unknown, fallbackId: string): CampaignFamilyTree {
  const input = (raw || {}) as Partial<CampaignFamilyTree>;
  const id = cleanId(input.id, fallbackId);
  const name = String(input.name || id).trim() || id;
  const seenNodes = new Set<string>();
  const nodes = (Array.isArray(input.nodes) ? input.nodes : []).flatMap((node, index) => {
    const source = node as CampaignFamilyTree["nodes"][number];
    const nodeId = cleanId(source?.id, `person-${index + 1}`);
    if (seenNodes.has(nodeId)) return [];
    seenNodes.add(nodeId);
    return [{
      id: nodeId,
      name: String(source?.name || "Unnamed person").trim() || "Unnamed person",
      pageSlug: typeof source?.pageSlug === "string" && source.pageSlug.trim() ? source.pageSlug.trim() : undefined,
      image: normalizeImagePath(campaignId, source?.image),
      category: source?.category || "character"
    }];
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenEdges = new Set<string>();
  const edges = (Array.isArray(input.edges) ? input.edges : []).flatMap((edge) => {
    const source = cleanId(edge?.source, "");
    const target = cleanId(edge?.target, "");
    const type = String(edge?.type || "related-to").trim() || "related-to";
    if (!source || !target || source === target || !nodeIds.has(source) || !nodeIds.has(target)) return [];
    const key = `${source}\0${target}\0${type}`;
    if (seenEdges.has(key)) return [];
    seenEdges.add(key);
    return [{ source, target, type, label: edge?.label }];
  });
  return { id, name, source: input.source, nodes, edges };
}

async function getTreePath(storage: NonNullable<ReturnType<typeof getStorageAdapter>>, treeId: string) {
  const files = await storage.listDirectoryTextFiles("wiki/family-trees", ".json").catch(() => []);
  const existing = files.find((file) => file.name.replace(/\.json$/i, "") === treeId);
  return {
    path: existing?.path || `wiki/family-trees/${treeId}.json`,
    sha: existing?.sha
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaignId = Number(id);
  if (!canManageCampaign(user.id, campaignId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const campaign = getCampaign(user.id, campaignId);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Storage is not configured." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Family Tree";
  const baseId = slugifyTreeId(name);
  const files = await storage.listDirectoryTextFiles("wiki/family-trees", ".json").catch(() => []);
  const used = new Set(files.map((file) => file.name.replace(/\.json$/i, "")));
  let treeId = baseId;
  let suffix = 2;
  while (used.has(treeId)) treeId = `${baseId}-${suffix++}`;
  const tree: CampaignFamilyTree = { id: treeId, name, source: `wiki/family-trees/${treeId}.json`, nodes: [], edges: [] };
  await storage.putFile(`wiki/family-trees/${treeId}.json`, `${JSON.stringify(tree, null, 2)}\n`, `Create family tree ${name}`);
  return NextResponse.json({ tree });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaignId = Number(id);
  if (!canManageCampaign(user.id, campaignId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const campaign = getCampaign(user.id, campaignId);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Storage is not configured." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const tree = normalizeTree(campaignId, body.tree, cleanId(body.treeId, "family-tree"));
  const target = await getTreePath(storage, tree.id);
  const source = tree.source || target.path;
  const content = `${JSON.stringify({ ...tree, source }, null, 2)}\n`;
  await storage.putFile(target.path, content, `Update family tree ${tree.name}`, target.sha);
  return NextResponse.json({ tree: { ...tree, source } });
}

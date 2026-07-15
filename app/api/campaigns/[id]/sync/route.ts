import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { countDirtyPages, flushCampaignSync, listPageConflicts, resolvePageConflict } from "@/lib/sync-queue";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(_);
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({
    dirtyPages: countDirtyPages(campaign.id),
    conflicts: listPageConflicts(campaign.id).map((conflict) => ({ slug: conflict.slug, createdAt: conflict.createdAt }))
  });
}

/** Sync Now: flush every dirty page in one commit. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await flushCampaignSync(storage, campaign);
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}

const resolveSchema = z.object({
  slug: z.string().min(1),
  resolution: z.enum(["local", "remote"])
});

/** Resolve a recorded page conflict: keep the local edit or adopt the remote version. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = resolveSchema.parse(await req.json());
  const result = await resolvePageConflict(storage, campaign, input.slug, input.resolution);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

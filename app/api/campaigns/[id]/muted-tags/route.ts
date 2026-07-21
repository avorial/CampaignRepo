import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { loadMutedTags, saveMutedTags, MAX_MUTED_TAGS } from "@/lib/muted-tags";

export const dynamic = "force-dynamic";

const putSchema = z.object({ tags: z.array(z.string()).max(MAX_MUTED_TAGS) });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ mutedTags: await loadMutedTags(campaign, user.githubToken) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = putSchema.parse(await req.json());
  const mutedTags = await saveMutedTags(campaign, input.tags, user.githubToken);
  return NextResponse.json({ mutedTags });
}

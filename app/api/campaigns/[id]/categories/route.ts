import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { loadCampaignCategories, sanitizeCampaignCategories, saveCampaignCategories } from "@/lib/categories";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ categories: await loadCampaignCategories(campaign, user.githubToken) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const categories = await saveCampaignCategories(campaign, sanitizeCampaignCategories(body.categories), user.githubToken);
    return NextResponse.json({ categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save categories.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign, getPublicSite, publishCampaign, rotatePublicSlug, unpublishCampaign } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ site: getPublicSite(campaign.id) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "publish";
    const slug = typeof body.slug === "string" ? body.slug : undefined;
    const site = action === "rotate" ? rotatePublicSlug(user.id, campaign.id, slug) : publishCampaign(user.id, campaign.id, slug);
    return NextResponse.json({ site });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not publish." }, { status: 403 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    unpublishCampaign(user.id, campaign.id);
    return NextResponse.json({ site: getPublicSite(campaign.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not unpublish." }, { status: 403 });
  }
}

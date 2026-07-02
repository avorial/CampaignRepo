import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign, createPageShare, listPageShares, revokePageShare } from "@/lib/db";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; slug: string }> };

export async function GET(_: Request, { params }: Params) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ shares: listPageShares(user.id, campaign.id, slug) });
}

export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : null;
  const share = createPageShare(user.id, campaign.id, slug, expiresAt);
  return NextResponse.json({ share });
}

export async function DELETE(req: Request, { params }: Params) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : null;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  try {
    revokePageShare(user.id, token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 403 });
  }
}

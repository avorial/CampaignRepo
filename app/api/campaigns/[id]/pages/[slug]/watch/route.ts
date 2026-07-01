import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign, isWatchingPage, togglePageWatch } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ watching: isWatchingPage(user.id, campaign.id, slug) });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const watching = togglePageWatch(user.id, campaign.id, slug);
  return NextResponse.json({ watching });
}

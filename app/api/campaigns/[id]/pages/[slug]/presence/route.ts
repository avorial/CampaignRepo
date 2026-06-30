import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { heartbeat, getEditors, clearEditor } from "@/lib/presence";

async function guard(userId: number, campaignId: number) {
  const campaign = getCampaign(userId, campaignId);
  return campaign || null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = await guard(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const editors = getEditors(campaign.id, slug).filter((e) => e.userId !== user.id);
  return NextResponse.json({ editors });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = await guard(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({})) as { editing?: boolean };
  if (body.editing === false) {
    clearEditor(campaign.id, slug, user.id);
  } else {
    heartbeat(campaign.id, slug, user.id, user.name || user.email);
  }
  const others = getEditors(campaign.id, slug).filter((e) => e.userId !== user.id);
  return NextResponse.json({ editors: others });
}

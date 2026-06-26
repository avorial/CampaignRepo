import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { formatDate, loadCampaignCalendar, saveCampaignCalendar, sanitizeCalendar } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const calendar = await loadCampaignCalendar(campaign, user.githubToken);
  return NextResponse.json({ calendar, formatted: formatDate(calendar, calendar.currentDate), canManage: canManageCampaign(user.id, campaign.id) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ calendar: await saveCampaignCalendar(campaign, sanitizeCalendar(body.calendar), user.githubToken) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save calendar.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

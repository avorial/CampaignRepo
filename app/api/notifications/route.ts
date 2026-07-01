import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listNotifications, markAllNotificationsRead, countUnreadNotifications } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const campaignId = url.searchParams.has("campaignId") ? Number(url.searchParams.get("campaignId")) : undefined;
  const notifications = listNotifications(user.id);
  const unread = countUnreadNotifications(user.id);
  return NextResponse.json({ notifications, unread });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json().catch(() => ({})) as { campaignId?: number; markAllRead?: boolean };
  if (body.markAllRead) {
    markAllNotificationsRead(user.id, body.campaignId);
  }
  const unread = countUnreadNotifications(user.id);
  return NextResponse.json({ ok: true, unread });
}

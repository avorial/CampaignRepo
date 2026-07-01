import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { markNotificationRead } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  markNotificationRead(user.id, Number(id));
  return NextResponse.json({ ok: true });
}

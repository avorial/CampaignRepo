import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ user });
}

import { NextResponse } from "next/server";
import { configuredLoginProviders } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ providers: configuredLoginProviders() });
}

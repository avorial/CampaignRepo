import { NextResponse } from "next/server";
import { configuredLoginProviders } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    providers: configuredLoginProviders(),
    // Registration is invite-only unless the operator opts into open sign-up.
    openRegistration: process.env.ALLOW_OPEN_REGISTRATION === "1"
  });
}

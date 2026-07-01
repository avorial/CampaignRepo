import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { githubAppInstallUrl, isGitHubAppConfigured } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireUser();
  if (!isGitHubAppConfigured()) {
    return NextResponse.json({ error: "GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_SLUG, and GITHUB_APP_PRIVATE_KEY." }, { status: 400 });
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const url = githubAppInstallUrl(state);
  if (!url) return NextResponse.json({ error: "GitHub App is not configured." }, { status: 400 });

  const response = NextResponse.redirect(url);
  response.cookies.set("github_app_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
    secure: process.env.SECURE_COOKIES === "true"
  });
  return response;
}

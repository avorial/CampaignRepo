import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { setAppSettings } from "@/lib/db";
import { convertGitHubAppManifest } from "@/lib/github";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user.isAdmin) return NextResponse.json({ error: "Only global admins can create the CampaignRepo GitHub App." }, { status: 403 });

  const url = new URL(req.url);
  const state = url.searchParams.get("state") || "";
  const expectedState = req.cookies.get("github_manifest_state")?.value || "";
  const code = url.searchParams.get("code") || "";

  if (!expectedState || state !== expectedState) {
    return NextResponse.json({ error: "GitHub App manifest state did not match. Please try again." }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "GitHub did not return a manifest code." }, { status: 400 });
  }

  const app = await convertGitHubAppManifest(code);
  setAppSettings({
    github_app_id: String(app.id),
    github_app_slug: app.slug,
    github_app_private_key: app.pem,
    github_app_webhook_secret: app.webhook_secret
  });

  const response = NextResponse.redirect(new URL("/api/github/app/start", req.url));
  response.cookies.delete("github_manifest_state");
  return response;
}

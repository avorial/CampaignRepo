import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { setAppSettings } from "@/lib/db";
import { convertGitHubAppManifest } from "@/lib/github";
import { publicUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function errorPage(title: string, detail: string, status = 400) {
  return new NextResponse(
    `<!doctype html>
<html>
  <head>
    <title>${escapeHtml(title)}</title>
    <style>
      body { background: #08050f; color: #f7ecd7; font: 16px system-ui, sans-serif; padding: 48px; }
      main { max-width: 760px; margin: 0 auto; }
      p { color: #c4b6e7; line-height: 1.5; }
      code { background: #1a1029; border-radius: 6px; color: #e0b957; padding: 3px 6px; }
      a { color: #e0b957; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(detail)}</p>
      <p><a href="/dashboard">Back to dashboard</a></p>
    </main>
  </body>
</html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return errorPage("Sign in again", "GitHub returned to CampaignRepo, but your CampaignRepo session was not available. Sign in and start Connect GitHub again.", 401);
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

  try {
    const app = await convertGitHubAppManifest(code);
    setAppSettings({
      github_app_id: String(app.id),
      github_app_slug: app.slug,
      github_app_private_key: app.pem,
      github_app_webhook_secret: app.webhook_secret || ""
    });
  } catch (error) {
    return errorPage("GitHub App setup failed", error instanceof Error ? error.message : "CampaignRepo could not finish GitHub App setup.", 500);
  }

  const response = NextResponse.redirect(publicUrl(req, "/api/github/app/start"));
  response.cookies.delete("github_manifest_state");
  return response;
}

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user.isAdmin) return NextResponse.json({ error: "Only global admins can create the CampaignRepo GitHub App." }, { status: 403 });

  const origin = new URL(req.url).origin;
  const state = crypto.randomBytes(24).toString("base64url");
  const manifest = {
    name: "CampaignRepo",
    url: origin,
    redirect_url: `${origin}/api/github/app/manifest/callback`,
    callback_urls: [`${origin}/api/github/app/callback`],
    setup_url: `${origin}/api/github/app/callback`,
    hook_attributes: { active: false },
    public: false,
    default_permissions: {
      contents: "write",
      metadata: "read"
    },
    default_events: []
  };

  const html = `<!doctype html>
<html>
  <head><title>Connect GitHub</title></head>
  <body>
    <form id="manifest" action="https://github.com/settings/apps/new" method="post">
      <input type="hidden" name="state" value="${escapeHtml(state)}" />
      <input type="hidden" name="manifest" value="${escapeHtml(JSON.stringify(manifest))}" />
      <button type="submit">Continue to GitHub</button>
    </form>
    <script>document.getElementById("manifest").submit();</script>
  </body>
</html>`;

  const response = new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  response.cookies.set("github_manifest_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
    secure: process.env.SECURE_COOKIES === "true"
  });
  return response;
}

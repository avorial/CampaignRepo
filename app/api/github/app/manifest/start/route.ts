import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isInternalOrigin, publicOrigin } from "@/lib/url";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user.isAdmin) return NextResponse.json({ error: "Only global admins can create the CampaignRepo GitHub App." }, { status: 403 });

  const origin = publicOrigin(req);
  const internalOrigin = isInternalOrigin(origin);
  const host = new URL(origin).hostname;
  const state = crypto.randomBytes(24).toString("base64url");
  const manifest = {
    name: `CampaignRepo ${host}`,
    url: origin,
    redirect_url: `${origin}/api/github/app/manifest/callback`,
    callback_urls: [`${origin}/api/github/app/callback`],
    setup_url: `${origin}/api/github/app/callback`,
    public: false,
    default_permissions: {
      contents: "write",
      metadata: "read"
    },
    default_events: []
  };

  const html = `<!doctype html>
<html>
  <head>
    <title>Connect GitHub</title>
    <style>
      body { background: #08050f; color: #f7ecd7; font: 16px system-ui, sans-serif; padding: 48px; }
      main { max-width: 680px; margin: 0 auto; }
      code { background: #1a1029; border-radius: 6px; color: #e0b957; padding: 3px 6px; }
      button { background: #d8b157; border: 0; border-radius: 8px; color: #160d20; cursor: pointer; font-weight: 800; padding: 14px 18px; text-transform: uppercase; }
      p { color: #c4b6e7; line-height: 1.5; }
      .warning { border: 1px solid #d05a5a; border-radius: 8px; color: #ffd7d7; padding: 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Connect CampaignRepo to GitHub</h1>
      ${internalOrigin ? `<p class="warning">CampaignRepo sees its public URL as <code>${escapeHtml(origin)}</code>. Set <code>APP_URL=https://campaignrepo.avorial.com</code> in Portainer before continuing.</p>` : ""}
      <p>This will create a GitHub App for <code>${escapeHtml(origin)}</code> with contents read/write access on only the repos you choose.</p>
      <form action="https://github.com/settings/apps/new" method="post">
        <input type="hidden" name="state" value="${escapeHtml(state)}" />
        <input type="hidden" name="manifest" value="${escapeHtml(JSON.stringify(manifest))}" />
        <button type="submit" ${internalOrigin ? "disabled" : ""}>Continue to GitHub</button>
      </form>
    </main>
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

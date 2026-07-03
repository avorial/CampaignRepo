import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { configuredLoginProviders, oauthCallbackUrl, redirectWithOAuthState, type LoginOAuthProvider } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function isProvider(value: string): value is LoginOAuthProvider {
  return value === "google" || value === "github";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown OAuth provider." }, { status: 404 });
  const configured = configuredLoginProviders();
  if (!configured[provider]) return NextResponse.json({ error: `${provider} login is not configured.` }, { status: 400 });

  const next = req.nextUrl.searchParams.get("next");
  if (provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set("redirect_uri", oauthCallbackUrl(req, "google"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("prompt", "select_account");
    return redirectWithOAuthState(req, "google", url.toString(), next);
  }

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_OAUTH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", oauthCallbackUrl(req, "github"));
  url.searchParams.set("scope", "read:user user:email repo");
  url.searchParams.set("allow_signup", "true");
  return redirectWithOAuthState(req, "github", url.toString(), next);
}

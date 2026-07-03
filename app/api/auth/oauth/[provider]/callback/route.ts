import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { upsertOAuthUser } from "@/lib/db";
import {
  configuredLoginProviders,
  oauthCallbackUrl,
  redirectOAuthError,
  safeNextPath,
  verifyOAuthState,
  type LoginOAuthProvider
} from "@/lib/oauth";
import { publicUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

function isProvider(value: string): value is LoginOAuthProvider {
  return value === "google" || value === "github";
}

async function postForm<T>(url: string, body: Record<string, string>, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...(headers || {}) },
    body: new URLSearchParams(body),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error_description || data.error || "OAuth token exchange failed.");
  return data as T;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as any).message || "OAuth profile request failed.");
  return data as T;
}

async function googleUser(req: NextRequest, code: string) {
  const token = await postForm<{ access_token: string }>("https://oauth2.googleapis.com/token", {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: oauthCallbackUrl(req, "google"),
    grant_type: "authorization_code"
  });
  const profile = await fetchJson<{ sub: string; email: string; email_verified: boolean; name?: string; picture?: string }>(
    "https://openidconnect.googleapis.com/v1/userinfo",
    token.access_token
  );
  if (!profile.email_verified) throw new Error("Google email is not verified.");
  return upsertOAuthUser({
    provider: "google",
    providerId: profile.sub,
    email: profile.email,
    name: profile.name || profile.email,
    avatarUrl: profile.picture || null
  });
}

async function githubUser(req: NextRequest, code: string) {
  const token = await postForm<{ access_token: string }>("https://github.com/login/oauth/access_token", {
    code,
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID!,
    client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET!,
    redirect_uri: oauthCallbackUrl(req, "github")
  });
  const profile = await fetchJson<{ id: number; login: string; name?: string | null; email?: string | null; avatar_url?: string | null }>(
    "https://api.github.com/user",
    token.access_token
  );
  const emails = await fetchJson<Array<{ email: string; primary: boolean; verified: boolean }>>(
    "https://api.github.com/user/emails",
    token.access_token
  );
  const email = emails.find((item) => item.primary && item.verified)?.email || emails.find((item) => item.verified)?.email || profile.email;
  if (!email) throw new Error("GitHub did not return a verified email address.");
  return upsertOAuthUser({
    provider: "github",
    providerId: String(profile.id),
    email,
    name: profile.name || profile.login || email,
    avatarUrl: profile.avatar_url || null,
    githubToken: token.access_token
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Unknown OAuth provider." }, { status: 404 });
  if (!configuredLoginProviders()[provider]) return redirectOAuthError(req, `${provider} login is not configured.`);

  let state: { next: string; cookieName: string };
  try {
    state = verifyOAuthState(req, provider);
  } catch (error) {
    return redirectOAuthError(req, error instanceof Error ? error.message : "OAuth state failed.");
  }

  try {
    const oauthError = req.nextUrl.searchParams.get("error");
    if (oauthError) throw new Error(oauthError);
    const code = req.nextUrl.searchParams.get("code");
    if (!code) throw new Error("OAuth callback did not include a code.");
    const user = provider === "google" ? await googleUser(req, code) : await githubUser(req, code);
    await createSession(user.id);
    const destination = publicUrl(req, user.mustChangePassword ? "/change-password" : safeNextPath(state.next));
    const response = NextResponse.redirect(destination);
    response.cookies.delete(state.cookieName);
    return response;
  } catch (error) {
    const response = redirectOAuthError(req, error instanceof Error ? error.message : "OAuth login failed.");
    response.cookies.delete(state.cookieName);
    return response;
  }
}

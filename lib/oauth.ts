import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { publicUrl } from "@/lib/url";

export type LoginOAuthProvider = "google" | "github";

const stateCookie = (provider: LoginOAuthProvider) => `campaignrepo_oauth_${provider}`;

export function configuredLoginProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET)
  };
}

export function oauthCallbackUrl(req: NextRequest, provider: LoginOAuthProvider) {
  return publicUrl(req, `/api/auth/oauth/${provider}/callback`).toString();
}

export function safeNextPath(value?: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function redirectWithOAuthState(req: NextRequest, provider: LoginOAuthProvider, authorizeUrl: string, next?: string | null) {
  const state = crypto.randomBytes(24).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ state, next: safeNextPath(next) }), "utf8").toString("base64url");
  const url = new URL(authorizeUrl);
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  response.cookies.set(stateCookie(provider), payload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SECURE_COOKIES === "true",
    path: "/",
    maxAge: 60 * 10
  });
  return response;
}

export function verifyOAuthState(req: NextRequest, provider: LoginOAuthProvider) {
  const received = req.nextUrl.searchParams.get("state") || "";
  const cookie = req.cookies.get(stateCookie(provider))?.value || "";
  if (!received || !cookie) throw new Error("OAuth state was missing or expired.");
  let parsed: { state?: string; next?: string };
  try {
    parsed = JSON.parse(Buffer.from(cookie, "base64url").toString("utf8"));
  } catch {
    throw new Error("OAuth state was invalid.");
  }
  const expected = Buffer.from(parsed.state || "");
  const actual = Buffer.from(received);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error("OAuth state did not match.");
  }
  return { next: safeNextPath(parsed.next), cookieName: stateCookie(provider) };
}

export function redirectOAuthError(req: NextRequest, message: string) {
  const url = publicUrl(req, "/login");
  url.searchParams.set("oauth_error", message);
  return NextResponse.redirect(url);
}

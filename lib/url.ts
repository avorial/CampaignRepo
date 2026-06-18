import type { NextRequest } from "next/server";

export function publicOrigin(req: NextRequest) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto.split(",")[0]}://${forwardedHost.split(",")[0]}`;
  return new URL(req.url).origin;
}

export function publicUrl(req: NextRequest, path: string) {
  return new URL(path, publicOrigin(req));
}

export function isInternalOrigin(origin: string) {
  return /^https?:\/\/(0\.0\.0\.0|localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

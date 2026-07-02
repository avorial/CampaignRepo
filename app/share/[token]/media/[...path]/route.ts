import { NextResponse } from "next/server";
import { getPageShare, getCampaignByIdPublic } from "@/lib/db";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", avif: "image/avif",
  mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf",
  mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav"
};

function guessContentType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return MIME_MAP[ext] || "application/octet-stream";
}

export async function GET(_: Request, { params }: { params: Promise<{ token: string; path: string[] }> }) {
  const { token, path } = await params;
  const share = getPageShare(token);
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const campaign = getCampaignByIdPublic(share.campaignId);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storage = getStorageAdapter(campaign, null);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cleanParts = path.filter(Boolean);
  if (!cleanParts.length || cleanParts.some((p) => p === "." || p === ".." || p.includes("/") || p.includes("\\"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const mediaPath = `wiki/media/${cleanParts.join("/")}`;
  try {
    const file = await storage.getRawFile(mediaPath);
    const ct = file.contentType || guessContentType(cleanParts[cleanParts.length - 1]);
    return new NextResponse(file.bytes, {
      headers: { "Content-Type": ct, "Cache-Control": "public, max-age=3600" }
    });
  } catch (error) {
    if (isNotFoundError(error)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw error;
  }
}

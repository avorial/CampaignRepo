import { NextResponse } from "next/server";
import { getPageShare, getCampaignByIdPublic } from "@/lib/db";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";
import { mediaResponseHeaders } from "@/lib/media-response";

export const dynamic = "force-dynamic";

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
    return new NextResponse(file.bytes, {
      headers: mediaResponseHeaders(cleanParts[cleanParts.length - 1], file.contentType, "public, max-age=3600")
    });
  } catch (error) {
    if (isNotFoundError(error)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw error;
  }
}

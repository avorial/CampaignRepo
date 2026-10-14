import { NextResponse } from "next/server";
import { getPublicSiteCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";
import { mediaResponseHeaders } from "@/lib/media-response";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = await params;
  const campaign = getPublicSiteCampaign(slug);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cleanParts = path.filter(Boolean);
  if (!cleanParts.length || cleanParts.some((part) => part === "." || part === ".." || part.includes("/") || part.includes("\\"))) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
  }
  const fileName = cleanParts[cleanParts.length - 1];
  const mediaPath = `wiki/media/${cleanParts.join("/")}`;
  try {
    const file = await storage.getRawFile(mediaPath);
    return new NextResponse(file.bytes, { headers: mediaResponseHeaders(fileName, file.contentType, "public, max-age=300") });
  } catch (error) {
    if (isNotFoundError(error)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw error;
  }
}

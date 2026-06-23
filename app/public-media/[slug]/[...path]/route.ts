import { NextResponse } from "next/server";
import { getCampaignRepositoryToken, getPublicSiteCampaign } from "@/lib/db";
import { getRawFile, GitHubError } from "@/lib/github";

export const dynamic = "force-dynamic";

function contentType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = await params;
  const campaign = getPublicSiteCampaign(slug);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const repoToken = getCampaignRepositoryToken(campaign.id);
  if (!repoToken) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cleanParts = path.filter(Boolean);
  if (!cleanParts.length || cleanParts.some((part) => part === "." || part === ".." || part.includes("/") || part.includes("\\"))) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
  }

  const fileName = cleanParts[cleanParts.length - 1];
  const mediaPath = `wiki/media/${cleanParts.join("/")}`;
  try {
    const file = await getRawFile(repoToken, campaign, mediaPath);
    return new NextResponse(file.bytes, {
      headers: {
        "Content-Type": file.contentType || contentType(fileName),
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw error;
  }
}

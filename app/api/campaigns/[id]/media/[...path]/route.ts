import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { getContent } from "@/lib/github";

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

export async function GET(_: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  const user = await requireUser();
  const { id, path } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cleanParts = path.filter(Boolean);
  if (!cleanParts.length || cleanParts.some((part) => part === "." || part === ".." || part.includes("/") || part.includes("\\"))) {
    return NextResponse.json({ error: "Invalid media path" }, { status: 400 });
  }

  const fileName = cleanParts[cleanParts.length - 1];
  const mediaPath = `wiki/media/${cleanParts.join("/")}`;
  const file = await getContent(user.githubToken, campaign, mediaPath);
  if (file.type !== "file") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bytes = Buffer.from(file.content.replace(/\n/g, ""), "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType(fileName),
      "Cache-Control": "private, max-age=300"
    }
  });
}

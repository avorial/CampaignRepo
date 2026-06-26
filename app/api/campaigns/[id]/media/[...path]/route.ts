import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  const user = await requireUser();
  const { id, path } = await params;
  const campaign = getCampaign(user.id, Number(id));
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
    const ct = file.contentType || guessContentType(fileName);
    return new NextResponse(file.bytes, { headers: { "Content-Type": ct, "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    if (isNotFoundError(error)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw error;
  }
}

function guessContentType(fileName: string) {
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

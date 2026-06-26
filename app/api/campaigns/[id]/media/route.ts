import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError, type StorageAdapter } from "@/lib/storage";
import { slugify } from "@/lib/slug";
import type { Campaign, CampaignMedia } from "@/lib/types";
import { scheduleSearchIndexRebuild } from "@/lib/search";

type MediaMetadata = { alt?: string; caption?: string; tags?: string[] };

const metadataPath = "wiki/media/media.json";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  base64: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
  tags: z.array(z.string()).default([])
});

const deleteSchema = z.object({ path: z.string().min(1) });

const renameSchema = z.object({
  path: z.string().min(1),
  fileName: z.string().min(1).optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  tags: z.array(z.string()).optional()
});

function mediaType(name: string, mimeType?: string): CampaignMedia["mediaType"] {
  const lower = name.toLowerCase();
  if (mimeType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return "image";
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mimeType?.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|flac)$/.test(lower)) return "audio";
  return "other";
}

function cleanFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  const ext = lastDot >= 0 ? fileName.slice(lastDot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const base = lastDot >= 0 ? fileName.slice(0, lastDot) : fileName;
  return `${slugify(base)}${ext}`;
}

function markdownFor(name: string, type: CampaignMedia["mediaType"], alt?: string) {
  const path = `/wiki/media/${name}`;
  if (type === "image") return `![${alt || name}](${path})`;
  return `[${alt || name}](${path})`;
}

async function readMetadata(storage: StorageAdapter) {
  try {
    const file = await storage.getTextFile(metadataPath);
    const parsed = JSON.parse(file.text || "{}") as Record<string, MediaMetadata>;
    return { sha: file.sha, metadata: parsed && typeof parsed === "object" ? parsed : {} };
  } catch (error) {
    if (isNotFoundError(error)) return { sha: undefined, metadata: {} as Record<string, MediaMetadata> };
    throw error;
  }
}

async function writeMetadata(storage: StorageAdapter, metadata: Record<string, MediaMetadata>, sha?: string) {
  await storage.putFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "CampaignRepo: update media metadata", sha);
}

function isEditableMediaPath(path: string) {
  return path.startsWith("wiki/media/") && !path.includes("..") && !path.endsWith("/.gitkeep") && path !== metadataPath;
}

function toMedia(entry: { name: string; path: string; sha: string; size?: number; downloadUrl?: string }, metadata: MediaMetadata = {}): CampaignMedia {
  const type = mediaType(entry.name);
  return {
    name: entry.name,
    path: entry.path,
    sha: entry.sha,
    size: entry.size,
    downloadUrl: entry.downloadUrl,
    mediaType: type,
    alt: metadata.alt,
    caption: metadata.caption,
    tags: metadata.tags || [],
    markdown: markdownFor(entry.name, type, metadata.alt)
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [entries, metadataFile] = await Promise.all([storage.listDirectory("wiki/media"), readMetadata(storage)]);
  const media = entries
    .filter((entry) => entry.type === "file" && entry.name !== ".gitkeep" && entry.path !== metadataPath)
    .map((entry) => toMedia(entry, metadataFile.metadata[entry.path]));
  return NextResponse.json({ media });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = uploadSchema.parse(await req.json());
  const name = cleanFileName(input.fileName);
  const type = mediaType(name, input.mimeType);
  const path = `wiki/media/${name}`;
  await storage.putBase64File(path, input.base64, `CampaignRepo: upload media ${name}`);
  const uploaded = await storage.getContent(path);
  const metadataFile = await readMetadata(storage);
  const metadata = { ...metadataFile.metadata, [path]: { alt: input.alt || name, caption: input.caption || "", tags: input.tags } };
  await writeMetadata(storage, metadata, metadataFile.sha);
  scheduleSearchIndexRebuild(campaign);
  return NextResponse.json({ media: { name, path, sha: uploaded.sha, alt: input.alt || name, caption: input.caption || "", tags: input.tags, mediaType: type, markdown: markdownFor(name, type, input.alt) } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = renameSchema.parse(await req.json());
  if (!isEditableMediaPath(input.path)) return NextResponse.json({ error: "Only campaign media files can be updated." }, { status: 400 });
  const current = await storage.getContent(input.path);
  if (current.type !== "file") return NextResponse.json({ error: "Only files can be updated." }, { status: 400 });

  if (!input.fileName) {
    const name = input.path.split("/").pop() || input.path;
    const metadataFile = await readMetadata(storage);
    const currentMeta = metadataFile.metadata[input.path] || {};
    const nextMetadata = { ...metadataFile.metadata, [input.path]: { alt: input.alt ?? currentMeta.alt ?? name, caption: input.caption ?? currentMeta.caption ?? "", tags: input.tags ?? currentMeta.tags ?? [] } };
    await writeMetadata(storage, nextMetadata, metadataFile.sha);
    scheduleSearchIndexRebuild(campaign);
    return NextResponse.json({ media: toMedia({ name, path: input.path, sha: current.sha }, nextMetadata[input.path]) });
  }

  const name = cleanFileName(input.fileName);
  if (!name) return NextResponse.json({ error: "Choose a valid file name." }, { status: 400 });
  const nextPath = `wiki/media/${name}`;
  if (nextPath === input.path) {
    const fresh = await storage.getContent(input.path);
    const metadataFile = await readMetadata(storage);
    return NextResponse.json({ media: toMedia({ name, path: nextPath, sha: fresh.sha }, metadataFile.metadata[nextPath]) });
  }
  try {
    await storage.getContent(nextPath);
    return NextResponse.json({ error: "A media file with that name already exists." }, { status: 409 });
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }
  await storage.putBase64File(nextPath, current.content.replace(/\n/g, ""), `CampaignRepo: rename media ${input.path.split("/").pop()} to ${name}`);
  await storage.deleteFile(input.path, `CampaignRepo: remove old media path ${input.path.split("/").pop()}`, current.sha);
  const metadataFile = await readMetadata(storage);
  const nextMetadata = { ...metadataFile.metadata };
  nextMetadata[nextPath] = nextMetadata[input.path] || { alt: name, tags: [] };
  delete nextMetadata[input.path];
  await writeMetadata(storage, nextMetadata, metadataFile.sha);
  scheduleSearchIndexRebuild(campaign);
  const renamed = await storage.getContent(nextPath);
  return NextResponse.json({ media: toMedia({ name, path: nextPath, sha: renamed.sha }, nextMetadata[nextPath]) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const input = deleteSchema.parse(await req.json());
  if (!isEditableMediaPath(input.path)) return NextResponse.json({ error: "Only campaign media files can be deleted." }, { status: 400 });
  const file = await storage.getContent(input.path);
  if (file.type !== "file") return NextResponse.json({ error: "Only files can be deleted." }, { status: 400 });
  await storage.deleteFile(input.path, `CampaignRepo: delete media ${input.path.split("/").pop()}`, file.sha);
  const metadataFile = await readMetadata(storage);
  const metadata = { ...metadataFile.metadata };
  delete metadata[input.path];
  await writeMetadata(storage, metadata, metadataFile.sha);
  scheduleSearchIndexRebuild(campaign);
  return NextResponse.json({ ok: true });
}

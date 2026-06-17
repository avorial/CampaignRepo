import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { deleteFile, getContent, GitHubError, listDirectory, putBase64File } from "@/lib/github";
import { slugify } from "@/lib/slug";
import type { CampaignMedia } from "@/lib/types";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  base64: z.string().min(1),
  alt: z.string().optional()
});

const deleteSchema = z.object({
  path: z.string().min(1)
});

const renameSchema = z.object({
  path: z.string().min(1),
  fileName: z.string().min(1)
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

function isEditableMediaPath(path: string) {
  return path.startsWith("wiki/media/") && !path.includes("..") && !path.endsWith("/.gitkeep");
}

function toMedia(entry: { name: string; path: string; sha: string; size?: number; download_url?: string | null }): CampaignMedia {
  const type = mediaType(entry.name);
  return {
    name: entry.name,
    path: entry.path,
    sha: entry.sha,
    size: entry.size,
    downloadUrl: entry.download_url || undefined,
    mediaType: type,
    markdown: markdownFor(entry.name, type)
  };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const entries = await listDirectory(user.githubToken, campaign, "wiki/media");
  const media = entries.filter((entry) => entry.type === "file" && entry.name !== ".gitkeep").map(toMedia);
  return NextResponse.json({ media });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = uploadSchema.parse(await req.json());
  const name = cleanFileName(input.fileName);
  const type = mediaType(name, input.mimeType);
  const path = `wiki/media/${name}`;
  await putBase64File(user.githubToken, campaign, path, input.base64, `CampaignRepo: upload media ${name}`);
  return NextResponse.json({
    media: {
      name,
      path,
      mediaType: type,
      markdown: markdownFor(name, type, input.alt)
    }
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = renameSchema.parse(await req.json());
  if (!isEditableMediaPath(input.path)) {
    return NextResponse.json({ error: "Only campaign media files can be renamed." }, { status: 400 });
  }

  const name = cleanFileName(input.fileName);
  if (!name) return NextResponse.json({ error: "Choose a valid file name." }, { status: 400 });

  const nextPath = `wiki/media/${name}`;
  if (nextPath === input.path) {
    const current = await getContent(user.githubToken, campaign, input.path);
    return NextResponse.json({ media: toMedia({ name, path: nextPath, sha: current.sha }) });
  }

  try {
    await getContent(user.githubToken, campaign, nextPath);
    return NextResponse.json({ error: "A media file with that name already exists." }, { status: 409 });
  } catch (error) {
    if (!(error instanceof GitHubError && error.status === 404)) throw error;
  }

  const current = await getContent(user.githubToken, campaign, input.path);
  if (current.type !== "file") return NextResponse.json({ error: "Only files can be renamed." }, { status: 400 });

  await putBase64File(user.githubToken, campaign, nextPath, current.content.replace(/\n/g, ""), `CampaignRepo: rename media ${input.path.split("/").pop()} to ${name}`);
  await deleteFile(user.githubToken, campaign, input.path, `CampaignRepo: remove old media path ${input.path.split("/").pop()}`, current.sha);
  const renamed = await getContent(user.githubToken, campaign, nextPath);
  return NextResponse.json({ media: toMedia({ name, path: nextPath, sha: renamed.sha }) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = deleteSchema.parse(await req.json());
  if (!input.path.startsWith("wiki/media/") || input.path.includes("..") || input.path.endsWith("/.gitkeep")) {
    return NextResponse.json({ error: "Only campaign media files can be deleted." }, { status: 400 });
  }

  const file = await getContent(user.githubToken, campaign, input.path);
  if (file.type !== "file") return NextResponse.json({ error: "Only files can be deleted." }, { status: 400 });

  await deleteFile(user.githubToken, campaign, input.path, `CampaignRepo: delete media ${input.path.split("/").pop()}`, file.sha);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError, type StorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Minimal ZIP builder (STORED mode, no compression dependencies)
// ---------------------------------------------------------------------------

const CRC32_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
function u32(n: number): Uint8Array { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }
function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const localEntries: Uint8Array[] = [];
  const centralDirs: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const local = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20), u16(0), u16(0),
      u16(0), u16(0),
      u32(crc), u32(file.data.length), u32(file.data.length),
      u16(nameBytes.length), u16(0),
      nameBytes,
      file.data
    );
    const cd = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20), u16(20),
      u16(0), u16(0), u16(0),
      u16(0), u16(0),
      u32(crc), u32(file.data.length), u32(file.data.length),
      u16(nameBytes.length), u16(0), u16(0),
      u16(0), u16(0),
      u32(0), u32(offset),
      nameBytes
    );
    localEntries.push(local);
    centralDirs.push(cd);
    offset += local.length;
  }

  const cdData = concat(...centralDirs);
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(cdData.length), u32(offset),
    u16(0)
  );

  return concat(...localEntries, cdData, eocd);
}

type ExportFile = {
  path: string;
  data: Uint8Array;
  size: number;
  contentType?: string;
};

const textFilePattern = /\.(css|csv|html|js|json|jsx|md|mjs|scss|svg|ts|tsx|txt|yaml|yml)$/i;
const ignoredPathParts = new Set([".git", "node_modules"]);

async function collectFiles(storage: StorageAdapter, dir: string): Promise<ExportFile[]> {
  const entries = await storage.listDirectory(dir);
  const files: ExportFile[] = [];
  for (const entry of entries) {
    if (ignoredPathParts.has(entry.name)) continue;
    if (entry.type === "dir") {
      files.push(...await collectFiles(storage, entry.path));
      continue;
    }
    if (entry.type !== "file") continue;
    try {
      const raw = await storage.getRawFile(entry.path);
      const data = new Uint8Array(raw.bytes);
      files.push({ path: entry.path, data, size: data.byteLength, contentType: raw.contentType });
    } catch {
      // Keep the export resilient if one file disappears during the read.
    }
  }
  return files;
}

async function optionalRawFile(storage: StorageAdapter, path: string): Promise<ExportFile | null> {
  try {
    const raw = await storage.getRawFile(path);
    const data = new Uint8Array(raw.bytes);
    return { path, data, size: data.byteLength, contentType: raw.contentType };
  } catch (error) {
    if (isNotFoundError(error) || (error as any)?.status === 404) return null;
    throw error;
  }
}

function decodeExportFile(file: ExportFile) {
  if (textFilePattern.test(file.path)) {
    return { path: file.path, encoding: "utf-8", contentType: file.contentType, content: new TextDecoder().decode(file.data) };
  }
  return { path: file.path, encoding: "base64", contentType: file.contentType, content: Buffer.from(file.data).toString("base64") };
}

function safeFileSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "campaign";
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage configured" }, { status: 400 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "zip";
  const enc = new TextEncoder();
  const [wikiFiles, readme] = await Promise.all([
    collectFiles(storage, "wiki"),
    optionalRawFile(storage, "README.md")
  ]);
  const exportFiles = [
    ...(readme ? [readme] : []),
    ...wikiFiles.sort((a, b) => a.path.localeCompare(b.path))
  ];

  if (format === "json") {
    const bundle = {
      format: "campaignrepo.backup.v2",
      campaignId: campaign.id,
      campaignName: campaign.name,
      owner: campaign.owner,
      repo: campaign.repo,
      branch: campaign.branch,
      gameType: campaign.gameType,
      exportedAt: new Date().toISOString(),
      fileCount: exportFiles.length,
      files: exportFiles.map(decodeExportFile)
    };
    return new Response(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${safeFileSlug(campaign.name)}-backup.json"`
      }
    });
  }

  const manifest = {
    format: "campaignrepo.backup.v2",
    campaignId: campaign.id,
    campaignName: campaign.name,
    owner: campaign.owner,
    repo: campaign.repo,
    branch: campaign.branch,
    gameType: campaign.gameType,
    exportedAt: new Date().toISOString(),
    fileCount: exportFiles.length,
    files: exportFiles.map((file) => ({ path: file.path, size: file.size, contentType: file.contentType || null }))
  };
  const files = [
    { name: "campaignrepo-export-manifest.json", data: enc.encode(JSON.stringify(manifest, null, 2)) },
    ...exportFiles.map((file) => ({ name: file.path, data: file.data }))
  ];

  if (files.length <= 1) return NextResponse.json({ error: "No campaign files to export" }, { status: 404 });

  const zip = buildZip(files);
  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeFileSlug(campaign.name)}-backup.zip"`,
      "Content-Length": String(zip.length)
    }
  });
}

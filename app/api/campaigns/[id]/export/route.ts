import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { readPageCache } from "@/lib/page-cache";

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
    // Local file header
    const local = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      u16(20), u16(0), u16(0),                   // version, flags, method (STORED)
      u16(0), u16(0),                             // mod time, mod date
      u32(crc), u32(file.data.length), u32(file.data.length),
      u16(nameBytes.length), u16(0),              // name len, extra len
      nameBytes,
      file.data
    );
    // Central directory entry
    const cd = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      u16(20), u16(20),                           // version made by, version needed
      u16(0), u16(0), u16(0),                    // flags, method (STORED)
      u16(0), u16(0),                             // mod time, date
      u32(crc), u32(file.data.length), u32(file.data.length),
      u16(nameBytes.length), u16(0), u16(0),     // name, extra, comment len
      u16(0), u16(0),                             // disk start, int attrs
      u32(0), u32(offset),                        // ext attrs, local header offset
      nameBytes
    );
    localEntries.push(local);
    centralDirs.push(cd);
    offset += local.length;
  }

  const cdData = concat(...centralDirs);
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),   // EOCD signature
    u16(0), u16(0),                               // disk number, start disk
    u16(files.length), u16(files.length),         // entries on disk, total entries
    u32(cdData.length), u32(offset),              // CD size, CD offset
    u16(0)                                        // comment length
  );

  return concat(...localEntries, cdData, eocd);
}

// ---------------------------------------------------------------------------

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

  const cache = readPageCache(campaign.id);
  const pages = cache?.pages || [];
  const enc = new TextEncoder();

  if (format === "json") {
    const bundle = {
      campaignName: campaign.name,
      exportedAt: new Date().toISOString(),
      pages: await Promise.all(pages.map(async (p) => {
        try {
          const file = await storage.getTextFile(`wiki/pages/${p.slug}.md`);
          return { slug: p.slug, path: `wiki/pages/${p.slug}.md`, content: file.text };
        } catch { return { slug: p.slug, path: `wiki/pages/${p.slug}.md`, content: "" }; }
      }))
    };
    const json = JSON.stringify(bundle, null, 2);
    return new Response(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${campaign.name.replace(/[^a-z0-9]/gi, "-")}-export.json"`
      }
    });
  }

  // Default: ZIP format
  const files: { name: string; data: Uint8Array }[] = [];

  // Include campaign.yaml
  try {
    const yaml = await storage.getTextFile("wiki/campaign.yaml");
    files.push({ name: "wiki/campaign.yaml", data: enc.encode(yaml.text) });
  } catch { /* no yaml */ }

  // Include all pages
  for (const p of pages) {
    try {
      const file = await storage.getTextFile(`wiki/pages/${p.slug}.md`);
      files.push({ name: `wiki/pages/${p.slug}.md`, data: enc.encode(file.text) });
    } catch { /* skip missing */ }
  }

  if (!files.length) return NextResponse.json({ error: "No pages to export" }, { status: 404 });

  const zip = buildZip(files);
  const slug = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new Response(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-export.zip"`,
      "Content-Length": String(zip.length)
    }
  });
}

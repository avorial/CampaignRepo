import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";

const schema = z.object({
  sourcePath: z.string().min(1),
  sourceJson: z.record(z.any())
});

type FlatValue = string | number | boolean | null;

function flatten(value: unknown, prefix = "", out: Record<string, FlatValue> = {}) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    out[prefix || "$"] = value;
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    if (!value.length) out[prefix || "$"] = "[]";
    return out;
  }
  if (typeof value === "object" && value) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) out[prefix || "$"] = "{}";
    for (const [key, item] of entries) {
      flatten(item, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

function validSourcePath(path: string) {
  return path.startsWith("wiki/imports/characters/") && path.endsWith(".json") && !path.includes("..");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const input = schema.parse(await req.json());
  if (!validSourcePath(input.sourcePath)) return NextResponse.json({ error: "Invalid import source path." }, { status: 400 });

  const existingFile = await storage.getTextFile(input.sourcePath);
  const before = flatten(JSON.parse(existingFile.text));
  const after = flatten(input.sourceJson);
  const paths = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const changes = paths
    .map((path) => {
      if (!(path in before)) return { path, type: "added", after: after[path] };
      if (!(path in after)) return { path, type: "removed", before: before[path] };
      if (JSON.stringify(before[path]) !== JSON.stringify(after[path])) return { path, type: "changed", before: before[path], after: after[path] };
      return null;
    })
    .filter(Boolean);

  return NextResponse.json({
    sourcePath: input.sourcePath,
    counts: {
      added: changes.filter((change: any) => change.type === "added").length,
      removed: changes.filter((change: any) => change.type === "removed").length,
      changed: changes.filter((change: any) => change.type === "changed").length
    },
    changes: changes.slice(0, 200)
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";

const CONFIG_PATH = "wiki/.ai-config.json";

const schema = z.object({
  endpoint: z.string().url().or(z.literal("")).optional(),
  model: z.string().optional(),
  apiKey: z.string().optional()
});

async function guard(id: string) {
  const user = await requireUser();
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canManageCampaign(user.id, campaign.id)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, campaign };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ config: {} });
  try {
    const file = await storage.getTextFile(CONFIG_PATH);
    const config = JSON.parse(file.text) as Record<string, string>;
    return NextResponse.json({ config: { endpoint: config.endpoint || "", model: config.model || "", apiKey: config.apiKey ? "••••••••" : "" } });
  } catch (e) {
    if (isNotFoundError(e)) return NextResponse.json({ config: {} });
    throw e;
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage configured" }, { status: 400 });
  const input = schema.parse(await req.json());

  let existing: { endpoint?: string; model?: string; apiKey?: string } = {};
  let sha: string | undefined;
  try {
    const file = await storage.getTextFile(CONFIG_PATH);
    existing = JSON.parse(file.text);
    sha = file.sha;
  } catch { /* new file */ }

  const config = {
    endpoint: input.endpoint ?? existing.endpoint ?? "",
    model: input.model ?? existing.model ?? "",
    apiKey: input.apiKey !== undefined ? (input.apiKey.startsWith("••") ? (existing.apiKey || "") : input.apiKey) : (existing.apiKey || "")
  };

  await storage.putFile(CONFIG_PATH, JSON.stringify(config, null, 2), "CampaignRepo: update AI config", sha);
  return NextResponse.json({ config: { endpoint: config.endpoint, model: config.model, apiKey: config.apiKey ? "••••••••" : "" } });
}

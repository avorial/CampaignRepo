import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { CAMPAIGN_AI_CONFIG_PATH, maskAiConfig, readCampaignAiConfig } from "@/lib/ai-config";
import { getStorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

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
    const config = await readCampaignAiConfig(storage);
    return NextResponse.json({ config: maskAiConfig(config) });
  } catch (error) {
    throw error;
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
    const file = await storage.getTextFile(CAMPAIGN_AI_CONFIG_PATH);
    existing = JSON.parse(file.text);
    sha = file.sha;
  } catch { /* new file */ }

  const config = {
    endpoint: input.endpoint ?? existing.endpoint ?? "",
    model: input.model ?? existing.model ?? "",
    apiKey: input.apiKey !== undefined ? (input.apiKey.startsWith("••") ? (existing.apiKey || "") : input.apiKey) : (existing.apiKey || "")
  };

  await storage.putFile(CAMPAIGN_AI_CONFIG_PATH, JSON.stringify(config, null, 2), "CampaignRepo: update AI config", sha);
  return NextResponse.json({ config: maskAiConfig(config) });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import yaml from "yaml";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";

const CAMPAIGN_YAML = "wiki/campaign.yaml";

async function readCampaignYaml(storage: Awaited<ReturnType<typeof getStorageAdapter>>) {
  if (!storage) return { data: {}, sha: undefined as string | undefined };
  try {
    const file = await storage.getTextFile(CAMPAIGN_YAML);
    return { data: (yaml.parse(file.text) || {}) as Record<string, unknown>, sha: file.sha };
  } catch { return { data: {} as Record<string, unknown>, sha: undefined as string | undefined }; }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.role !== "owner" && campaign.role !== "gm") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  const { data } = await readCampaignYaml(storage);
  const groups = Array.isArray(data.groups) ? data.groups.map(String) : [];
  return NextResponse.json({ groups });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage" }, { status: 400 });

  const input = z.object({ groups: z.array(z.string()) }).parse(await req.json());
  const { data, sha } = await readCampaignYaml(storage);
  data.groups = input.groups;
  await storage.putFile(CAMPAIGN_YAML, yaml.stringify(data), "CampaignRepo: update secret groups", sha);
  return NextResponse.json({ groups: input.groups });
}

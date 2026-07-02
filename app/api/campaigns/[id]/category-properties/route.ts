import { NextResponse } from "next/server";
import { z } from "zod";
import yaml from "yaml";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

const CAMPAIGN_YAML = "wiki/campaign.yaml";

const propSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(["text", "textarea", "number", "select", "checkbox", "date", "counter", "link"]).default("text"),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional()
});

const bodySchema = z.object({
  categoryProperties: z.record(z.array(propSchema))
});

async function readYaml(storage: NonNullable<ReturnType<typeof getStorageAdapter>>) {
  try {
    const file = await storage.getTextFile(CAMPAIGN_YAML);
    return { data: (yaml.parse(file.text) || {}) as Record<string, unknown>, sha: file.sha };
  } catch {
    return { data: {} as Record<string, unknown>, sha: undefined as string | undefined };
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.role !== "owner" && campaign.role !== "gm") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ categoryProperties: {} });
  const { data } = await readYaml(storage);
  const categoryProperties = (data.categoryProperties as Record<string, unknown[]>) || {};
  return NextResponse.json({ categoryProperties });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage" }, { status: 400 });

  const input = bodySchema.parse(await req.json());
  const { data, sha } = await readYaml(storage);
  data.categoryProperties = input.categoryProperties;
  await storage.putFile(CAMPAIGN_YAML, yaml.stringify(data), "CampaignRepo: update category properties", sha);
  return NextResponse.json({ categoryProperties: input.categoryProperties });
}

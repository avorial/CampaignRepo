import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { createQuest, listQuests } from "@/lib/quests";

export const dynamic = "force-dynamic";

const createSchema = z.object({ title: z.string().trim().min(1) });

async function guard(id: string) {
  const user = await requireUser();
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!canManageCampaign(user.id, campaign.id)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, campaign };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const playerMode = url.searchParams.get("mode") === "player";
  if (!canManageCampaign(user.id, campaign.id) && !playerMode) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const all = await listQuests(campaign, user.githubToken);
  const quests = playerMode ? all.filter((q) => q.frontmatter.visibility === "players") : all;
  return NextResponse.json({ quests });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guarded = await guard(id);
  if ("error" in guarded) return guarded.error;
  const { user, campaign } = guarded;
  const input = createSchema.parse(await req.json());
  return NextResponse.json({ quest: await createQuest(campaign, input.title, user.githubToken) });
}

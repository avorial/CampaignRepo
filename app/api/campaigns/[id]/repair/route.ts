import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { repairCampaignIndexes } from "@/lib/repair";

export const dynamic = "force-dynamic";

// requireApiUser: sessions AND API tokens, so the repair CLI can run headless.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(_);
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const report = await repairCampaignIndexes(storage, campaign);
  return NextResponse.json(report, { status: report.ok ? 200 : 207 });
}

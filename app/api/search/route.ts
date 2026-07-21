import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign, searchDocs } from "@/lib/db";
import { isMutedPage, loadMutedTags } from "@/lib/muted-tags";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const campaignId = url.searchParams.get("campaignId");
  const mode = url.searchParams.get("mode") === "player" ? "player" : "gm";
  const includeMuted = url.searchParams.get("includeMuted") === "1";
  const results = searchDocs(user.id, q, campaignId ? Number(campaignId) : undefined, mode);

  // Muting is scoped to a single campaign so a cross-campaign search does not
  // fan out into one config read per campaign.
  if (!campaignId || includeMuted) return NextResponse.json({ results, mutedHidden: 0 });
  const campaign = getCampaign(user.id, Number(campaignId));
  if (!campaign) return NextResponse.json({ results, mutedHidden: 0 });
  const muted = await loadMutedTags(campaign, user.githubToken).catch(() => [] as string[]);
  if (!muted.length) return NextResponse.json({ results, mutedHidden: 0 });

  // search_index stores tags space-joined.
  const visible = results.filter((row: { tags?: string; category?: string }) =>
    !isMutedPage(String(row.tags || "").split(/\s+/), row.category, muted));
  return NextResponse.json({ results: visible, mutedHidden: results.length - visible.length });
}

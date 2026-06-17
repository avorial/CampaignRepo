import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, listCampaigns } from "@/lib/db";
import { listReviewPages } from "@/lib/reviews";

/** Aggregate unapproved/rejected pages across every campaign the user manages. */
export async function GET() {
  const user = await requireUser();
  if (!user.githubToken) return NextResponse.json({ campaigns: [] });

  const managed = listCampaigns(user.id).filter((campaign) => canManageCampaign(user.id, campaign.id));
  const groups = await Promise.all(
    managed.map(async (campaign) => {
      try {
        const reviews = await listReviewPages(user.githubToken!, campaign);
        return { campaignId: campaign.id, campaignName: campaign.name, reviews };
      } catch {
        return { campaignId: campaign.id, campaignName: campaign.name, reviews: [] };
      }
    })
  );

  return NextResponse.json({ campaigns: groups.filter((group) => group.reviews.length > 0) });
}

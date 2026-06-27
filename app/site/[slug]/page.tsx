import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSiteCampaign } from "@/lib/db";
import { loadCampaignCategories } from "@/lib/categories";
import { loadCampaignTheme, loadPublicPages } from "@/lib/public-site";
import PublicSiteClient from "./public-site-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const campaign = getPublicSiteCampaign(slug);
  if (!campaign) return { title: "CampaignRepo" };
  return {
    title: `${campaign.name} — World`,
    description: `Public world of ${campaign.name}, published with CampaignRepo.`
  };
}

export default async function PublicSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = getPublicSiteCampaign(slug);
  if (!campaign) notFound();
  const [pages, theme, categories] = await Promise.all([loadPublicPages(campaign), loadCampaignTheme(campaign), loadCampaignCategories(campaign)]);
  return <PublicSiteClient slug={slug} campaignName={campaign.name} gameType={campaign.gameType} pages={pages} theme={theme} categories={categories} />;
}

import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { loadCampaignCategories } from "@/lib/categories";
import { loadCampaignTheme } from "@/lib/public-site";
import { themeToCssVars } from "@/lib/theme";
import OrganizeClient from "./organize-client";

export default async function OrganizePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");
  if (campaign.role !== "owner" && campaign.role !== "gm") redirect(`/campaigns/${campaign.id}`);
  const [theme, categories] = await Promise.all([
    loadCampaignTheme(campaign, user.githubToken),
    loadCampaignCategories(campaign, user.githubToken)
  ]);
  const themeVars = themeToCssVars(theme) as CSSProperties;

  return (
    <main className="app-shell" data-theme={theme.preset || undefined} style={themeVars}>
      <header className="topbar">
        <div>
          <Link href={`/campaigns/${campaign.id}`} className="quiet-link">{campaign.name}</Link>
          <h1>Organize pages</h1>
          <p className="muted">Filter, multi-select, and bulk-edit pages — all in a single commit.</p>
        </div>
      </header>
      <OrganizeClient campaign={campaign} categories={categories} />
    </main>
  );
}

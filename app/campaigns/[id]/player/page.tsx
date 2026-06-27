import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { loadCampaignCategories } from "@/lib/categories";
import { loadCampaignTheme } from "@/lib/public-site";
import { themeToCssVars } from "@/lib/theme";
import PlayerPortalClient from "./player-portal-client";

export default async function PlayerPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");
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
          <h1>Player Portal</h1>
          <p className="muted">Approved handouts, public lore, and player-safe search.</p>
        </div>
        <div className="topbar-actions">
          <Link className="button secondary" href={`/campaigns/${campaign.id}`}>Campaign Workspace</Link>
        </div>
      </header>
      <PlayerPortalClient campaign={campaign} categories={categories} />
    </main>
  );
}

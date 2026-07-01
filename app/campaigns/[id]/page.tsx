import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { loadCampaignCategories } from "@/lib/categories";
import { loadCampaignTheme } from "@/lib/public-site";
import { themeToCssVars } from "@/lib/theme";
import CampaignClient from "./workspace-client";
import NotificationBell from "@/app/components/notification-bell";

function themeLogoSrc(campaignId: number, logo?: string) {
  if (!logo) return "";
  if (/^https?:\/\//i.test(logo)) return logo;
  const clean = logo.replace(/^\/?wiki\/media\//, "");
  return `/campaign-media/${campaignId}/${clean.split("/").map(encodeURIComponent).join("/")}`;
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
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
  const logoSrc = themeLogoSrc(campaign.id, theme.logo);
  return (
    <main className="app-shell" data-theme={theme.preset || undefined} style={themeVars}>
      <header className="topbar">
        <div>
          <Link href="/dashboard" className="quiet-link">Dashboard</Link>
          {logoSrc ? <img className="campaign-title-logo" src={logoSrc} alt={campaign.name} /> : <h1>{campaign.name}</h1>}
          <p className="muted">{campaign.owner}/{campaign.repo} · {campaign.gameType}</p>
        </div>
        <div className="topbar-actions">
          <Link className="button secondary" href={`/campaigns/${campaign.id}/overview`}>Overview</Link>
          <Link className="button secondary" href={`/campaigns/${campaign.id}/player`}>Player Portal</Link>
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/sessions`}>Sessions</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/quests`}>Quests</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/calendar`}>Calendar</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/maps`}>Maps</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/graph`}>Graph</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/organize`}>Organize</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/health`}>Health</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/admin`}>GM Admin</Link>}
          <a className="button secondary" href={`https://github.com/${campaign.owner}/${campaign.repo}`}>Open GitHub</a>
          <NotificationBell />
        </div>
      </header>
      <CampaignClient campaign={campaign} categories={categories} />
    </main>
  );
}

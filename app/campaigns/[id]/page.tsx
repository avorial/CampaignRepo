import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { loadCampaignTheme } from "@/lib/public-site";
import { categories } from "@/lib/templates";
import { themeToCssVars } from "@/lib/theme";
import CampaignClient from "./workspace-client";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");
  const themeVars = themeToCssVars(await loadCampaignTheme(campaign)) as CSSProperties;
  return (
    <main className="app-shell" style={themeVars}>
      <header className="topbar">
        <div>
          <Link href="/dashboard" className="quiet-link">Dashboard</Link>
          <h1>{campaign.name}</h1>
          <p className="muted">{campaign.owner}/{campaign.repo} · {campaign.gameType}</p>
        </div>
        <div className="topbar-actions">
          <Link className="button secondary" href={`/campaigns/${campaign.id}/overview`}>Overview</Link>
          <Link className="button secondary" href={`/campaigns/${campaign.id}/player`}>Player Portal</Link>
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/maps`}>Maps</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/organize`}>Organize</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/health`}>Health</Link>}
          {(campaign.role === "owner" || campaign.role === "gm") && <Link className="button secondary" href={`/campaigns/${campaign.id}/admin`}>GM Admin</Link>}
          <a className="button secondary" href={`https://github.com/${campaign.owner}/${campaign.repo}`}>Open GitHub</a>
        </div>
      </header>
      <CampaignClient campaign={campaign} categories={categories} />
    </main>
  );
}

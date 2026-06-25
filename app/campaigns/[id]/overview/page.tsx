import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { loadCampaignTheme } from "@/lib/public-site";
import { themeToCssVars } from "@/lib/theme";
import OverviewClient from "./overview-client";

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");

  const canManage = campaign.role === "owner" || campaign.role === "gm";
  const theme = await loadCampaignTheme(campaign);
  const themeVars = themeToCssVars(theme) as CSSProperties;
  return (
    <main className="app-shell" data-theme={theme.preset || undefined} style={themeVars}>
      <header className="topbar">
        <div>
          <Link href={`/campaigns/${campaign.id}`} className="quiet-link">{campaign.name}</Link>
          <h1>Overview</h1>
          <p className="muted">{canManage ? "Your campaign at a glance — arrange the widgets below." : "Your campaign at a glance."}</p>
        </div>
      </header>
      <OverviewClient campaign={campaign} canManage={canManage} />
    </main>
  );
}

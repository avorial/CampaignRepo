import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { loadCampaignTheme } from "@/lib/public-site";
import { themeToCssVars } from "@/lib/theme";
import GraphClient from "../graph/graph-client";

export default async function FamilyTreePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");
  const theme = await loadCampaignTheme(campaign, user.githubToken);
  const themeVars = themeToCssVars(theme) as CSSProperties;
  return (
    <main className="app-shell family-tree-app" data-theme={theme.preset || undefined} style={themeVars}>
      <header className="topbar">
        <div>
          <Link href={`/campaigns/${campaign.id}`} className="quiet-link">{campaign.name}</Link>
          <h1>Family tree</h1>
          <p className="muted">Trace bloodlines, marriages, siblings, guardians, and succession separately from the relationship graph.</p>
        </div>
      </header>
      <GraphClient campaignId={campaign.id} mode="family" />
    </main>
  );
}

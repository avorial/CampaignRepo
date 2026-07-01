import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { readPageCache, refreshPageCache } from "@/lib/page-cache";
import { loadCampaignTheme } from "@/lib/public-site";
import { themeToCssVars } from "@/lib/theme";
import ForkProposalClient from "./fork-proposal-client";

export default async function ForkProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");
  if (!canManageCampaign(user.id, campaign.id)) redirect(`/campaigns/${campaign.id}`);
  if (!campaign.forkOf) redirect(`/campaigns/${campaign.id}`);

  const storage = getStorageAdapter(campaign, user.githubToken);
  let pages: { slug: string; name: string }[] = [];
  if (storage) {
    try {
      const cache = readPageCache(campaign.id);
      const cached = cache.pages.length ? cache : await refreshPageCache(storage, campaign);
      pages = cached.pages.map((p) => ({ slug: p.slug, name: p.frontmatter.name || p.slug }));
    } catch { /* ignore */ }
  }

  const theme = await loadCampaignTheme(campaign, user.githubToken);
  const themeVars = themeToCssVars(theme) as CSSProperties;

  return (
    <main className="app-shell" data-theme={theme.preset || undefined} style={themeVars}>
      <header className="topbar">
        <div>
          <Link href={`/campaigns/${campaign.id}`} className="quiet-link">{campaign.name}</Link>
          <h1>Propose changes</h1>
          <p className="muted">Send selected pages back to the source world at <code>/site/{campaign.forkOf}</code>.</p>
        </div>
      </header>
      <ForkProposalClient campaignId={campaign.id} forkOf={campaign.forkOf} pages={pages} />
    </main>
  );
}

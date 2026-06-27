import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { loadCampaignCategories } from "@/lib/categories";
import { loadCampaignTheme } from "@/lib/public-site";
import { themeToCssVars } from "@/lib/theme";
import PageEditor from "./page-editor";

export default async function WikiPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id, slug } = await params;
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
          <h1>Wiki page</h1>
        </div>
        <a className="button secondary" href={`https://github.com/${campaign.owner}/${campaign.repo}/tree/${campaign.branch}/wiki/pages/${slug}.md`}>Open source</a>
      </header>
      <PageEditor campaign={campaign} slug={slug} categories={categories} />
    </main>
  );
}

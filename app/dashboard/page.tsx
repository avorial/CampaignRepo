import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listCampaigns } from "@/lib/db";
import { categories, gameTypes } from "@/lib/templates";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const campaigns = listCampaigns(user.id);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CampaignRepo</p>
          <h1>Campaign dashboard</h1>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="secondary">Sign out</button>
        </form>
      </header>

      <DashboardClient user={user} campaigns={campaigns} gameTypes={gameTypes} categories={categories} />

      <section className="band">
        <h2>Connected repos</h2>
        <div className="repo-grid">
          {campaigns.map((campaign) => (
            <Link className="repo-card" key={campaign.id} href={`/campaigns/${campaign.id}`}>
              <strong>{campaign.name}</strong>
              <span>{campaign.owner}/{campaign.repo}</span>
              <small>{campaign.gameType} · {campaign.branch} · {campaign.role}</small>
            </Link>
          ))}
          {!campaigns.length && <p className="muted">No campaign repos connected yet.</p>}
        </div>
      </section>
    </main>
  );
}

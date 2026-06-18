import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listCampaigns } from "@/lib/db";
import { isGitHubAppConfigured } from "@/lib/github";
import { categories, gameTypes } from "@/lib/templates";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const campaigns = listCampaigns(user.id);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CampaignRepo</p>
          <h1>Campaign dashboard</h1>
        </div>
        <div className="topbar-actions">
          {user.isAdmin && <Link className="button secondary" href="/admin">Global Admin</Link>}
          <Link className="button secondary" href="/getting-started">Getting started</Link>
          <form action="/api/auth/logout" method="post">
            <button className="secondary">Sign out</button>
          </form>
        </div>
      </header>

      <DashboardClient user={user} campaigns={campaigns} gameTypes={gameTypes} categories={categories} githubAppConfigured={isGitHubAppConfigured()} />
    </main>
  );
}

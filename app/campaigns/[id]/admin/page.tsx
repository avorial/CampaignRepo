import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import AdminClient from "./admin-client";

export default async function AdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");
  if (campaign.role !== "owner" && campaign.role !== "gm") redirect(`/campaigns/${campaign.id}`);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <Link href={`/campaigns/${campaign.id}`} className="quiet-link">{campaign.name}</Link>
          <h1>GM Admin</h1>
          <p className="muted">Manage table access before real testing starts.</p>
        </div>
        <a className="button secondary" href={`https://github.com/${campaign.owner}/${campaign.repo}`}>Open GitHub</a>
      </header>
      <AdminClient campaign={campaign} />
    </main>
  );
}

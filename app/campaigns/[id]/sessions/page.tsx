import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import SessionsClient from "./sessions-client";

export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
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
          <h1>Sessions</h1>
          <p className="muted">Prep and run sessions — agenda, pinned pages, and private notes, stored in the repo.</p>
        </div>
      </header>
      <SessionsClient campaign={campaign} />
    </main>
  );
}

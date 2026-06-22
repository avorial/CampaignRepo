import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import MapsClient from "./maps-client";

export default async function MapsPage({ params }: { params: Promise<{ id: string }> }) {
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
          <h1>Maps</h1>
          <p className="muted">Pin pages to map images — click a pin to open its article.</p>
        </div>
        <Link className="button secondary" href={`/campaigns/${campaign.id}`}>Back to campaign</Link>
      </header>
      <MapsClient campaign={campaign} />
    </main>
  );
}

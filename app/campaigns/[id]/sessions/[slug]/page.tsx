import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import SessionEditor from "./session-editor";

export default async function SessionPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");
  if (campaign.role !== "owner" && campaign.role !== "gm") redirect(`/campaigns/${campaign.id}`);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <Link href={`/campaigns/${campaign.id}/sessions`} className="quiet-link">Sessions</Link>
          <h1>Session</h1>
        </div>
      </header>
      <SessionEditor campaign={campaign} slug={slug} />
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import QuestEditor from "./quest-editor";

export default async function QuestPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
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
          <Link href={`/campaigns/${campaign.id}/quests`} className="quiet-link">Quests</Link>
          <h1>Quest</h1>
        </div>
      </header>
      <QuestEditor campaign={campaign} slug={slug} />
    </main>
  );
}

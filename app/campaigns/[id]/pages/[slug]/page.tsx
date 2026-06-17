import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import PageEditor from "./page-editor";

export default async function WikiPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <Link href={`/campaigns/${campaign.id}`} className="quiet-link">{campaign.name}</Link>
          <h1>Wiki page</h1>
        </div>
        <a className="button secondary" href={`https://github.com/${campaign.owner}/${campaign.repo}/tree/${campaign.branch}/wiki/pages/${slug}.md`}>Open source</a>
      </header>
      <PageEditor campaign={campaign} slug={slug} />
    </main>
  );
}

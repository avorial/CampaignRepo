import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { redirect } from "next/navigation";
import { readPageCache } from "@/lib/page-cache";
import AIChatClient from "./ai-chat-client";

export default async function AIChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) redirect("/dashboard");
  if (!canManageCampaign(user.id, campaign.id)) redirect(`/campaigns/${id}`);

  const cached = readPageCache(campaign.id);
  const pages = cached.pages.map((p) => ({ slug: p.slug, name: p.frontmatter.name || p.slug, category: p.frontmatter.category || "" }));

  return <AIChatClient campaign={campaign} pages={pages} />;
}

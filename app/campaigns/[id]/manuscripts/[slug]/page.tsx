import { redirect } from "next/navigation";

// Deep-link to a specific manuscript: redirect to list page with hash
export default async function ManuscriptSlugPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  redirect(`/campaigns/${id}/manuscripts#${slug}`);
}

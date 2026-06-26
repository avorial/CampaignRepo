import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.role === "player") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const commits = await storage.listFileCommits(`wiki/pages/${slug}.md`);
  return NextResponse.json(commits);
}

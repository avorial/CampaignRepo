import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { getContentAtRef } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string; slug: string }> }) {
  const user = await requireUser();
  const { id, slug } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (campaign.role === "player") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const sha = url.searchParams.get("sha");

  if (sha) {
    if (!user.githubToken) return NextResponse.json({ error: "GitHub token required to view historical content" }, { status: 400 });
    if (campaign.storageBackend !== "github") return NextResponse.json({ error: "History restore requires GitHub storage" }, { status: 400 });
    const item = await getContentAtRef(user.githubToken, campaign, `wiki/pages/${slug}.md`, sha);
    const text = Buffer.from(item.content, "base64").toString("utf8");
    return NextResponse.json({ text });
  }

  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const commits = await storage.listFileCommits(`wiki/pages/${slug}.md`);
  return NextResponse.json(commits);
}

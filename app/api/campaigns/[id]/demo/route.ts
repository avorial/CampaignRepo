import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";
import { serializePage } from "@/lib/markdown";
import { defaultFrontmatter } from "@/lib/templates";
import { demoPagesFor } from "@/lib/demo-data";
import { scheduleSearchIndexRebuild } from "@/lib/search";
import { readPageCache, refreshPageCache } from "@/lib/page-cache";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

// Report how many demo pages currently exist in the repo.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const count = readPageCache(campaign.id).pages.filter((p) => p.frontmatter.sourceImport === "demo").length;
  return NextResponse.json({ count });
}

// Seed the game system's demo pages into the repo (skips any that already exist).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pages = demoPagesFor(campaign.gameType);
  let created = 0;
  let skipped = 0;
  try {
    for (const page of pages) {
      const path = `wiki/pages/${page.slug}.md`;
      try {
        await storage.getTextFile(path);
        skipped++;
        continue; // don't clobber an existing page
      } catch (error) {
        if (!isNotFoundError(error) && (error as { status?: number })?.status !== 404) throw error;
      }
      const frontmatter = {
        ...defaultFrontmatter(page.name, page.category as Category, page.visibility),
        summary: page.summary,
        tags: page.tags,
        sourceImport: "demo",
        lastEditedBy: user.name
      };
      await storage.putFile(path, serializePage(frontmatter, page.body), `CampaignRepo: seed demo page ${page.name}`);
      created++;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not seed demo data.";
    return NextResponse.json({ error: message, created, skipped }, { status: 400 });
  }
  const snapshot = await refreshPageCache(storage, campaign);
  if (created) scheduleSearchIndexRebuild(campaign);
  const count = snapshot.pages.filter((p) => p.frontmatter.sourceImport === "demo").length;
  return NextResponse.json({ created, skipped, total: pages.length, count });
}

// Remove every demo page (frontmatter sourceImport === "demo") from the repo.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let removed = 0;
  try {
    const snapshot = await refreshPageCache(storage, campaign);
    const demoPages = snapshot.pages.filter((p) => p.frontmatter.sourceImport === "demo");
    for (const page of demoPages) {
      if (!page.sha) continue;
      await storage.deleteFile(`wiki/pages/${page.slug}.md`, `CampaignRepo: remove demo page ${page.frontmatter.name}`, page.sha);
      removed++;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove demo data.";
    return NextResponse.json({ error: message, removed }, { status: 400 });
  }
  const snapshot = await refreshPageCache(storage, campaign);
  if (removed) scheduleSearchIndexRebuild(campaign);
  const count = snapshot.pages.filter((p) => p.frontmatter.sourceImport === "demo").length;
  return NextResponse.json({ removed, count });
}

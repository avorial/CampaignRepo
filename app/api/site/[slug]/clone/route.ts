import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getCampaignRepositoryToken, getDb, getPublicSiteCampaign, incrementCloneCount } from "@/lib/db";
import { commitFiles, createRepo, getContent, GitHubError, initializeRepo, isGitHubAppConnection } from "@/lib/github";
import { loadCampaignTheme, loadPublicPages, saveCampaignTheme } from "@/lib/public-site";
import { serializePage } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import type { Campaign } from "@/lib/types";

// Clone a published world into a NEW GitHub repo + campaign owned by the viewer.
// Cloning always targets GitHub (GitHub App access is blocked).
export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to clone this world." }, { status: 401 });
  if (!user.githubToken) return NextResponse.json({ error: "Connect GitHub to clone a world into your own repo." }, { status: 400 });
  if (isGitHubAppConnection(user.githubToken)) {
    return NextResponse.json({ error: "Cloning creates a new repo, which needs a GitHub token (not an App connection)." }, { status: 400 });
  }
  const { slug } = await params;
  const source = getPublicSiteCampaign(slug);
  if (!source) return NextResponse.json({ error: "World not found." }, { status: 404 });

  try {
    const [pages, theme] = await Promise.all([loadPublicPages(source), loadCampaignTheme(source)]);

    // 1. A fresh private repo + campaign, owned by the cloner.
    const repoName = `${slugify(source.name) || "campaign"}-${crypto.randomBytes(3).toString("hex")}`;
    const created = await createRepo(user.githubToken, repoName, true);
    const insert = getDb()
      .prepare("INSERT INTO campaigns (userId, name, owner, repo, branch, gameType, storageBackend) VALUES (?, ?, ?, ?, ?, ?, 'github')")
      .run(user.id, `${source.name} (clone)`, created.owner.login, created.name, created.default_branch || "main", source.gameType);
    getDb().prepare("INSERT OR IGNORE INTO campaign_memberships (campaignId, userId, role) VALUES (?, ?, 'owner')").run(insert.lastInsertRowid, user.id);
    const campaign = getDb().prepare("SELECT * FROM campaigns WHERE id = ?").get(insert.lastInsertRowid) as Campaign;
    await initializeRepo(user.githubToken, campaign);

    // 2. Copy the public (player-visible, approved) pages + referenced media in one commit.
    const files: { path: string; content: string; encoding?: "utf-8" | "base64" }[] = pages.map((page) => ({
      path: `wiki/pages/${page.slug}.md`,
      content: serializePage(page.frontmatter, page.content)
    }));

    // Media is a GitHub-specific copy — get the source repo token directly for this step.
    const sourceToken = getCampaignRepositoryToken(source.id);
    if (sourceToken) {
      const mediaNames = new Set<string>();
      for (const page of pages) {
        for (const m of page.content.matchAll(/\/wiki\/media\/([^\s)"'#?]+)/g)) {
          const name = decodeURIComponent(m[1]).split("/").pop();
          if (name) mediaNames.add(name);
        }
        const cover = page.frontmatter.cover ? String(page.frontmatter.cover) : "";
        if (cover && !/^https?:/i.test(cover)) {
          const name = cover.replace(/^\/?wiki\/media\//, "").split("/").pop();
          if (name) mediaNames.add(name);
        }
      }
      for (const name of mediaNames) {
        try {
          const item = await getContent(sourceToken, source, `wiki/media/${name}`);
          // The Contents API returns "" for files > 1MB; those are skipped.
          if (item.content) files.push({ path: `wiki/media/${name}`, content: item.content.replace(/\s/g, ""), encoding: "base64" });
        } catch {
          /* skip missing/oversized media */
        }
      }
    }

    if (files.length) await commitFiles(user.githubToken, campaign, files, `CampaignRepo: clone from ${source.name}`);
    await saveCampaignTheme(campaign, theme);
    incrementCloneCount(source.id);

    return NextResponse.json({ campaignId: campaign.id });
  } catch (error) {
    const message =
      error instanceof GitHubError
        ? `GitHub error${error.status ? ` ${error.status}` : ""}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Could not clone world.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

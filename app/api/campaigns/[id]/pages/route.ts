import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign, getCampaignRepositoryToken } from "@/lib/db";
import { getTextFile, GitHubError, putFile } from "@/lib/github";
import { parsePage, serializePage } from "@/lib/markdown";
import { sanitizePlayerPage } from "@/lib/public-site";
import { categoryIds, defaultFrontmatter, starterBody } from "@/lib/templates";
import { slugify } from "@/lib/slug";
import { rebuildSearchIndex } from "@/lib/search";
import { readPageCache, refreshPageCache, refreshPageCacheInBackground } from "@/lib/page-cache";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1),
  category: z.enum(categoryIds),
  visibility: z.enum(["gm", "players"]).default("gm"),
  templatePath: z.string().optional()
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const repoToken = getCampaignRepositoryToken(campaign.id);
  if (!repoToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const cached = readPageCache(campaign.id);
  const waitForRefresh = url.searchParams.get("refresh") === "wait" || cached.pages.length === 0;
  let snapshot;
  try {
    snapshot = waitForRefresh ? await refreshPageCache(repoToken, campaign) : cached;
  } catch (error) {
    return NextResponse.json(
      { pages: cached.pages, error: error instanceof Error ? error.message : "Could not refresh campaign pages." },
      { status: cached.pages.length ? 200 : 503 }
    );
  }
  if (!waitForRefresh) refreshPageCacheInBackground(repoToken, campaign);
  const pages = snapshot.pages;
  const mode = url.searchParams.get("mode");
  const visiblePages =
    campaign.role === "player" || mode === "player"
      ? pages
          .filter((page) => page.frontmatter.visibility === "players" && page.frontmatter.approvalStatus === "approved")
          .map(sanitizePlayerPage)
      : pages;
  return NextResponse.json({
    pages: visiblePages,
    cache: {
      cached: !waitForRefresh,
      refreshedAt: snapshot.refreshedAt,
      refreshError: snapshot.refreshError
    }
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign || !user.githubToken) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const input = schema.parse(await req.json());
    const slug = slugify(input.name);
    const pagePath = `wiki/pages/${slug}.md`;
    try {
      await getTextFile(user.githubToken, campaign, pagePath);
      return NextResponse.json(
        { error: `An entry named "${input.name}" already exists. Open the existing entry or choose a different name.`, slug },
        { status: 409 }
      );
    } catch (error) {
      if (!(error instanceof GitHubError && error.status === 404)) throw error;
    }
    let frontmatter = defaultFrontmatter(input.name, input.category, input.visibility);
    let content = starterBody(input.name, input.category, campaign.gameType as any);
    if (input.templatePath?.startsWith("wiki/templates/") && input.templatePath.endsWith(".md")) {
      const template = await getTextFile(user.githubToken, campaign, input.templatePath);
      const parsedTemplate = parsePage(slug, template.text, template.sha);
      frontmatter = {
        ...parsedTemplate.frontmatter,
        name: input.name,
        category: input.category,
        type: input.category,
        visibility: input.visibility,
        approvalStatus: "approved",
        knownToPlayers: input.visibility === "players",
        sourceImport: undefined,
        lastEditedBy: user.name
      };
      content = parsedTemplate.content.replace(/^# .*/m, `# ${input.name}`);
    }
    await putFile(user.githubToken, campaign, pagePath, serializePage(frontmatter, content), `CampaignRepo: create ${input.name}`);
    try {
      await rebuildSearchIndex(user.githubToken, campaign);
      return NextResponse.json({ slug });
    } catch (error) {
      console.error(`Page ${pagePath} was created, but the search index could not be rebuilt.`, error);
      return NextResponse.json({ slug, warning: "Entry created, but the search index could not be refreshed." });
    }
  } catch (error) {
    if (error instanceof GitHubError && /sha[\s\S]*supplied/i.test(error.message)) {
      return NextResponse.json(
        { error: "An entry with that name was created before this request completed. Open the existing entry or choose a different name." },
        { status: 409 }
      );
    }
    const message =
      error instanceof GitHubError
        ? `GitHub error${error.status ? ` ${error.status}` : ""}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Could not create page.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

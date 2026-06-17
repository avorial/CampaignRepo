import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign, listCampaigns, searchDocs } from "@/lib/db";
import { getTextFile, listDirectory, putFile } from "@/lib/github";
import { parsePage, serializePage, stripGmBlocks } from "@/lib/markdown";
import { defaultFrontmatter, gameTypes, starterBody } from "@/lib/templates";
import { slugify } from "@/lib/slug";
import { rebuildSearchIndex } from "@/lib/search";
import type { Campaign, CampaignGraphEdge, CampaignGraphNode, CampaignMedia, CampaignTimelineItem, Category, GameType, WikiPage, WikiTemplate } from "@/lib/types";

type RpcRequest = {
  jsonrpc?: "2.0";
  id?: string | number;
  method: string;
  params?: any;
};

function rpc(id: RpcRequest["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function requireManage(userId: number, campaign: Campaign) {
  if (!canManageCampaign(userId, campaign.id)) throw new Error("Forbidden");
}

function visibleForRole(page: WikiPage, role?: string) {
  if (role !== "player") return true;
  return page.frontmatter.visibility === "players" && page.frontmatter.approvalStatus === "approved";
}

function mediaType(name: string): CampaignMedia["mediaType"] {
  const lower = name.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(lower)) return "audio";
  return "other";
}

function mediaMarkdown(name: string, type: CampaignMedia["mediaType"]) {
  return type === "image" ? `![${name}](/wiki/media/${name})` : `[${name}](/wiki/media/${name})`;
}

async function listMcpTemplates(token: string, campaign: Campaign): Promise<WikiTemplate[]> {
  const rootEntries = await listDirectory(token, campaign, "wiki/templates");
  const templates: WikiTemplate[] = [];
  for (const dir of rootEntries.filter((entry) => entry.type === "dir")) {
    const entries = await listDirectory(token, campaign, dir.path);
    for (const entry of entries.filter((item) => item.type === "file" && item.name.endsWith(".md"))) {
      const file = await getTextFile(token, campaign, entry.path);
      const slug = entry.name.replace(/\.md$/, "");
      const page = parsePage(slug, file.text, file.sha);
      templates.push({
        slug,
        path: entry.path,
        sha: file.sha,
        gameType: dir.name as GameType,
        category: page.frontmatter.category,
        name: page.frontmatter.name,
        summary: page.frontmatter.summary,
        content: page.content
      });
    }
  }
  return templates.sort((a, b) => `${a.gameType}:${a.category}:${a.name}`.localeCompare(`${b.gameType}:${b.category}:${b.name}`));
}

async function listMcpMedia(token: string, campaign: Campaign): Promise<CampaignMedia[]> {
  const entries = await listDirectory(token, campaign, "wiki/media");
  return entries
    .filter((entry) => entry.type === "file" && entry.name !== ".gitkeep")
    .map((entry) => {
      const type = mediaType(entry.name);
      return {
        name: entry.name,
        path: entry.path,
        sha: entry.sha,
        size: (entry as any).size,
        downloadUrl: (entry as any).download_url || undefined,
        mediaType: type,
        markdown: mediaMarkdown(entry.name, type)
      };
    });
}

async function buildMcpGraph(token: string, campaign: Campaign) {
  const entries = await listDirectory(token, campaign, "wiki/pages");
  const allPages = await Promise.all(
    entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, "");
        const file = await getTextFile(token, campaign, entry.path);
        const text = campaign.role === "player" ? stripGmBlocks(file.text) : file.text;
        return parsePage(slug, text, file.sha);
      })
  );
  const pages = allPages.filter((page) => visibleForRole(page, campaign.role));
  const aliases = new Map<string, string>();
  for (const page of pages) {
    aliases.set(page.slug.toLowerCase(), page.slug);
    aliases.set(page.frontmatter.name.toLowerCase(), page.slug);
    for (const alias of page.frontmatter.aliases) aliases.set(alias.toLowerCase(), page.slug);
  }
  const visibleSlugs = new Set(pages.map((page) => page.slug));
  const backlinks = new Map<string, string[]>();
  const edges: CampaignGraphEdge[] = [];
  for (const page of pages) {
    for (const link of page.outgoingLinks) {
      const target = aliases.get(link.target.toLowerCase()) || slugify(link.target);
      const missing = !visibleSlugs.has(target);
      if (!missing) backlinks.set(target, [...(backlinks.get(target) || []), page.slug]);
      if (campaign.role !== "player" || !missing) edges.push({ source: page.slug, target, label: link.label, missing });
    }
  }
  const nodes: CampaignGraphNode[] = pages.map((page) => ({
    slug: page.slug,
    name: page.frontmatter.name,
    category: page.frontmatter.category,
    summary: page.frontmatter.summary,
    tags: page.frontmatter.tags,
    visibility: page.frontmatter.visibility,
    approvalStatus: page.frontmatter.approvalStatus,
    keyLinks: page.frontmatter.keyLinks,
    outgoingLinks: page.outgoingLinks.map((link) => aliases.get(link.target.toLowerCase()) || slugify(link.target)).filter((target) => campaign.role !== "player" || visibleSlugs.has(target)),
    backlinks: backlinks.get(page.slug) || []
  }));
  const timeline: CampaignTimelineItem[] = pages
    .filter((page) => page.frontmatter.category === "event")
    .map((page) => ({
      slug: page.slug,
      name: page.frontmatter.name,
      summary: page.frontmatter.summary,
      eventDate: page.frontmatter.eventDate || page.frontmatter.timelineDate,
      tags: page.frontmatter.tags,
      visibility: page.frontmatter.visibility,
      approvalStatus: page.frontmatter.approvalStatus
    }))
    .sort((a, b) => (a.eventDate || "9999").localeCompare(b.eventDate || "9999") || a.name.localeCompare(b.name));
  return { nodes, edges, timeline };
}

async function listReviewPages(token: string, campaign: Campaign) {
  const entries = await listDirectory(token, campaign, "wiki/pages");
  const pages = await Promise.all(
    entries
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const slug = entry.name.replace(/\.md$/, "");
        const file = await getTextFile(token, campaign, entry.path);
        return parsePage(slug, file.text, file.sha);
      })
  );
  return pages.filter((page) => page.frontmatter.approvalStatus !== "approved").map((page) => ({
    slug: page.slug,
    name: page.frontmatter.name,
    category: page.frontmatter.category,
    visibility: page.frontmatter.visibility,
    approvalStatus: page.frontmatter.approvalStatus,
    summary: page.frontmatter.summary,
    lastEditedBy: page.frontmatter.lastEditedBy
  }));
}

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({
    name: "CampaignRepo MCP",
    resources: [
      "campaignrepo://campaigns",
      "campaignrepo://campaign/{campaignId}/pages",
      "campaignrepo://campaign/{campaignId}/page/{slug}",
      "campaignrepo://campaign/{campaignId}/search",
      "campaignrepo://campaign/{campaignId}/templates",
      "campaignrepo://campaign/{campaignId}/media",
      "campaignrepo://campaign/{campaignId}/graph"
    ],
    tools: [
      "search_campaign",
      "search_all_repos",
      "get_page",
      "create_page",
      "propose_page_update",
      "list_templates",
      "create_template",
      "list_media",
      "get_campaign_graph",
      "list_review_queue",
      "review_page",
      "get_repo_setup_instructions"
    ],
    user: { id: user.id, email: user.email }
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = (await req.json()) as RpcRequest;
  const params = body.params || {};

  if (body.method === "resources/list") {
    return rpc(body.id, {
      resources: listCampaigns(user.id).map((campaign) => ({
        uri: `campaignrepo://campaign/${campaign.id}/pages`,
        name: campaign.name,
        description: `${campaign.owner}/${campaign.repo}`
      }))
    });
  }

  if (body.method === "tools/list") {
    return rpc(body.id, {
      tools: [
        { name: "search_campaign", description: "Search one campaign repo." },
        { name: "search_all_repos", description: "Search all repos authorized for the user." },
        { name: "get_page", description: "Read a wiki page." },
        { name: "create_page", description: "Create an unapproved AI wiki page." },
        { name: "propose_page_update", description: "Commit an unapproved AI update to a page." },
        { name: "list_templates", description: "List campaign templates grouped by game type." },
        { name: "create_template", description: "Create a campaign template in the repo." },
        { name: "list_media", description: "List uploaded campaign media and Markdown links." },
        { name: "get_campaign_graph", description: "Return relationship graph and timeline data." },
        { name: "list_review_queue", description: "List unapproved or rejected pages awaiting GM review." },
        { name: "review_page", description: "Approve or reject a page from the GM review queue." },
        { name: "get_repo_setup_instructions", description: "Return instructions for building or repairing a campaign repo." }
      ]
    });
  }

  if (body.method === "tools/call") {
    const name = params.name;
    const args = params.arguments || {};
    if (name === "search_campaign" || name === "search_all_repos") {
      return rpc(body.id, { content: searchDocs(user.id, args.query || "", name === "search_campaign" ? Number(args.campaignId) : undefined, "gm") });
    }
    if (name === "get_page") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
      const file = await getTextFile(user.githubToken, campaign, `wiki/pages/${args.slug}.md`);
      const page = parsePage(args.slug, file.text, file.sha);
      if (campaign.role === "player" && (page.frontmatter.visibility !== "players" || page.frontmatter.approvalStatus !== "approved")) {
        throw new Error("Forbidden");
      }
      return rpc(body.id, { content: campaign.role === "player" ? parsePage(args.slug, stripGmBlocks(file.text), file.sha) : page });
    }
    if (name === "create_page") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
      if (!canManageCampaign(user.id, campaign.id)) throw new Error("Forbidden");
      const title = String(args.name || "AI Draft");
      const slug = slugify(title);
      const fm = { ...defaultFrontmatter(title, args.category || "npc", "gm"), approvalStatus: "unapproved" as const, lastEditedBy: "AI via MCP" };
      const content = args.content || starterBody(title, fm.category, campaign.gameType as any);
      await putFile(user.githubToken, campaign, `wiki/pages/${slug}.md`, serializePage(fm, content), `CampaignRepo MCP: create unapproved ${title}`);
      await rebuildSearchIndex(user.githubToken, campaign);
      return rpc(body.id, { slug, approvalStatus: "unapproved" });
    }
    if (name === "propose_page_update") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
      if (!canManageCampaign(user.id, campaign.id)) throw new Error("Forbidden");
      const current = await getTextFile(user.githubToken, campaign, `wiki/pages/${args.slug}.md`);
      const page = parsePage(args.slug, current.text, current.sha);
      const fm = { ...page.frontmatter, ...(args.frontmatter || {}), approvalStatus: "unapproved" as const, lastEditedBy: "AI via MCP" };
      await putFile(user.githubToken, campaign, `wiki/pages/${args.slug}.md`, serializePage(fm, args.content || page.content), `CampaignRepo MCP: propose update ${fm.name}`, current.sha);
      await rebuildSearchIndex(user.githubToken, campaign);
      return rpc(body.id, { ok: true, approvalStatus: "unapproved" });
    }
    if (name === "list_templates") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
      requireManage(user.id, campaign);
      return rpc(body.id, { content: await listMcpTemplates(user.githubToken, campaign) });
    }
    if (name === "create_template") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
      requireManage(user.id, campaign);
      const templateName = String(args.name || "AI Template");
      const gameType = gameTypes.includes(args.gameType) ? (args.gameType as GameType) : (campaign.gameType as GameType);
      const category = (["character", "npc", "location", "event", "game"].includes(args.category) ? args.category : "npc") as Category;
      const slug = slugify(templateName);
      const frontmatter = {
        ...defaultFrontmatter(templateName, category, "gm"),
        summary: String(args.summary || ""),
        tags: Array.isArray(args.tags) ? args.tags.map(String) : ["template", category],
        approvalStatus: "approved" as const,
        lastEditedBy: "AI via MCP"
      };
      const content = String(args.content || starterBody(templateName, category, gameType));
      const path = `wiki/templates/${gameType}/${slug}.md`;
      await putFile(user.githubToken, campaign, path, serializePage(frontmatter, content), `CampaignRepo MCP: create template ${templateName}`);
      return rpc(body.id, { template: { slug, path, gameType, category, name: templateName, summary: frontmatter.summary } });
    }
    if (name === "list_media") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
      requireManage(user.id, campaign);
      return rpc(body.id, { content: await listMcpMedia(user.githubToken, campaign) });
    }
    if (name === "get_campaign_graph") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
      return rpc(body.id, { content: await buildMcpGraph(user.githubToken, campaign) });
    }
    if (name === "list_review_queue") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
      requireManage(user.id, campaign);
      return rpc(body.id, { content: await listReviewPages(user.githubToken, campaign) });
    }
    if (name === "review_page") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
      requireManage(user.id, campaign);
      const decision = args.decision === "rejected" ? "rejected" : "approved";
      const current = await getTextFile(user.githubToken, campaign, `wiki/pages/${args.slug}.md`);
      const page = parsePage(args.slug, current.text, current.sha);
      const frontmatter = {
        ...page.frontmatter,
        approvalStatus: decision as "approved" | "rejected",
        lastEditedBy: "GM review via MCP"
      };
      await putFile(user.githubToken, campaign, `wiki/pages/${args.slug}.md`, serializePage(frontmatter, page.content), `CampaignRepo MCP: ${decision} ${frontmatter.name}`, current.sha);
      await rebuildSearchIndex(user.githubToken, campaign);
      return rpc(body.id, { ok: true, approvalStatus: decision });
    }
    if (name === "get_repo_setup_instructions") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign) throw new Error("Campaign not found");
      return rpc(body.id, {
        content: `Build or connect https://github.com/${campaign.owner}/${campaign.repo}. Required folders: /wiki/pages, /wiki/media, /wiki/templates/${campaign.gameType}, /wiki/imports/characters, /wiki/search/index.json, /wiki/campaign.yaml.`
      });
    }
  }

  return NextResponse.json({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "Method not found" } }, { status: 404 });
}

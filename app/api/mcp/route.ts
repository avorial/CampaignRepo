import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCampaign, listCampaigns, searchDocs } from "@/lib/db";
import { getTextFile, putFile } from "@/lib/github";
import { parsePage, serializePage } from "@/lib/markdown";
import { defaultFrontmatter, starterBody } from "@/lib/templates";
import { slugify } from "@/lib/slug";
import { rebuildSearchIndex } from "@/lib/search";

type RpcRequest = {
  jsonrpc?: "2.0";
  id?: string | number;
  method: string;
  params?: any;
};

function rpc(id: RpcRequest["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

export async function GET() {
  const user = await requireUser();
  return NextResponse.json({
    name: "CampaignRepo MCP",
    resources: [
      "campaignrepo://campaigns",
      "campaignrepo://campaign/{campaignId}/pages",
      "campaignrepo://campaign/{campaignId}/page/{slug}",
      "campaignrepo://campaign/{campaignId}/search"
    ],
    tools: ["search_campaign", "search_all_repos", "get_page", "create_page", "propose_page_update", "get_repo_setup_instructions"],
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
      return rpc(body.id, { content: parsePage(args.slug, file.text, file.sha) });
    }
    if (name === "create_page") {
      const campaign = getCampaign(user.id, Number(args.campaignId));
      if (!campaign || !user.githubToken) throw new Error("Campaign not found");
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
      const current = await getTextFile(user.githubToken, campaign, `wiki/pages/${args.slug}.md`);
      const page = parsePage(args.slug, current.text, current.sha);
      const fm = { ...page.frontmatter, ...(args.frontmatter || {}), approvalStatus: "unapproved" as const, lastEditedBy: "AI via MCP" };
      await putFile(user.githubToken, campaign, `wiki/pages/${args.slug}.md`, serializePage(fm, args.content || page.content), `CampaignRepo MCP: propose update ${fm.name}`, current.sha);
      await rebuildSearchIndex(user.githubToken, campaign);
      return rpc(body.id, { ok: true, approvalStatus: "unapproved" });
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

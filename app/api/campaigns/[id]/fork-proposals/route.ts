import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  canManageCampaign,
  createForkProposal,
  createNotifications,
  getCampaign,
  getCampaignGmUserIds,
  getForkProposalsFromCampaign,
  getPublicSiteCampaign,
  updateForkProposalStatus
} from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  pages: z.array(z.string()).min(1).max(100)
});

const updateSchema = z.object({
  proposalId: z.number().int().positive(),
  status: z.enum(["accepted", "rejected"])
});

function githubPullRequestUrl(source: { owner: string; repo: string; branch: string; storageBackend: string } | null, fork: { owner: string; repo: string; branch: string; storageBackend: string }, title: string) {
  if (!source || source.storageBackend !== "github" || fork.storageBackend !== "github") return null;
  if (!source.owner || !source.repo || !fork.owner || !fork.repo) return null;
  const base = encodeURIComponent(source.branch || "main");
  const head = `${fork.owner}:${fork.branch || "main"}`;
  const params = new URLSearchParams({ quick_pull: "1", title });
  return `https://github.com/${source.owner}/${source.repo}/compare/${base}...${head}?${params.toString()}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const proposals = getForkProposalsFromCampaign(campaign.id);
  return NextResponse.json({ proposals });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!campaign.forkOf) return NextResponse.json({ error: "This campaign is not a fork." }, { status: 400 });

  const input = createSchema.parse(await req.json());
  const proposalId = createForkProposal(campaign.id, campaign.forkOf, input.title, input.description ?? null, input.pages, user.id);

  // Notify the source campaign owner
  const source = getPublicSiteCampaign(campaign.forkOf);
  if (source) {
    const gmIds = getCampaignGmUserIds(source.id).filter((uid) => uid !== user.id);
    if (gmIds.length) {
      createNotifications(
        gmIds, source.id, "fork_proposal",
        `Fork proposal: ${input.title}`,
        `${user.name} proposed changes from "${campaign.name}" to your world.`,
        `/campaigns/${source.id}/admin`
      );
    }
  }

  return NextResponse.json({ proposalId, githubPrUrl: githubPullRequestUrl(source, campaign, input.title) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const input = updateSchema.parse(await req.json());
  updateForkProposalStatus(input.proposalId, input.status);
  return NextResponse.json({ ok: true });
}

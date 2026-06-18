import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const markdown = `# CampaignRepo setup: ${campaign.name}

Repository: https://github.com/${campaign.owner}/${campaign.repo}

## Required GitHub access

- Preferred: install the CampaignRepo GitHub App on this repo with contents read/write access.
- Fallback: connect a fine-grained GitHub token with contents read/write access.
- Private repos require either a GitHub App installation on the repo or a token with private repository access.
- Manual GitHub repo creation docs: https://docs.github.com/repositories/creating-and-managing-repositories/creating-a-new-repository

## Expected structure

- \`/wiki/pages\` for Markdown pages
- \`/wiki/media\` for images, maps, PDFs, and audio
- \`/wiki/media/media.json\` for media captions, alt text, and tags
- \`/wiki/templates/${campaign.gameType}\` for game templates
- \`/wiki/imports/characters\` for preserved VTT/source JSON
- \`/wiki/search/index.json\` for the portable search snapshot
- \`/wiki/campaign.yaml\` for campaign settings

## Editing rules

- Use \`[[Page Name]]\` or \`[[Page Name|label]]\` for wiki links.
- Use \`:::gm\` blocks for GM-only sections.
- Keep YAML frontmatter intact.
- AI edits appear immediately to GMs as unapproved until approved.
`;
  return NextResponse.json({ markdown });
}

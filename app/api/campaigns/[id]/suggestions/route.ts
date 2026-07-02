import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createNotifications, getCampaign, getCampaignGmUserIds } from "@/lib/db";
import { parsePage, serializePage } from "@/lib/markdown";
import { refreshPageCacheInBackground } from "@/lib/page-cache";
import { scheduleSearchIndexRebuild } from "@/lib/search";
import { slugify } from "@/lib/slug";
import { getStorageAdapter, isNotFoundError } from "@/lib/storage";
import { defaultFrontmatter } from "@/lib/templates";

export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  category: z.string().trim().min(1).max(40).regex(/^[a-z0-9_/-]+$/),
  summary: z.string().trim().max(240).optional(),
  content: z.string().trim().min(10).max(50_000)
});

async function nextAvailablePath(storage: NonNullable<ReturnType<typeof getStorageAdapter>>, baseSlug: string) {
  for (let index = 0; index < 50; index++) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const slug = `${baseSlug}${suffix}`;
    const path = `wiki/pages/${slug}.md`;
    try {
      await storage.getTextFile(path);
    } catch (error) {
      if (isNotFoundError(error) || (error as any)?.status === 404) return { slug, path };
      throw error;
    }
  }
  const slug = `${baseSlug}-${Date.now().toString(36)}`;
  return { slug, path: `wiki/pages/${slug}.md` };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const storage = getStorageAdapter(campaign);
  if (!storage) return NextResponse.json({ error: "No writable campaign storage is configured." }, { status: 400 });

  try {
    const input = schema.parse(await req.json());
    const baseSlug = slugify(`suggestion-${input.title}`);
    const { slug, path } = await nextAvailablePath(storage, baseSlug);
    const frontmatter = {
      ...defaultFrontmatter(input.title, input.category, "gm"),
      summary: input.summary || `Player suggestion from ${user.name}`,
      approvalStatus: "unapproved" as const,
      knownToPlayers: false,
      sourceImport: "Player suggestion",
      lastEditedBy: user.name
    };
    const body = [
      `# ${input.title}`,
      "",
      input.summary ? `_${input.summary}_` : "",
      "",
      ":::gm",
      `Suggested by: ${user.name} <${user.email}>`,
      `Submitted: ${new Date().toISOString()}`,
      ":::",
      "",
      "## Suggestion",
      "",
      input.content
    ].filter((line, index, lines) => line || lines[index - 1] !== "").join("\n");

    await storage.putFile(path, serializePage(frontmatter, body), `CampaignRepo: add player suggestion ${input.title}`);
    const file = await storage.getTextFile(path);
    parsePage(slug, file.text, file.sha);
    refreshPageCacheInBackground(storage, campaign);
    scheduleSearchIndexRebuild(campaign);

    const gmIds = getCampaignGmUserIds(campaign.id).filter((uid) => uid !== user.id);
    if (gmIds.length) {
      createNotifications(
        gmIds,
        campaign.id,
        "player_suggestion",
        `${user.name} suggested ${input.title}`,
        "A player submitted a draft page for GM review.",
        `/campaigns/${campaign.id}/pages/${slug}`
      );
    }

    return NextResponse.json({ slug });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit suggestion.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

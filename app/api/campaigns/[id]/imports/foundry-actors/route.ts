import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canManageCampaign, getCampaign } from "@/lib/db";
import { getStorageAdapter } from "@/lib/storage";
import { defaultFrontmatter } from "@/lib/templates";
import { serializePage } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import { scheduleSearchIndexRebuild } from "@/lib/search";

export const dynamic = "force-dynamic";

const schema = z.object({
  json: z.unknown(),
  visibility: z.enum(["gm", "players"]).default("gm"),
  approvalStatus: z.enum(["approved", "unapproved", "rejected"]).default("unapproved")
});

type FoundryActor = Record<string, unknown>;
type SysObj = Record<string, unknown>;

const ACTOR_CATEGORY_MAP: Record<string, string> = {
  character: "character",
  pc: "character",
  npc: "npc",
  monster: "npc",
  creature: "creature",
  familiar: "creature",
  hazard: "creature",
  vehicle: "item",
  loot: "item",
  ship: "item",
  starship: "item",
  group: "faction"
};

function mapActorType(type: string): string {
  return ACTOR_CATEGORY_MAP[(type || "").toLowerCase()] ?? "npc";
}

function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return html
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `${"#".repeat(Number(n))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) =>
      inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) => `- ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n")
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
      let n = 0;
      return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m: string, li: string) => `${++n}. ${li.replace(/<[^>]+>/g, "").trim()}\n`) + "\n";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Find the biography HTML regardless of which Foundry system module layout it's in. */
function extractBiography(actor: FoundryActor): string {
  const sys = (actor.system || actor.data) as SysObj | undefined;
  if (!sys) return "";
  const details = sys.details as SysObj | undefined;
  if (details) {
    const bio = details.biography as SysObj | undefined;
    if (bio) {
      if (typeof bio.value === "string") return bio.value;
      if (typeof bio.public === "string") return bio.public;
    }
    if (typeof (details as SysObj).biography === "string") return details.biography as string;
  }
  const desc = sys.description as SysObj | undefined;
  if (desc) {
    if (typeof desc.value === "string") return desc.value;
  }
  if (typeof sys.details === "string") return sys.details;
  return "";
}

/** Build a short stat summary line from whatever the system exposes. */
function extractSummary(actor: FoundryActor): string {
  const sys = (actor.system || actor.data) as SysObj | undefined;
  if (!sys) return "";
  const parts: string[] = [];
  const details = sys.details as SysObj | undefined;
  if (details) {
    if (typeof details.race === "string" && details.race) parts.push(details.race);
    if (typeof details.background === "string" && details.background) parts.push(details.background);
    if (typeof details.alignment === "string" && details.alignment) parts.push(details.alignment);
    const cr = (details as SysObj).cr ?? (details as SysObj).level;
    if (cr !== undefined && cr !== null && cr !== "") parts.push(`CR ${cr}`);
  }
  const traits = sys.traits as SysObj | undefined;
  if (traits) {
    const actorType = (traits.type as SysObj | undefined)?.value;
    if (typeof actorType === "string" && actorType) parts.unshift(actorType);
  }
  return parts.join(", ");
}

function extractActors(raw: unknown): FoundryActor[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is FoundryActor => typeof item === "object" && item !== null && "name" in item);
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.actors)) return extractActors(obj.actors);
    if (Array.isArray(obj.Actor)) return extractActors(obj.Actor);
    if (typeof obj.name === "string" && (typeof obj.type === "string" || typeof obj.system !== "undefined")) {
      return [obj as FoundryActor];
    }
  }
  return [];
}

/** Find an existing page that was imported from this Foundry actor ID. */
async function findExistingByFoundryId(
  storage: ReturnType<typeof import("@/lib/storage").getStorageAdapter>,
  foundryId: string
): Promise<{ path: string; sha: string } | null> {
  if (!storage || !foundryId) return null;
  try {
    const index = await storage.getTextFile("wiki/search/index.json");
    const pages = JSON.parse(index.text) as Array<{ slug: string; foundryId?: string }>;
    const match = pages.find((p) => p.foundryId === foundryId);
    if (!match) return null;
    const path = `wiki/pages/${match.slug}.md`;
    const file = await storage.getTextFile(path);
    return { path, sha: file.sha };
  } catch {
    return null;
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const campaign = getCampaign(user.id, Number(id));
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCampaign(user.id, campaign.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const storage = getStorageAdapter(campaign, user.githubToken);
  if (!storage) return NextResponse.json({ error: "No storage configured" }, { status: 400 });

  const input = schema.parse(await req.json());
  const actors = extractActors(input.json);
  if (!actors.length) return NextResponse.json({ error: "No actors found. Paste a Foundry Actor JSON export or an array of actor objects." }, { status: 400 });

  const results: { slug: string; name: string; created: boolean; error?: string }[] = [];

  for (const actor of actors) {
    const name = typeof actor.name === "string" ? actor.name.trim() : "";
    if (!name) continue;

    const foundryId = typeof actor._id === "string" ? actor._id : undefined;
    const actorType = typeof actor.type === "string" ? actor.type : "npc";
    const category = mapActorType(actorType);
    const bioHtml = extractBiography(actor);
    const body = htmlToMarkdown(bioHtml);
    const summary = extractSummary(actor);

    const slug = slugify(name) || `foundry-actor-${Date.now()}`;
    const path = `wiki/pages/${slug}.md`;

    const frontmatter = {
      ...defaultFrontmatter(name, category),
      summary: summary || (body.split("\n")[0] || "").slice(0, 200),
      visibility: input.visibility as "gm" | "players",
      approvalStatus: input.approvalStatus as "approved" | "unapproved" | "rejected",
      sourceImport: "foundry-actor",
      ...(foundryId ? { foundryId } : {})
    };

    try {
      let existingPath = path;
      let existingSha: string | undefined;

      // Prefer matching by foundryId to update across renames
      if (foundryId) {
        const existing = await findExistingByFoundryId(storage, foundryId);
        if (existing) {
          existingPath = existing.path;
          existingSha = existing.sha;
        } else {
          try { const ex = await storage.getTextFile(path); existingSha = ex.sha; } catch { /* new */ }
        }
      } else {
        try { const ex = await storage.getTextFile(path); existingSha = ex.sha; } catch { /* new */ }
      }

      await storage.putFile(existingPath, serializePage(frontmatter, body), `CampaignRepo: Foundry Actor import — ${name}`, existingSha);
      results.push({ slug, name, created: !existingSha });
    } catch (e) {
      results.push({ slug, name, created: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  scheduleSearchIndexRebuild(campaign);
  const created = results.filter((r) => r.created && !r.error).length;
  const updated = results.filter((r) => !r.created && !r.error).length;
  return NextResponse.json({ results, created, updated, errors: results.filter((r) => r.error).length, total: results.length });
}

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

/** Try to detect the Foundry system module from actor data. */
function detectSystem(actor: FoundryActor): "dnd5e" | "pf2e" | "wod" | "unknown" {
  const sys = actor.system || actor.data;
  if (!sys || typeof sys !== "object") return "unknown";
  const s = sys as SysObj;
  if ("abilities" in s && "attributes" in s && "skills" in s) return "dnd5e";
  if ("saves" in s && "attributes" in s && ("classDC" in s || "ancestry" in s)) return "pf2e";
  if ("willpower" in s || "humanity" in s || "blood" in s) return "wod";
  return "unknown";
}

function strNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

/** Build a dnd-sheet YAML block from a Foundry dnd5e actor. Returns null if not enough data. */
function buildDnDSheetBlock(actor: FoundryActor, name: string): string | null {
  const sys = (actor.system || actor.data) as SysObj | undefined;
  if (!sys) return null;
  const abilities = sys.abilities as Record<string, SysObj> | undefined;
  if (!abilities || !abilities.str) return null;

  const abilScore = (key: string) => strNum(abilities[key]?.value, 10);
  const attrs = sys.attributes as SysObj | undefined;
  const details = sys.details as SysObj | undefined;
  const hp = attrs?.hp as SysObj | undefined;
  const ac = attrs?.ac as SysObj | undefined;
  const spd = attrs?.movement as SysObj | undefined;
  const skills = sys.skills as Record<string, SysObj> | undefined;
  const items = Array.isArray(actor.items) ? actor.items as SysObj[] : [];

  // Level — sum of class item levels or details.level
  let level = strNum(details?.level, 0) || strNum((details?.level as SysObj)?.value, 0);
  if (!level) {
    for (const item of items) {
      if (item.type === "class") level += strNum((item.system as SysObj)?.levels, 1);
    }
  }
  if (!level) level = 1;

  // Class / subclass from items
  const classItem = items.find(i => i.type === "class");
  const subclassItem = items.find(i => i.type === "subclass");
  const cls = typeof classItem?.name === "string" ? classItem.name : (typeof details?.class === "string" ? details.class : "");
  const subcls = typeof subclassItem?.name === "string" ? subclassItem.name : (typeof details?.subclass === "string" ? details.subclass : "");

  // Skills proficient
  const SKILL_MAP: Record<string, string> = {
    acr: "Acrobatics", ani: "Animal Handling", arc: "Arcana", ath: "Athletics",
    dec: "Deception", his: "History", ins: "Insight", itm: "Intimidation",
    inv: "Investigation", med: "Medicine", nat: "Nature", prc: "Perception",
    prf: "Performance", per: "Persuasion", rel: "Religion", slt: "Sleight of Hand",
    ste: "Stealth", sur: "Survival"
  };
  const profSkills: string[] = [];
  const passivePerc = strNum(attrs?.prof, 2) + strNum(abilities.wis?.value, 10);
  if (skills) {
    for (const [key, skill] of Object.entries(skills)) {
      const label = SKILL_MAP[key];
      if (label && (strNum(skill.value, 0) >= 1 || skill.prof === true)) profSkills.push(label);
    }
  }

  // Saving throw proficiencies
  const profSaves: string[] = [];
  const SAVE_LABELS: Record<string, string> = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
  for (const [key, ab] of Object.entries(abilities)) {
    if (ab.proficient || strNum(ab.proficient, 0) > 0) profSaves.push(SAVE_LABELS[key] || key);
  }

  // Attacks from weapon items
  const attacks: { name: string; bonus: string; damage: string }[] = [];
  for (const item of items.slice(0, 20)) {
    if (item.type !== "weapon" && item.type !== "spell") continue;
    const iSys = item.system as SysObj | undefined;
    if (!iSys) continue;
    const atk = (iSys.attack as SysObj | undefined)?.flat;
    const dmg = (iSys.damage as SysObj | undefined);
    const dmgParts = Array.isArray((dmg as SysObj | undefined)?.parts) ? ((dmg as SysObj).parts as unknown[][]).map(p => p[0]).filter(Boolean).join(" + ") : "";
    if (typeof item.name === "string" && (atk || dmgParts)) {
      attacks.push({ name: String(item.name), bonus: atk ? `+${atk}` : "", damage: dmgParts });
    }
  }

  // Features
  const features: string[] = items.filter(i => i.type === "feat" && typeof i.name === "string").slice(0, 12).map(i => String(i.name));

  // Equipment
  const equipment: string[] = items.filter(i => i.type === "equipment" || i.type === "consumable" || i.type === "tool" || i.type === "backpack" || i.type === "loot").slice(0, 20).map(i => String(i.name)).filter(Boolean);

  // Languages / proficiencies
  const traits = sys.traits as SysObj | undefined;
  const langStr = (traits?.languages as SysObj | undefined)?.value;
  const languages: string[] = Array.isArray(langStr) ? langStr.map(String) : (typeof langStr === "string" ? langStr.split(",").map(s => s.trim()).filter(Boolean) : []);
  const toolProf = (traits?.toolProf as SysObj | undefined)?.value;
  const profs: string[] = Array.isArray(toolProf) ? toolProf.map(String) : (typeof toolProf === "string" ? toolProf.split(",").map(s => s.trim()).filter(Boolean) : []);

  // Spellcasting
  let spellsBlock = "";
  const spellAbility = (sys.attributes as SysObj | undefined)?.spellcasting as string | undefined;
  const spellList: SysObj[] = items.filter(i => i.type === "spell") as SysObj[];
  if (spellAbility && spellList.length) {
    const saveDc = strNum((attrs as SysObj)?.spelldc, 0) || strNum((attrs as SysObj)?.spellDC, 0);
    const levels = new Map<number, string[]>();
    for (const sp of spellList) {
      const spSys = sp.system as SysObj | undefined;
      const lvl = strNum((spSys?.level), 0);
      if (!levels.has(lvl)) levels.set(lvl, []);
      if (typeof sp.name === "string") levels.get(lvl)!.push(sp.name);
    }
    const spellLines = [...levels.entries()].sort((a, b) => a[0] - b[0]).map(([lvl, list]) => {
      const spellSlotEntry = (attrs as SysObj)?.spells ? ((attrs as SysObj).spells as SysObj)[`spell${lvl}`] as SysObj | undefined : undefined;
      const slots = spellSlotEntry ? strNum(spellSlotEntry.slots, 0) : 0;
      return `    - level: ${lvl}\n      list:\n${list.slice(0, 10).map(n => `        - "${n}"`).join("\n")}${slots ? `\n      slots: ${slots}` : ""}`;
    }).join("\n");
    spellsBlock = `\nspellcasting:\n  ability: ${spellAbility.toUpperCase()}${saveDc ? `\n  spell_save_dc: ${saveDc}` : ""}\n  spells:\n${spellLines}`;
  }

  const hitDice = `${level}d${strNum((classItem?.system as SysObj | undefined)?.hitDice, 8)}`;

  return [
    "```dnd-sheet",
    `system: dnd5e`,
    `name: ${JSON.stringify(name)}`,
    `race: ${JSON.stringify(typeof details?.race === "string" ? details.race : "")}`,
    `class: ${JSON.stringify(cls)}`,
    subcls ? `subclass: ${JSON.stringify(subcls)}` : null,
    `background: ${JSON.stringify(typeof details?.background === "string" ? details.background : "")}`,
    `level: ${level}`,
    typeof details?.alignment === "string" && details.alignment ? `alignment: ${JSON.stringify(details.alignment)}` : null,
    `ability_scores:`,
    `  str: ${abilScore("str")}`,
    `  dex: ${abilScore("dex")}`,
    `  con: ${abilScore("con")}`,
    `  int: ${abilScore("int")}`,
    `  wis: ${abilScore("wis")}`,
    `  cha: ${abilScore("cha")}`,
    `hp_max: ${strNum(hp?.max, 0)}`,
    `hp_current: ${strNum(hp?.value, 0)}`,
    strNum(hp?.temp, 0) > 0 ? `hp_temp: ${strNum(hp?.temp, 0)}` : null,
    `hit_dice: ${hitDice}`,
    `ac: ${strNum(ac?.value, 10)}`,
    spd ? `speed: ${strNum(typeof spd === "object" ? (spd as SysObj).walk : spd, 30)}` : null,
    profSaves.length ? `saving_throw_proficiencies:\n${profSaves.map(s => `  - ${s}`).join("\n")}` : null,
    profSkills.length ? `skill_proficiencies:\n${profSkills.map(s => `  - ${s}`).join("\n")}` : null,
    passivePerc ? `passive_perception: ${passivePerc}` : null,
    attacks.length ? `attacks:\n${attacks.map(a => `  - name: ${JSON.stringify(a.name)}\n    bonus: "${a.bonus}"\n    damage: "${a.damage}"`).join("\n")}` : null,
    features.length ? `features:\n${features.map(f => `  - ${JSON.stringify(f)}`).join("\n")}` : null,
    languages.length ? `languages:\n${languages.map(l => `  - ${l}`).join("\n")}` : null,
    profs.length ? `proficiencies:\n${profs.map(p => `  - ${p}`).join("\n")}` : null,
    equipment.length ? `equipment:\n${equipment.map(e => `  - name: ${JSON.stringify(e)}`).join("\n")}` : null,
    spellsBlock || null,
    "```"
  ].filter(Boolean).join("\n");
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
    const bioMarkdown = htmlToMarkdown(bioHtml);
    const sheetBlock = detectSystem(actor) === "dnd5e" ? buildDnDSheetBlock(actor, name) : null;
    const body = sheetBlock ? sheetBlock + "\n\n---\n\n" + bioMarkdown : bioMarkdown;
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

"use client";

import { FormEvent, KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Code2, Heading1, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus, Quote, Table2 } from "lucide-react";
import type { Campaign, CampaignMedia, WikiPage } from "@/lib/types";
import { renderMarkdown, type IncludeResolver, type MediaPathResolver, type WikiLinkResolver } from "@/lib/markdown";
import { buildAliasMap, resolveLinkTarget } from "@/lib/links";
import { RELATIONSHIP_TYPES, REL_TYPE_MAP } from "@/lib/relationships";

const travellerSkillRows: Array<{ name: string; speciality?: string; level?: number }> = [
  { name: "Admin" }, { name: "Advocate" }, { name: "Animals" }, { name: "Animals", speciality: "Handling" }, { name: "Animals", speciality: "Riding" }, { name: "Animals", speciality: "Veterinary" }, { name: "Animals", speciality: "Training" },
  { name: "Art" }, { name: "Art", speciality: "Performer" }, { name: "Art", speciality: "Holography" }, { name: "Art", speciality: "Instrument" }, { name: "Art", speciality: "Visual Media" }, { name: "Art", speciality: "Write" },
  { name: "Astrogation" }, { name: "Athletics" }, { name: "Athletics", speciality: "Dexterity" }, { name: "Athletics", speciality: "Endurance" }, { name: "Athletics", speciality: "Strength" }, { name: "Broker" }, { name: "Carouse" },
  { name: "Deception" }, { name: "Diplomat" }, { name: "Drive" }, { name: "Drive", speciality: "Hovercraft" }, { name: "Drive", speciality: "Mole" }, { name: "Drive", speciality: "Track" }, { name: "Drive", speciality: "Walker" }, { name: "Drive", speciality: "Wheel" },
  { name: "Electronics" }, { name: "Electronics", speciality: "Comms" }, { name: "Electronics", speciality: "Computers" }, { name: "Electronics", speciality: "Remote Ops" }, { name: "Electronics", speciality: "Sensors" },
  { name: "Engineer" }, { name: "Engineer", speciality: "M-drive" }, { name: "Engineer", speciality: "J-drive" }, { name: "Engineer", speciality: "Life Support" }, { name: "Engineer", speciality: "Power" }, { name: "Explosives" },
  { name: "Flyer" }, { name: "Flyer", speciality: "Airship" }, { name: "Flyer", speciality: "Grav" }, { name: "Flyer", speciality: "Ornithopter" }, { name: "Flyer", speciality: "Rotor" }, { name: "Flyer", speciality: "Wing" },
  { name: "Gambler" }, { name: "Gun Combat" }, { name: "Gun Combat", speciality: "Archaic" }, { name: "Gun Combat", speciality: "Energy" }, { name: "Gun Combat", speciality: "Slug" },
  { name: "Gunner" }, { name: "Gunner", speciality: "Turret" }, { name: "Gunner", speciality: "Ortillery" }, { name: "Gunner", speciality: "Screen" }, { name: "Gunner", speciality: "Capital" },
  { name: "Heavy Weapons" }, { name: "Heavy Weapons", speciality: "Artillery" }, { name: "Heavy Weapons", speciality: "Man Portable" }, { name: "Heavy Weapons", speciality: "Vehicle" }, { name: "Investigate" }, { name: "Jack-of-All-Trades" },
  { name: "Language" }, { name: "Language", speciality: "Anglic" }, { name: "Language", speciality: "Vilani" }, { name: "Language", speciality: "Zdetl" }, { name: "Language", speciality: "Oynprith" },
  { name: "Leadership" }, { name: "Mechanic" }, { name: "Medic" }, { name: "Melee" }, { name: "Melee", speciality: "Unarmed" }, { name: "Melee", speciality: "Blade" }, { name: "Melee", speciality: "Bludgeon" }, { name: "Melee", speciality: "Natural" }, { name: "Melee", speciality: "Infighting" },
  { name: "Navigation" }, { name: "Persuade" }, { name: "Pilot" }, { name: "Pilot", speciality: "Small Craft" }, { name: "Pilot", speciality: "Spacecraft" }, { name: "Pilot", speciality: "Capital Ships" },
  { name: "Profession" }, { name: "Profession", speciality: "Belter" }, { name: "Profession", speciality: "Biologicals" }, { name: "Profession", speciality: "Civil Engineering" }, { name: "Profession", speciality: "Construction" }, { name: "Profession", speciality: "Hydroponics" }, { name: "Profession", speciality: "K'kree Ritual" }, { name: "Profession", speciality: "Miner" }, { name: "Profession", speciality: "Polymers" }, { name: "Profession", speciality: "Religion" },
  { name: "Recon" }, { name: "Science" }, { name: "Science", speciality: "Archaeology" }, { name: "Science", speciality: "Astronomy" }, { name: "Science", speciality: "Belief" }, { name: "Science", speciality: "Biology" }, { name: "Science", speciality: "Chemistry" }, { name: "Science", speciality: "Cosmology" }, { name: "Science", speciality: "Cybernetics" }, { name: "Science", speciality: "Economics" }, { name: "Science", speciality: "Genetics" }, { name: "Science", speciality: "History" }, { name: "Science", speciality: "Linguistics" }, { name: "Science", speciality: "Philosophy" }, { name: "Science", speciality: "Physics" }, { name: "Science", speciality: "Planetology" }, { name: "Science", speciality: "Psionicology" }, { name: "Science", speciality: "Psychology" }, { name: "Science", speciality: "Robotics" }, { name: "Science", speciality: "Sophontology" }, { name: "Science", speciality: "Xenology" },
  { name: "Seafarer" }, { name: "Seafarer", speciality: "Ocean Ships" }, { name: "Seafarer", speciality: "Personal" }, { name: "Seafarer", speciality: "Sail" }, { name: "Seafarer", speciality: "Submarine" }, { name: "Stealth" }, { name: "Steward" }, { name: "Streetwise" }, { name: "Survival" }, { name: "Tactics" }, { name: "Tactics", speciality: "Military" }, { name: "Tactics", speciality: "Naval" }, { name: "Vacc Suit" }
];

function travellerSheetSnippet(name: string) {
  const skills = travellerSkillRows.map((skill) => {
    const label = skill.speciality ? `${skill.name} (${skill.speciality})` : skill.name;
    return `  ${JSON.stringify(label)}:`;
  }).join("\n");
  return `\n\n\`\`\`traveller-sheet\nheader:\n  left: \n  center: \n  right: \nportrait: \nname: ${JSON.stringify(name || "")}\nspecies: \nage: \nhomeworld: \ncareer: \nrank: \ndossier: \nstatus: \nconditions: []\nspeciesTraits: []\ncharacteristics:\n  STR: \n  DEX: \n  END: \n  INT: \n  EDU: \n  SOC: \nskills:\n${skills}\nweapons:\n  # Laser Pistol: 3D, Medium, notes\narmour:\n  # Cloth: 8, notes\nitems:\n  # Medkit: 1, notes\nholdings:\n  # Ship Share: notes\npeople:\n  # Contact Name: notes\npsionics:\n  # Telepathy: 1, notes\nnotes: \n\`\`\`\n\n`;
}

export default function PageEditor({ campaign, slug, categories }: { campaign: Campaign; slug: string; categories: { id: string; label: string }[] }) {
  const router = useRouter();
  const [page, setPage] = useState<WikiPage | null>(null);
  const [content, setContent] = useState("");
  const [frontmatter, setFrontmatter] = useState<any>({});
  const [knownPages, setKnownPages] = useState<WikiPage[]>([]);
  const [media, setMedia] = useState<CampaignMedia[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canManage = campaign.role === "owner" || campaign.role === "gm";
  const [mode, setMode] = useState<"gm" | "player" | "handout">(canManage ? "gm" : "player");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [conflictPage, setConflictPage] = useState<WikiPage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sourceJsonDraft, setSourceJsonDraft] = useState("");
  const [sourceDiff, setSourceDiff] = useState<any | null>(null);
  const [parentFilter, setParentFilter] = useState("");
  const [linkFilter, setLinkFilter] = useState("");
  const [mediaFilter, setMediaFilter] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [historyCommits, setHistoryCommits] = useState<{ sha: string; url: string; message: string; author: string; date: string }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{ query: string; insertStart: number; top: number; left: number } | null>(null);
  const [slashMenuIdx, setSlashMenuIdx] = useState(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxSrc) return;
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxSrc]);

  const applyPage = useCallback((nextPage: WikiPage) => {
    setPage(nextPage);
    setContent(nextPage.content);
    setFrontmatter(nextPage.frontmatter);
  }, []);

  const openHistory = useCallback(() => {
    setShowHistory(true);
    if (historyCommits.length > 0) return;
    setHistoryLoading(true);
    fetch(`/api/campaigns/${campaign.id}/pages/${slug}/history`)
      .then((r) => r.json())
      .then((data) => { setHistoryCommits(Array.isArray(data) ? data : []); setHistoryLoading(false); })
      .catch(() => setHistoryLoading(false));
  }, [campaign.id, slug, historyCommits.length]);

  const SLASH_COMMANDS = [
    { id: "h1",       label: "Heading 1",    snippet: "\n# "                                                          },
    { id: "h2",       label: "Heading 2",    snippet: "\n## "                                                         },
    { id: "h3",       label: "Heading 3",    snippet: "\n### "                                                        },
    { id: "quote",    label: "Quote",        snippet: "\n> "                                                          },
    { id: "code",     label: "Code block",   snippet: "\n```\n{{selection}}\n```"                                     },
    { id: "table",    label: "Table",        snippet: "\n| Col 1 | Col 2 |\n|-------|-------|\n| Cell  | Cell  |\n"   },
    { id: "divider",  label: "Divider",      snippet: "\n---\n"                                                       },
    { id: "task",     label: "Task list",    snippet: "\n- [ ] Task\n- [ ] Task\n"                                    },
    { id: "gm",       label: "GM block",     snippet: "\n:::gm\n{{selection}}\n:::"                                   },
    { id: "include",  label: "Include page", snippet: ":::include [[Page Name]]:::"                                   },
  ];

  const loadPage = useCallback(() => {
    return fetch(`/api/campaigns/${campaign.id}/pages/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.page) {
          applyPage(data.page);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true));
  }, [applyPage, campaign.id, slug]);

  useEffect(() => {
    loadPage();
    setIsEditing(canManage && new URLSearchParams(window.location.search).get("edit") === "1");
    fetch(`/api/campaigns/${campaign.id}/pages`)
      .then((res) => res.json())
      .then((data) => setKnownPages(Array.isArray(data.pages) ? data.pages : []));
    if (canManage) {
      fetch(`/api/campaigns/${campaign.id}/media`)
        .then((res) => res.json())
        .then((data) => setMedia(Array.isArray(data.media) ? data.media : []));
    }
  }, [campaign.id, canManage, loadPage, slug]);

  const resolveLink = useMemo<WikiLinkResolver>(() => {
    const aliasMap = buildAliasMap(
      knownPages.map((p) => ({ slug: p.slug, name: p.frontmatter.name, aliases: p.frontmatter.aliases || [] }))
    );
    const knownSlugs = new Set(knownPages.map((p) => p.slug));
    return (target: string) => {
      const { slug: target_slug, missing } = resolveLinkTarget(aliasMap, knownSlugs, target);
      return { href: `/campaigns/${campaign.id}/pages/${target_slug}`, missing };
    };
  }, [knownPages, campaign.id]);

  const resolveMedia = useMemo<MediaPathResolver>(
    () => (path: string) => `/campaign-media/${campaign.id}/${path.split("/").map(encodeURIComponent).join("/")}`,
    [campaign.id]
  );

  const resolveInclude = useMemo<IncludeResolver>(() => {
    const aliasMap = buildAliasMap(
      knownPages.map((p) => ({ slug: p.slug, name: p.frontmatter.name, aliases: p.frontmatter.aliases || [] }))
    );
    const bySlug = new Map(knownPages.map((p) => [p.slug, p]));
    return (target: string) => {
      if (target === slug) return null; // no self-embed
      const resolved = aliasMap.get(target.trim().toLowerCase());
      const page = resolved ? bySlug.get(resolved) : undefined;
      return page ? page.content : null;
    };
  }, [knownPages, slug]);

  const preview = useMemo(() => renderMarkdown(content, mode, resolveLink, resolveMedia, resolveInclude), [content, mode, resolveLink, resolveMedia, resolveInclude]);

  const incomingRelationships = useMemo(() => {
    if (!page) return [];
    const bySlug = new Map(knownPages.map(p => [p.slug, p]));
    const byName = new Map(knownPages.map(p => [p.frontmatter.name.toLowerCase(), p]));
    return knownPages.flatMap(p => {
      if (p.slug === slug) return [];
      return (p.frontmatter.relationships || [])
        .filter((r: any) => {
          const resolved = bySlug.get(r.target) ?? byName.get((r.target || "").toLowerCase());
          return resolved?.slug === slug;
        })
        .map((r: any) => ({ sourceSlug: p.slug, sourceName: p.frontmatter.name, type: r.type }));
    });
  }, [knownPages, slug, page]);

  const onPreviewClick = useCallback(
    async (event: MouseEvent<HTMLDivElement>) => {
      const galleryAnchor = (event.target as HTMLElement).closest("a.gallery-item");
      if (galleryAnchor) {
        event.preventDefault();
        setLightboxSrc(galleryAnchor.getAttribute("href") || null);
        return;
      }
      const anchor = (event.target as HTMLElement).closest("a.wiki-link");
      if (!anchor) return;
      event.preventDefault();
      const href = anchor.getAttribute("href");
      const missing = anchor.getAttribute("data-missing") === "true";
      const target = anchor.getAttribute("data-target") || "";
      if (!missing) {
        if (href) router.push(href);
        return;
      }
      if (!canManage) return;
      if (!confirm(`"${target}" has no page yet. Create it now?`)) return;
      const res = await fetch(`/api/campaigns/${campaign.id}/pages`, {
        method: "POST",
        body: JSON.stringify({ name: target, category: "npc", visibility: "gm" })
      });
      const data = await res.json();
      if ((res.ok || res.status === 409) && data.slug) {
        const editQuery = res.status === 409 ? "?edit=1" : "";
        router.push(`/campaigns/${campaign.id}/pages/${data.slug}${editQuery}`);
      }
      else setMessage(data.error || "Could not create page.");
    },
    [campaign.id, canManage, router]
  );

  async function savePage(finish = false) {
    if (isSaving) return;
    setIsSaving(true);
    setMessage("Saving commit to GitHub...");
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/pages/${slug}`, {
        method: "PUT",
        body: JSON.stringify({ frontmatter, content, sha: page?.sha })
      });
      const data = await res.json();
      if (res.ok) {
        setConflictPage(null);
        setPage((current) => (current ? { ...current, sha: data.sha || current.sha } : current));
        setMessage(finish ? "Saved and finished." : "Saved. Keep working when ready.");
        if (finish) setIsEditing(false);
        return;
      }
      if (res.status === 409 && data.latest) {
        setConflictPage(data.latest);
        setMessage(data.error || "This page has a GitHub conflict.");
        return;
      }
      setMessage(data.error || "Save failed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePage() {
    if (isSaving) return;
    if (!confirm(`Delete "${frontmatter.name || slug}"? This removes the page from the repo. Other pages that link to it will show as missing.`)) return;
    setIsSaving(true);
    setMessage("Deleting page...");
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/pages/${slug}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/campaigns/${campaign.id}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Delete failed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await savePage(false);
  }

  function reloadConflict() {
    if (!conflictPage) return;
    applyPage(conflictPage);
    setConflictPage(null);
    setMessage("Loaded the latest GitHub version.");
  }

  function updateField(field: string, value: unknown) {
    setFrontmatter((current: any) => ({ ...current, [field]: value }));
  }

  function insertTravellerSheetBlock() {
    setMode("gm");
    setIsEditing(true);
    insertSnippet(travellerSheetSnippet(frontmatter.name));
    setMessage("Character sheet block inserted in the markdown. Edit the values there, then save.");
  }

  function wodSheetSnippet(name: string) {
    const g = campaign.gameType;
    const system =
      g === "Vampire: The Masquerade" ? "vampire-masquerade" :
      g === "Dark Ages: Vampire"      ? "dark-ages-vampire" :
      g === "Werewolf: The Apocalypse" || g === "Dark Ages: Werewolf" ? "werewolf-apocalypse" :
      g === "Mage: The Ascension" || g === "Dark Ages: Mage"          ? "mage-ascension" :
      "generic-wod";
    const isVamp  = system === "vampire-masquerade" || system === "dark-ages-vampire";
    const isWerewolf = system === "werewolf-apocalypse";
    const isMage  = system === "mage-ascension";
    const isDark  = system === "dark-ages-vampire";
    const groupLine = isVamp ? "clan: " : isWerewolf ? "tribe: " : isMage ? "tradition: " : "group: ";
    const genLine  = isVamp ? "generation: 10\n" : isWerewolf ? "rank: Cliath\n" : isMage ? "rank: \n" : "";
    const roadLine = isDark ? "road: \n" : "";
    const abilities = isDark
      ? ["Alertness", "Athletics", "Brawl", "Dodge", "Empathy", "Expression", "Intimidation", "Leadership", "Subterfuge",
         "Animal Ken", "Crafts", "Etiquette", "Melee", "Performance", "Ride", "Stealth", "Survival",
         "Academics", "Investigation", "Law", "Linguistics", "Medicine", "Occult", "Politics", "Seneschal", "Theology"]
      : isVamp
      ? ["Alertness", "Athletics", "Brawl", "Dodge", "Empathy", "Expression", "Intimidation", "Leadership", "Streetwise", "Subterfuge",
         "Animal Ken", "Crafts", "Drive", "Etiquette", "Firearms", "Melee", "Performance", "Security", "Stealth", "Survival",
         "Academics", "Computer", "Finance", "Investigation", "Law", "Linguistics", "Medicine", "Occult", "Politics", "Science"]
      : isWerewolf
      ? ["Alertness", "Athletics", "Brawl", "Dodge", "Empathy", "Expression", "Intimidation", "Primal-Urge", "Streetwise", "Subterfuge",
         "Animal Ken", "Crafts", "Drive", "Etiquette", "Firearms", "Melee", "Performance", "Stealth", "Survival",
         "Academics", "Computer", "Enigmas", "Investigation", "Law", "Linguistics", "Medicine", "Occult", "Rituals", "Science"]
      : isMage
      ? ["Alertness", "Athletics", "Awareness", "Brawl", "Dodge", "Empathy", "Expression", "Intimidation", "Leadership", "Streetwise", "Subterfuge",
         "Animal Ken", "Crafts", "Drive", "Etiquette", "Firearms", "Meditation", "Melee", "Performance", "Stealth", "Survival", "Technology",
         "Academics", "Computer", "Cosmology", "Enigmas", "Esoterica", "Investigation", "Law", "Linguistics", "Medicine", "Occult", "Politics", "Science"]
      : ["Alertness", "Athletics", "Brawl", "Dodge", "Empathy", "Leadership", "Stealth", "Subterfuge", "Melee", "Survival", "Occult"];
    const powerLabel = isVamp ? "disciplines" : isWerewolf ? "gifts" : isMage ? "spheres" : "powers";
    const examplePowers = isVamp ? ["Auspex: 0", "Dominate: 0", "Presence: 0"] :
      isWerewolf ? ["Gifts (Rank 1): 0"] : isMage ? ["Correspondence: 0", "Forces: 0", "Life: 0"] : ["Power: 0"];
    const poolLine = isVamp ? "blood: 10\nblood_current: 10\n" :
      isWerewolf ? "rage: 5\nrage_current: 5\ngnosis: 5\ngnosis_current: 5\n" :
      isMage ? "quintessence: 5\nquintessence_current: 5\n" : "";
    const humanityLabel = isDark ? "humanity: 5 # Road rating\n" : isVamp ? "humanity: 5\n" :
      isWerewolf ? "renown: 0\n" : isMage ? "arete: 1\n" : "morality: 5\n";
    return `\n\n\`\`\`wod-sheet
system: ${system}
name: ${JSON.stringify(name || "")}
${groupLine}
${genLine}${roadLine}nature:
demeanor:
concept:
portrait:

attributes:
  strength: 1
  dexterity: 1
  stamina: 1
  charisma: 1
  manipulation: 1
  appearance: 1
  perception: 1
  intelligence: 1
  wits: 1

abilities:
${abilities.map((a) => `  - ${a}: 0`).join("\n")}

${powerLabel}:
${examplePowers.map((p) => `  - ${p}`).join("\n")}

backgrounds:
  - Generation: 0
  - Resources: 0
  - Retainers: 0

virtues:
  conscience: 1
  self_control: 1
  courage: 1

willpower: 3
willpower_current: 3
${poolLine}${humanityLabel}
health:
  bruised: false
  hurt: false
  injured: false
  wounded: false
  mauled: false
  crippled: false
  incapacitated: false

weapons:
  - name: ""
    damage: ""
equipment:
  - name: ""
    notes: ""

notes: ""
\`\`\`\n\n`;
  }

  function insertWoDSheetBlock() {
    setMode("gm");
    setIsEditing(true);
    insertSnippet(wodSheetSnippet(frontmatter.name));
    setMessage("WoD sheet block inserted. Edit the values in the markdown, then save.");
  }

  function dndSheetSnippet(name: string) {
    const isPF2 = campaign.gameType === "Pathfinder";
    const system = isPF2 ? "pathfinder2" : "dnd5e";
    return `\n\n\`\`\`dnd-sheet
system: ${system}
name: ${JSON.stringify(name || "")}
race: ""
class: ""
subclass: ""
level: 1
background: ""
alignment: ""
xp: 0
portrait: ""
player: ""

ability_scores:
  str: 10
  dex: 10
  con: 10
  int: 10
  wis: 10
  cha: 10

# Abbreviations: str, dex, con, int, wis, cha
saving_throw_proficiencies: []

# Full skill names — see list below
skill_proficiencies: []
skill_expertise: []
# Skills: Acrobatics, Animal Handling, Arcana, Athletics, Deception,
#         History, Insight, Intimidation, Investigation, Medicine,
#         Nature, Perception, Performance, Persuasion, Religion,
#         Sleight of Hand, Stealth, Survival

ac: 10
speed: 30
hp_max: 8
hp_current: 8
hp_temp: 0
hit_dice: "1d8"
death_saves:
  successes: 0
  failures: 0

attacks:
  - name: ""
    bonus: "+0"
    damage: ""

# Delete spellcasting section if not a caster
spellcasting:
  ability: int
  spell_save_dc: 10
  spell_attack: "+2"
  spells:
    - level: 0
      list: []
    - level: 1
      slots: 2
      list: []

features: []
languages: [Common]
proficiencies: []
equipment:
  - name: ""
notes: ""
\`\`\`\n\n`;
  }

  function insertDnDSheetBlock() {
    setMode("gm");
    setIsEditing(true);
    insertSnippet(dndSheetSnippet(frontmatter.name));
    setMessage("D&D sheet block inserted. Edit the values in the markdown, then save.");
  }

  function insertSnippet(snippet: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((current) => `${current}${current.endsWith("\n") || !current ? "" : "\n"}${snippet}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const selected = content.slice(start, end);
    const after = content.slice(end);
    const text = snippet.includes("{{selection}}") ? snippet.replace("{{selection}}", selected || "Secret notes.") : snippet;
    const next = `${before}${text}${after}`;
    setContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + text.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function replaceSelection(replacer: (selected: string) => { text: string; cursorOffset?: number }) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const selected = content.slice(start, end);
    const after = content.slice(end);
    const { text, cursorOffset } = replacer(selected);
    setContent(`${before}${text}${after}`);
    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + (cursorOffset ?? text.length);
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function wrapSelection(prefix: string, suffix = prefix, fallback = "text") {
    replaceSelection((selected) => {
      const inner = selected || fallback;
      return {
        text: `${prefix}${inner}${suffix}`,
        cursorOffset: selected ? `${prefix}${inner}${suffix}`.length : prefix.length + inner.length
      };
    });
  }

  function prefixSelectedLines(prefix: string) {
    replaceSelection((selected) => {
      const text = selected || "List item";
      return { text: text.split("\n").map((line) => (line.trim() ? `${prefix}${line}` : line)).join("\n") };
    });
  }

  function heading(level: 1 | 2 | 3) {
    replaceSelection((selected) => {
      const marks = "#".repeat(level);
      const text = selected || "Heading";
      return { text: text.split("\n").map((line) => `${marks} ${line.replace(/^#{1,6}\s+/, "")}`).join("\n") };
    });
  }

  function numberedList() {
    replaceSelection((selected) => {
      const lines = (selected || "List item").split("\n");
      let index = 1;
      return { text: lines.map((line) => (line.trim() ? `${index++}. ${line}` : line)).join("\n") };
    });
  }

  function codeBlock() {
    replaceSelection((selected) => ({ text: `\`\`\`text\n${selected || "code"}\n\`\`\`` }));
  }

  function markdownLink() {
    replaceSelection((selected) => ({
      text: `[${selected || "label"}](https://example.com)`,
      cursorOffset: selected ? selected.length + 3 : 6
    }));
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashMenu && filteredSlashCmds.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashMenuIdx((i) => (i + 1) % filteredSlashCmds.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashMenuIdx((i) => (i - 1 + filteredSlashCmds.length) % filteredSlashCmds.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        onSlashSelect(filteredSlashCmds[slashMenuIdx]);
        return;
      }
      if (event.key === "Escape") {
        setSlashMenu(null);
        return;
      }
    }
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      wrapSelection("**", "**", "bold text");
    } else if (key === "i") {
      event.preventDefault();
      wrapSelection("*", "*", "italic text");
    } else if (key === "s") {
      event.preventDefault();
      savePage(false);
    }
  }

  function insertWikiLink(target: string) {
    if (!target) return;
    insertSnippet(`[[${target}]]`);
  }

  function insertMedia(path: string) {
    const item = media.find((mediaItem) => mediaItem.path === path);
    if (!item) return;
    insertSnippet(item.markdown);
  }

  function insertTable() {
    insertSnippet("\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n|          |          |          |\n|          |          |          |\n");
  }

  async function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (!files.length || !canManage) return;
    e.preventDefault();
    const file = files[0];
    const placeholder = `![Uploading ${file.name}…]()`;
    insertSnippet(placeholder);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/campaigns/${campaign.id}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, base64, mimeType: file.type, alt: "" }),
      });
      const data = await res.json();
      if (data.media?.markdown) {
        setContent((prev) => prev.replace(placeholder, data.media.markdown));
        setMedia((prev) => [data.media, ...prev]);
      } else {
        setContent((prev) => prev.replace(placeholder, ""));
        setMessage(data.error || "Image upload failed.");
      }
    } catch {
      setContent((prev) => prev.replace(placeholder, ""));
      setMessage("Image upload failed.");
    }
  }

  function onSlashSelect(cmd: typeof SLASH_COMMANDS[0]) {
    if (!textareaRef.current || !slashMenu) return;
    const textarea = textareaRef.current;
    const slashEnd = textarea.selectionStart;
    const before = content.slice(0, slashMenu.insertStart);
    const after = content.slice(slashEnd);
    const snippet = cmd.snippet.replace("{{selection}}", "");
    const next = before + snippet + after;
    setContent(next);
    setSlashMenu(null);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = slashMenu.insertStart + snippet.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function onContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setContent(val);

    const beforeCursor = val.slice(0, pos);
    const lineStart = beforeCursor.lastIndexOf("\n") + 1;
    const currentLine = beforeCursor.slice(lineStart);
    const slashMatch = currentLine.match(/^\/(\w*)$/);

    if (slashMatch && textareaRef.current) {
      const query = slashMatch[1].toLowerCase();
      const linesBeforeLine = beforeCursor.slice(0, lineStart).split("\n").length;
      const lineHeight = 22;
      const rect = textareaRef.current.getBoundingClientRect();
      const menuTop = rect.top + linesBeforeLine * lineHeight - textareaRef.current.scrollTop + lineHeight + 4;
      setSlashMenu({ query, insertStart: lineStart, top: menuTop, left: rect.left + 8 });
      setSlashMenuIdx(0);
    } else {
      setSlashMenu(null);
    }
  }

  const filteredSlashCmds = slashMenu
    ? SLASH_COMMANDS.filter((c) => !slashMenu.query || c.id.startsWith(slashMenu.query) || c.label.toLowerCase().includes(slashMenu.query))
    : [];

  async function compareSourceImport() {
    if (!frontmatter.sourceImport) return;
    let sourceJson: unknown;
    try {
      sourceJson = JSON.parse(sourceJsonDraft);
    } catch {
      setMessage("New source JSON is invalid.");
      return;
    }
    const res = await fetch(`/api/campaigns/${campaign.id}/imports/characters/diff`, {
      method: "POST",
      body: JSON.stringify({ sourcePath: frontmatter.sourceImport, sourceJson })
    });
    const data = await res.json();
    if (res.ok) {
      setSourceDiff(data);
      setMessage("Source JSON compared.");
    } else {
      setMessage(data.error || "Could not compare source JSON.");
    }
  }

  if (notFound) {
    return (
      <div className="panel">
        <h2>Page not found</h2>
        <p className="muted">No page named <code>{slug}</code> exists in this campaign repo yet.</p>
        {canManage && (
          <button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/campaigns/${campaign.id}/pages`, {
                method: "POST",
                body: JSON.stringify({ name: slug.replace(/-/g, " "), category: "npc", visibility: "gm" })
              });
              const data = await res.json();
              if ((res.ok || res.status === 409) && data.slug) {
                const editQuery = res.status === 409 ? "?edit=1" : "";
                router.push(`/campaigns/${campaign.id}/pages/${data.slug}${editQuery}`);
              }
              else setMessage(data.error || "Could not create page.");
            }}
          >
            Create this page
          </button>
        )}
        <p className="muted"><a className="quiet-link" href={`/campaigns/${campaign.id}`}>← Back to campaign</a></p>
        {message && <p className="toast">{message}</p>}
      </div>
    );
  }
  if (!page) return <p className="muted">Loading page...</p>;
  const fieldsEditable = canManage && isEditing;
  const keyLinks = Array.isArray(frontmatter.keyLinks) ? frontmatter.keyLinks : [];
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const tradeCodes = Array.isArray(frontmatter.tradeCodes) ? frontmatter.tradeCodes : [];
  const isTraveller = campaign.gameType === "Traveller";
  const isEvent = frontmatter.category === "event";
  const canUseTravellerSheet = isTraveller && (frontmatter.category === "character" || frontmatter.category === "npc");
  const DND_GAME_TYPES: string[] = ["Dungeons & Dragons", "Pathfinder", "Old-School Essentials", "Shadowdark RPG", "Dragonbane", "Fabula Ultima"];
  const isDnD = DND_GAME_TYPES.includes(campaign.gameType);
  const canUseDnDSheet = isDnD && (frontmatter.category === "character" || frontmatter.category === "npc");
  const WOD_GAME_TYPES: string[] = [
    "Vampire: The Masquerade", "Dark Ages: Vampire", "Werewolf: The Apocalypse",
    "Dark Ages: Werewolf", "Mage: The Ascension", "Dark Ages: Mage",
    "Changeling: The Dreaming", "Wraith: The Oblivion", "Hunter: The Reckoning",
    "Demon: The Fallen", "Mummy: The Resurrection"
  ];
  const isWoD = WOD_GAME_TYPES.includes(campaign.gameType);
  const canUseWoDSheet = isWoD && (frontmatter.category === "character" || frontmatter.category === "npc");

  // Ancestor chain (breadcrumbs) + cycle-safe parent options.
  const pageBySlug = new Map(knownPages.map((p) => [p.slug, p]));
  const breadcrumbs: { slug: string; name: string }[] = [];
  {
    let cursor = frontmatter.parent as string | undefined;
    const seen = new Set<string>([slug]);
    while (cursor && pageBySlug.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      const ancestor = pageBySlug.get(cursor)!;
      breadcrumbs.unshift({ slug: ancestor.slug, name: ancestor.frontmatter.name });
      cursor = ancestor.frontmatter.parent;
    }
  }
  const childMap = new Map<string, string[]>();
  for (const p of knownPages) {
    const par = p.frontmatter.parent || "";
    childMap.set(par, [...(childMap.get(par) || []), p.slug]);
  }
  const blocked = new Set<string>([slug]);
  const stack = [slug];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const child of childMap.get(cur) || []) if (!blocked.has(child)) (blocked.add(child), stack.push(child));
  }
  const parentOptions = knownPages.filter((p) => !blocked.has(p.slug)).sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
  const pageMatches = (candidate: WikiPage, filter: string) => {
    const query = filter.trim().toLowerCase();
    if (!query) return true;
    return [candidate.frontmatter.name, candidate.slug, candidate.frontmatter.category, ...(candidate.frontmatter.tags || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  };
  const filteredParentOptions = parentOptions.filter((candidate) => candidate.slug === frontmatter.parent || pageMatches(candidate, parentFilter));
  const filteredLinkPages = knownPages
    .filter((candidate) => pageMatches(candidate, linkFilter))
    .sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
  const filteredInsertMedia = media.filter((item) => {
    const query = mediaFilter.trim().toLowerCase();
    return !query || [item.name, item.path, item.caption, item.alt, ...(item.tags || [])].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
  const breadcrumbsEl = breadcrumbs.length > 0 && (
    <nav className="breadcrumbs">
      {breadcrumbs.map((b) => (
        <a key={b.slug} href={`/campaigns/${campaign.id}/pages/${b.slug}`}>{b.name}</a>
      ))}
      <span>{frontmatter.name}</span>
    </nav>
  );

  const coverRaw = frontmatter.cover ? String(frontmatter.cover) : "";
  const coverSrc = coverRaw ? (/^https?:\/\//i.test(coverRaw) ? coverRaw : resolveMedia(coverRaw.replace(/^\/?wiki\/media\//, ""))) : "";
  const coverEl = coverSrc ? <img className="page-cover page-cover-clickable" src={coverSrc} alt="" onClick={() => setLightboxSrc(coverSrc)} /> : null;
  const editorCategories = frontmatter.category && !categories.some((category) => category.id === frontmatter.category)
    ? [...categories, { id: frontmatter.category, label: frontmatter.category }]
    : categories;

  if (!isEditing) {
    return (
      <section className="reader-shell">
        <div className="editor-panel">
          <div className="editor-toolbar">
            {canManage && <button type="button" className={mode === "gm" ? "active" : ""} onClick={() => { setShowHistory(false); setMode("gm"); }}>GM preview</button>}
            <button type="button" className={mode === "player" ? "active" : ""} onClick={() => { setShowHistory(false); setMode("player"); }}>Player preview</button>
            <button type="button" className={mode === "handout" ? "active" : ""} onClick={() => { setShowHistory(false); setMode("handout"); }}>Handout</button>
            {canManage && <button type="button" className={showHistory ? "active" : ""} onClick={showHistory ? () => setShowHistory(false) : openHistory}>History</button>}
            {canManage && <button type="button" onClick={() => setIsEditing(true)}>Edit page</button>}
            {canManage && <button type="button" className="danger" disabled={isSaving} onClick={deletePage}>Delete page</button>}
          </div>
          {message && <p className="toast editor-toast">{message}</p>}
          {showHistory ? (
            <div className="page-history">
              <h3>Page history</h3>
              {historyLoading && <p className="muted">Loading…</p>}
              {!historyLoading && historyCommits.length === 0 && <p className="muted">No commits found.</p>}
              {historyCommits.map((c) => (
                <div className="history-commit" key={c.sha}>
                  <span className="history-meta">{new Date(c.date).toLocaleDateString()} · {c.author}</span>
                  <a href={c.url} target="_blank" rel="noreferrer" className="quiet-link history-message">{c.message}</a>
                  <span className="history-sha">{c.sha.slice(0, 7)}</span>
                </div>
              ))}
            </div>
          ) : (
          <>
          {mode !== "handout" && breadcrumbsEl}
          <article className={mode === "handout" ? "preview page-reader handout-preview" : "preview page-reader"}>
            {coverEl}
            {mode === "handout" && (
              <header className="handout-header">
                <p>Player Handout</p>
                <h1>{frontmatter.name}</h1>
                {frontmatter.summary && <span>{frontmatter.summary}</span>}
              </header>
            )}
            <div onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: preview }} />
          </article>
          {mode !== "handout" && (frontmatter.relationships?.length > 0 || incomingRelationships.length > 0) && (
            <section className="rel-panel">
              <h4>Connections</h4>
              <div className="rel-groups">
                {(frontmatter.relationships || []).map((rel: any, i: number) => {
                  const rtDef = REL_TYPE_MAP.get(rel.type);
                  const targetPage = pageBySlug.get(rel.target) ?? knownPages.find(p => p.frontmatter.name.toLowerCase() === (rel.target || "").toLowerCase());
                  return (
                    <div className="rel-item" key={`out-${rel.type}-${rel.target}-${i}`}>
                      <span className="rel-type">{rtDef?.label ?? rel.type}</span>
                      <a href={targetPage ? `/campaigns/${campaign.id}/pages/${targetPage.slug}` : "#"} className="quiet-link">
                        {targetPage?.frontmatter.name ?? rel.target}
                      </a>
                      {rel.notes && <span className="muted">{rel.notes}</span>}
                    </div>
                  );
                })}
                {incomingRelationships.map(({ sourceSlug, sourceName, type }, i) => {
                  const rtDef = REL_TYPE_MAP.get(type);
                  return (
                    <div className="rel-item" key={`in-${type}-${sourceSlug}-${i}`}>
                      <span className="rel-type rel-type-inverse">{rtDef?.inverseLabel ?? type}</span>
                      <a href={`/campaigns/${campaign.id}/pages/${sourceSlug}`} className="quiet-link">{sourceName}</a>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          </>
          )}
        </div>
      </section>
    );
  }

  return (
    <>
    <form onSubmit={save} className="page-grid">
      <aside className="page-sidebar">
        {breadcrumbsEl}
        <h2>{frontmatter.name}</h2>
        <p>{frontmatter.summary || "No summary yet."}</p>
        <div className="badges">
          <span>{frontmatter.category}</span>
          <span>{frontmatter.visibility}</span>
          <span>{frontmatter.approvalStatus}</span>
          {frontmatter.knownToPlayers && <span>known</span>}
        </div>

        <div className="field-group">
          <h3>Page</h3>
          <label>Name<input value={frontmatter.name || ""} onChange={(e) => updateField("name", e.target.value)} readOnly={!fieldsEditable} /></label>
          <label>Category<select
            value={frontmatter.category || "npc"}
            onChange={(e) => setFrontmatter((current: any) => ({ ...current, category: e.target.value, type: e.target.value }))}
            disabled={!fieldsEditable}
          >
            {editorCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select></label>
          <label>Summary<textarea value={frontmatter.summary || ""} onChange={(e) => updateField("summary", e.target.value)} readOnly={!fieldsEditable} /></label>
          <label>Status<input value={frontmatter.status || ""} onChange={(e) => updateField("status", e.target.value)} readOnly={!fieldsEditable} placeholder="alive, active, destroyed..." /></label>
          <label>Tags<input value={tags.join(", ")} onChange={(e) => updateField("tags", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!fieldsEditable} /></label>
          <label>Aliases<input value={(frontmatter.aliases || []).join(", ")} onChange={(e) => updateField("aliases", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!fieldsEditable} /></label>
          <label>Parent page
            {fieldsEditable && <input type="search" value={parentFilter} onChange={(event) => setParentFilter(event.target.value)} placeholder="Filter pages" />}
            <select value={frontmatter.parent || ""} onChange={(e) => updateField("parent", e.target.value || undefined)} disabled={!fieldsEditable}>
            <option value="">— none (top level) —</option>
            {filteredParentOptions.map((p) => <option key={p.slug} value={p.slug}>{p.frontmatter.name} · {p.frontmatter.category}</option>)}
          </select></label>
        </div>

        <div className="field-group">
          <h3>Visibility</h3>
          <label>Visibility<select value={frontmatter.visibility} onChange={(e) => updateField("visibility", e.target.value)} disabled={!fieldsEditable}><option value="gm">GM only</option><option value="players">Players</option></select></label>
          <label>Approval<select value={frontmatter.approvalStatus} onChange={(e) => updateField("approvalStatus", e.target.value)} disabled={!fieldsEditable}><option value="approved">Approved</option><option value="unapproved">Unapproved</option><option value="rejected">Rejected</option></select></label>
          <label className="check"><input type="checkbox" checked={Boolean(frontmatter.knownToPlayers)} onChange={(e) => updateField("knownToPlayers", e.target.checked)} disabled={!fieldsEditable} /> Known to players</label>
        </div>

        <div className="field-group">
          <h3>Links</h3>
          <label>Key links<input value={keyLinks.join(", ")} onChange={(e) => updateField("keyLinks", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!fieldsEditable} /></label>
          <label>Cover image<input value={frontmatter.cover || ""} onChange={(e) => updateField("cover", e.target.value || undefined)} readOnly={!fieldsEditable} placeholder="filename.jpg (in /wiki/media) or URL" /></label>
          <label>Foundry link<input value={frontmatter.foundryLink || ""} onChange={(e) => updateField("foundryLink", e.target.value)} readOnly={!fieldsEditable} placeholder="Actor UUID or scene URL" /></label>
        </div>

        <div className="field-group">
          <h3>Relationships</h3>
          {(frontmatter.relationships || []).map((rel: any, i: number) => (
            <div className="rel-row" key={i}>
              <select value={rel.type || "related-to"} disabled={!fieldsEditable} onChange={(e) => {
                const rels = [...(frontmatter.relationships || [])];
                rels[i] = { ...rel, type: e.target.value };
                updateField("relationships", rels);
              }}>
                {RELATIONSHIP_TYPES.map(rt => <option key={rt.type} value={rt.type}>{rt.label}</option>)}
              </select>
              <input value={rel.target || ""} readOnly={!fieldsEditable} placeholder="Page name" list="rel-target-list"
                onChange={(e) => {
                  const rels = [...(frontmatter.relationships || [])];
                  rels[i] = { ...rel, target: e.target.value };
                  updateField("relationships", rels);
                }}
              />
              {fieldsEditable && (
                <button type="button" className="linklike" onClick={() =>
                  updateField("relationships", (frontmatter.relationships || []).filter((_: any, j: number) => j !== i))
                }>×</button>
              )}
            </div>
          ))}
          {fieldsEditable && (
            <button type="button" className="secondary" onClick={() =>
              updateField("relationships", [...(frontmatter.relationships || []), { type: "related-to", target: "" }])
            }>Add relationship</button>
          )}
          <datalist id="rel-target-list">
            {knownPages.map(p => <option key={p.slug} value={p.frontmatter.name} />)}
          </datalist>
        </div>

        {isEvent && (
          <div className="field-group">
            <h3>Timeline</h3>
            <label>Event date<input value={frontmatter.eventDate || ""} onChange={(e) => updateField("eventDate", e.target.value)} readOnly={!fieldsEditable} placeholder="1105-123 or 2026-06-17" /></label>
            <label>Timeline date<input value={frontmatter.timelineDate || ""} onChange={(e) => updateField("timelineDate", e.target.value)} readOnly={!fieldsEditable} /></label>
            <label>Era<input value={frontmatter.era || ""} onChange={(e) => updateField("era", e.target.value || undefined)} readOnly={!fieldsEditable} placeholder="The Long Night, Third Age..." /></label>
            <label>Track<input value={frontmatter.track || ""} onChange={(e) => updateField("track", e.target.value || undefined)} readOnly={!fieldsEditable} placeholder="political, personal, cosmic..." /></label>
          </div>
        )}

        {isTraveller && (
          <div className="field-group">
            <h3>Traveller</h3>
            <label>UWP<input value={frontmatter.uwp || ""} onChange={(e) => updateField("uwp", e.target.value)} readOnly={!fieldsEditable} placeholder="A867A74-C" /></label>
            <label>Allegiance<input value={frontmatter.allegiance || ""} onChange={(e) => updateField("allegiance", e.target.value)} readOnly={!fieldsEditable} placeholder="Solomani Confederation" /></label>
            <label>Trade codes<input value={tradeCodes.join(", ")} onChange={(e) => updateField("tradeCodes", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!fieldsEditable} /></label>
            <label>Subsector<input value={frontmatter.subsector || ""} onChange={(e) => updateField("subsector", e.target.value)} readOnly={!fieldsEditable} /></label>
            <label>Patron<input value={frontmatter.patron || ""} onChange={(e) => updateField("patron", e.target.value)} readOnly={!fieldsEditable} /></label>
            <label>Tech level<input value={frontmatter.techLevel || ""} onChange={(e) => updateField("techLevel", e.target.value)} readOnly={!fieldsEditable} /></label>
          </div>
        )}

        {frontmatter.sourceImport && (
          <div className="field-group">
            <h3>Source Import</h3>
            <p className="muted">{frontmatter.sourceImport}</p>
            {fieldsEditable && (
              <>
                <label>New source JSON<textarea value={sourceJsonDraft} onChange={(event) => setSourceJsonDraft(event.target.value)} rows={6} placeholder='{"name":"Updated Actor"}' /></label>
                <button type="button" className="secondary" onClick={compareSourceImport}>Compare source</button>
                {sourceDiff && (
                  <div className="diff-list">
                    <p className="muted">
                      {sourceDiff.counts.added} added · {sourceDiff.counts.changed} changed · {sourceDiff.counts.removed} removed
                    </p>
                    {sourceDiff.changes.map((change: any) => (
                      <article key={`${change.type}-${change.path}`} className={`diff-row ${change.type}`}>
                        <strong>{change.type}</strong>
                        <span>{change.path}</span>
                        <code>{change.type === "added" ? String(change.after) : change.type === "removed" ? String(change.before) : `${String(change.before)} -> ${String(change.after)}`}</code>
                      </article>
                    ))}
                    {!sourceDiff.changes.length && <p className="muted">No source changes detected.</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <h3>Key links</h3>
        {keyLinks.map((link: string) => <a key={link} className="nav-link" href={`/campaigns/${campaign.id}/pages/${link}`}>{link}</a>)}
        <h3>Backlinks</h3>
        {(page.backlinks || []).map((link) => <a key={link} className="nav-link" href={`/campaigns/${campaign.id}/pages/${link}`}>{link}</a>)}
      </aside>

      <section className="editor-panel">
        <div className="editor-toolbar">
          {canManage && <button type="button" className={mode === "gm" ? "active" : ""} onClick={() => setMode("gm")}>GM preview</button>}
          <button type="button" className={mode === "player" ? "active" : ""} onClick={() => setMode("player")}>Player preview</button>
          <button type="button" className={mode === "handout" ? "active" : ""} onClick={() => setMode("handout")}>Handout</button>
          {fieldsEditable && canUseTravellerSheet && <button type="button" onClick={insertTravellerSheetBlock}>Insert character sheet</button>}
          {fieldsEditable && canUseWoDSheet && <button type="button" onClick={insertWoDSheetBlock}>Insert WoD sheet</button>}
          {fieldsEditable && canUseDnDSheet && <button type="button" onClick={insertDnDSheetBlock}>Insert D&amp;D sheet</button>}
          {fieldsEditable && <button type="button" onClick={() => insertSnippet("```inventory\ntitle: Inventory\nitems:\n  - name: Item name\n    qty: 1\n    weight: 1\n    value: \"\"\n    notes: \"\"\n```\n\n")}>Insert inventory</button>}
          {fieldsEditable && <button type="button" onClick={() => insertSnippet("```tracker\ntitle: Resources\nresources:\n  - name: Hit Points\n    current: 10\n    max: 10\n    color: \"#e74c3c\"\n  - name: Mana\n    current: 5\n    max: 5\n    color: \"#3498db\"\n```\n\n")}>Insert tracker</button>}
          {fieldsEditable && <button type="button" onClick={() => insertSnippet("```traits\ntitle: Traits & Abilities\ntraits:\n  - name: Trait name\n    value: \"\"\n    description: Optional tooltip\n    type: \"\"\n```\n\n")}>Insert traits</button>}
          {fieldsEditable && <button type="button" onClick={() => insertSnippet("![[Page Name]]\n")}>Embed page</button>}
          {fieldsEditable && <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>}
          {fieldsEditable && <button type="button" disabled={isSaving} onClick={() => savePage(true)}>{isSaving ? "Saving..." : "Save and finish"}</button>}
          {canManage && !isEditing && <button type="button" onClick={() => setIsEditing(true)}>Edit page</button>}
          {canManage && <button type="button" className="danger" disabled={isSaving} onClick={deletePage}>Delete page</button>}
        </div>
        {message && <p className="toast editor-toast">{message}</p>}
        {fieldsEditable && (
          <div className="insert-toolbar">
            <label>
              Wiki link
              <input type="search" value={linkFilter} onChange={(event) => setLinkFilter(event.target.value)} placeholder="Filter pages" />
              <select defaultValue="" onChange={(event) => { insertWikiLink(event.target.value); event.target.value = ""; }}>
                <option value="">Insert page link</option>
                {filteredLinkPages.map((knownPage) => <option key={knownPage.slug} value={knownPage.frontmatter.name}>{knownPage.frontmatter.name} · {knownPage.frontmatter.category}</option>)}
              </select>
            </label>
            <label>
              Media
              <input type="search" value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value)} placeholder="Filter media" />
              <select defaultValue="" onChange={(event) => { insertMedia(event.target.value); event.target.value = ""; }}>
                <option value="">Insert media</option>
                {filteredInsertMedia.map((item) => <option key={item.path} value={item.path}>{item.name}</option>)}
              </select>
            </label>
            <button type="button" className="secondary" onClick={() => insertSnippet(":::gm\n{{selection}}\n:::")}>GM Block</button>
            <button type="button" className="secondary" onClick={() => insertSnippet("[[Page Name|label]]")}>Alias Link</button>
          </div>
        )}
        {conflictPage && (
          <div className="conflict-banner">
            <span>This page changed on GitHub after you opened it.</span>
            <button type="button" className="secondary" onClick={reloadConflict}>Load latest</button>
          </div>
        )}
        {isEditing ? (
          <div className="editor-workspace">
            {fieldsEditable && (
              <div className="format-toolbar" aria-label="Markdown formatting controls">
                <button type="button" className="icon-button" title="Heading 1" onClick={() => heading(1)}><Heading1 size={18} /></button>
                <button type="button" className="icon-button" title="Heading 2" onClick={() => heading(2)}><Heading2 size={18} /></button>
                <button type="button" className="icon-button" title="Heading 3" onClick={() => heading(3)}><Heading3 size={18} /></button>
                <button type="button" className="icon-button" title="Bold" onClick={() => wrapSelection("**", "**", "bold text")}><Bold size={18} /></button>
                <button type="button" className="icon-button" title="Italic" onClick={() => wrapSelection("*", "*", "italic text")}><Italic size={18} /></button>
                <button type="button" className="icon-button" title="Bulleted list" onClick={() => prefixSelectedLines("- ")}><List size={18} /></button>
                <button type="button" className="icon-button" title="Numbered list" onClick={numberedList}><ListOrdered size={18} /></button>
                <button type="button" className="icon-button" title="Quote" onClick={() => prefixSelectedLines("> ")}><Quote size={18} /></button>
                <button type="button" className="icon-button" title="Inline code" onClick={() => wrapSelection("`", "`", "code")}><Code2 size={18} /></button>
                <button type="button" className="icon-button" title="Code block" onClick={codeBlock}><Code2 size={18} /></button>
                <button type="button" className="icon-button" title="Link" onClick={markdownLink}><Link2 size={18} /></button>
                <button type="button" className="icon-button" title="Table" onClick={insertTable}><Table2 size={18} /></button>
                <button type="button" className="icon-button" title="Divider" onClick={() => insertSnippet("\n---\n")}><Minus size={18} /></button>
              </div>
            )}
            {slashMenu && filteredSlashCmds.length > 0 && (
              <ul className="slash-menu" style={{ top: slashMenu.top, left: slashMenu.left }}>
                {filteredSlashCmds.map((cmd, i) => (
                  <li key={cmd.id} className={i === slashMenuIdx ? "slash-menu-item active" : "slash-menu-item"} onMouseEnter={() => setSlashMenuIdx(i)} onMouseDown={(e) => { e.preventDefault(); onSlashSelect(cmd); }}>
                    <strong>{cmd.label}</strong>
                    <span>{cmd.id}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="editor-split">
              <textarea ref={textareaRef} value={content} onChange={onContentChange} onKeyDown={onEditorKeyDown} onPaste={onPaste} spellCheck={false} readOnly={!fieldsEditable} />
              <article className={mode === "handout" ? "preview handout-preview" : "preview"}>
                {mode === "handout" && (
                  <header className="handout-header">
                    <p>Player Handout</p>
                    <h1>{frontmatter.name}</h1>
                    {frontmatter.summary && <span>{frontmatter.summary}</span>}
                  </header>
                )}
                <div onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: preview }} />
              </article>
            </div>
          </div>
        ) : (
          <article className={mode === "handout" ? "preview page-reader handout-preview" : "preview page-reader"}>
            {coverEl}
            {mode === "handout" && (
              <header className="handout-header">
                <p>Player Handout</p>
                <h1>{frontmatter.name}</h1>
                {frontmatter.summary && <span>{frontmatter.summary}</span>}
              </header>
            )}
            <div onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: preview }} />
          </article>
        )}
      </section>
    </form>
    {lightboxSrc && (
      <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)} role="dialog" aria-modal>
        <button className="lightbox-close" onClick={() => setLightboxSrc(null)} aria-label="Close">✕</button>
        <img className="lightbox-img" src={lightboxSrc} alt="" onClick={(e) => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}

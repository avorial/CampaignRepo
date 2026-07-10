import { describe, it, expect } from "vitest";
import {
  parseWikiLinks,
  stripGmBlocks,
  normalizeFrontmatter,
  serializePage,
  parsePage,
  renderMarkdown
} from "@/lib/markdown";
import { slugify, titleFromSlug } from "@/lib/slug";
import { buildAliasMap, resolveTarget, resolveLinkTarget } from "@/lib/links";

describe("slug", () => {
  it("slugifies and round-trips a title (case preserved)", () => {
    expect(slugify("Avery Stone")).toBe("Avery-Stone");
    expect(slugify("  The Lantern File!  ")).toBe("The-Lantern-File");
    expect(slugify("")).toBe("untitled");
    expect(titleFromSlug("Avery-Stone")).toBe("Avery Stone");
  });
});

describe("wiki links", () => {
  it("parses plain and aliased links", () => {
    const links = parseWikiLinks("See [[Old Harbor]] and [[Avery Stone|Avery]].");
    expect(links).toEqual([
      { target: "Old Harbor", label: "Old Harbor" },
      { target: "Avery Stone", label: "Avery" }
    ]);
  });
});

describe("gm blocks", () => {
  it("strips :::gm secret blocks", () => {
    const out = stripGmBlocks("Public.\n\n:::gm\nSecret truth.\n:::\n\nMore public.");
    expect(out).not.toContain("Secret truth");
    expect(out).toContain("Public.");
    expect(out).toContain("More public.");
  });
});

describe("frontmatter", () => {
  it("normalizes and round-trips through serialize/parse", () => {
    const fm = normalizeFrontmatter({ name: "Victor", tags: ["npc"], visibility: "players" }, "fallback");
    expect(fm.name).toBe("Victor");
    expect(fm.visibility).toBe("players");
    expect(fm.approvalStatus).toBe("approved");

    const raw = serializePage(fm, "Body text [[Old Harbor]]");
    const page = parsePage("victor", raw);
    expect(page.frontmatter.name).toBe("Victor");
    expect(page.outgoingLinks[0].target).toBe("Old Harbor");
  });
});

describe("link resolution", () => {
  const pages = [
    { slug: "old-harbor", name: "Old Harbor", aliases: ["The Harbor"] },
    { slug: "Avery-Stone", name: "Avery Stone", aliases: [] }
  ];
  const aliasMap = buildAliasMap(pages);
  const known = new Set(pages.map((p) => p.slug));

  it("resolves by slug, name, and alias", () => {
    expect(resolveTarget(aliasMap, "Old Harbor")).toBe("old-harbor");
    expect(resolveTarget(aliasMap, "The Harbor")).toBe("old-harbor");
    expect(resolveTarget(aliasMap, "Avery Stone")).toBe("Avery-Stone");
  });

  it("falls back to slugify and flags missing targets", () => {
    expect(resolveLinkTarget(aliasMap, known, "Old Harbor")).toEqual({ slug: "old-harbor", missing: false });
    expect(resolveLinkTarget(aliasMap, known, "Unknown Place")).toEqual({ slug: "Unknown-Place", missing: true });
  });
});

describe("renderMarkdown", () => {
  const resolve = (target: string) =>
    target.toLowerCase() === "old harbor"
      ? { href: "/campaigns/1/pages/old-harbor", missing: false }
      : { href: "/campaigns/1/pages/" + slugify(target), missing: true };

  it("renders rich Markdown (lists, code)", () => {
    const html = renderMarkdown("- one\n- two\n\n`code`", "gm");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<code>code</code>");
  });

  it("adds heading ids and resolves section links", () => {
    const html = renderMarkdown("## Public Face\n\n[[Old Harbor#Public Face]]", "gm", resolve);
    expect(html).toContain('id="public-face"');
    expect(html).toContain('href="/campaigns/1/pages/old-harbor#public-face"');
  });

  it("renders :::gallery blocks into an image grid", () => {
    const html = renderMarkdown(":::gallery\n![](/wiki/media/a.jpg)\n![](/wiki/media/b.jpg)\n:::", "gm", undefined, (p) => `/media/${p}`);
    expect(html).toContain('class="gallery"');
    expect(html).toContain("/media/a.jpg");
    expect(html).toContain("/media/b.jpg");
  });

  it("expands ![[Page]] embeds inline", () => {
    const includeResolve = (target: string) => (target.toLowerCase() === "old harbor" ? "Embedded **lore** body." : null);
    const html = renderMarkdown("Intro.\n\n![[Old Harbor]]", "gm", resolve, undefined, includeResolve);
    expect(html).toContain("Embedded");
    expect(html).toContain("<strong>lore</strong>");
  });

  it("strips gm secret blocks in player mode but keeps them in gm mode", () => {
    const src = "Open.\n\n:::gm\nThe assassination report was altered.\n:::";
    const player = renderMarkdown(src, "player");
    expect(player).not.toContain("altered");
    const gm = renderMarkdown(src, "gm");
    expect(gm).toContain("altered");
    expect(gm).toContain("gm-block");
  });

  it("renders wiki-links with hrefs and flags missing ones", () => {
    const html = renderMarkdown("[[Old Harbor]] and [[Missing Faction]]", "gm", resolve);
    expect(html).toContain('href="/campaigns/1/pages/old-harbor"');
    expect(html).toContain('class="wiki-link"');
    expect(html).toContain("wiki-link missing");
    expect(html).toContain('data-missing="true"');
  });

  it("rewrites campaign media paths with the provided resolver", () => {
    const html = renderMarkdown("![Portrait](/wiki/media/Portrait-Example.png)", "gm", undefined, (path) => `/campaign-media/1/${path}`);
    expect(html).toContain('src="/campaign-media/1/Portrait-Example.png"');
    expect(html).toContain('alt="Portrait"');
  });

  it("renders sword-chronicle-sheet fenced blocks with derived stats", () => {
    const html = renderMarkdown(
      [
        "```sword-chronicle-sheet",
        "name: Ser Aldric Vane",
        "age: 32",
        "house: House Vane",
        "motto: Cut Once",
        "portrait: aldric.png",
        "defensiveBonus: 2",
        "destiny: 4",
        "destinySpent: 1",
        "abilities:",
        "  Awareness: 4",
        "  Cunning: 3",
        "  Status: 5",
        "  Agility: 3",
        "  Athletics: 4",
        "  Endurance: 4",
        "  Will: 3",
        "  Fighting:",
        "    rating: 5",
        "    specialties: [Long Blades 2]",
        "armor: { name: Mail, rating: 6, penalty: 2 }",
        "damage: 2",
        "injuries: 1",
        "oaths: [Sworn to the Riverlands]",
        "appearance: { eyes: Grey }",
        "```"
      ].join("\n"),
      "gm"
    );

    expect(html).toContain('class="scsheet"');
    expect(html).toContain("Ser Aldric Vane");
    expect(html).toContain("House Vane");
    expect(html).toContain('src="/wiki/media/aldric.png"');

    // Intrigue Defense = Awareness 4 + Cunning 3 + Status 5 = 12
    expect(html).toContain(">12</span><span class=\"scsheet-stat-key\">Intrigue Defense");
    // Combat Defense = Agility 3 + Athletics 4 + Awareness 4 + bonus 2 - penalty 2 = 11
    expect(html).toContain(">11</span><span class=\"scsheet-stat-key\">Combat Defense");
    // Composure = Will 3 x 3 = 9 ; Health = Endurance 4 x 3 = 12
    expect(html).toContain(">9</span><span class=\"scsheet-stat-key\">Composure");
    expect(html).toContain(">12</span><span class=\"scsheet-stat-key\">Health");

    // Specialties render their bonus dice alongside the ability rating.
    expect(html).toContain("Long Blades <b>2B</b>");
    expect(html).toContain("Fighting");

    // The sheet is display-only: nothing in it is clickable/rollable.
    expect(html).not.toContain("data-roll");

    // Only the abilities the sheet declares are rendered, in alphabetical order.
    const abilityNames = [...html.matchAll(/scsheet-ability-name">([^<]+)/g)].map((match) => match[1]);
    expect(abilityNames).toEqual(["Agility", "Athletics", "Awareness", "Cunning", "Endurance", "Fighting", "Status", "Will"]);

    expect(html).toContain("Sworn to the Riverlands");
    expect(html).toContain("Grey");
  });

  it("renders a setting's own ability list rather than padding to the stock one", () => {
    // Kingdom Divided swaps Warfare for Warcraft and adds Admiralty / Nautical.
    const html = renderMarkdown(
      ["```sword-chronicle-sheet", "abilities:", "  Warcraft: 4", "  Admiralty: 2", "  Nautical: 3", "```"].join("\n"),
      "gm"
    );
    expect(html).toContain("Warcraft");
    expect(html).toContain("Admiralty");
    expect(html).not.toContain("Warfare");
    expect(html).not.toContain("Marksmanship");
  });

  it("renders the full printed ability list for a sheet with no abilities", () => {
    const html = renderMarkdown("```sword-chronicle-sheet\nname: Blank\n```", "gm");
    for (const ability of ["Agility", "Animal Handling", "Warfare", "Will", "Thievery"]) {
      expect(html).toContain(ability);
    }
  });

  it("keeps sword-chronicle sheets safe from injected markup", () => {
    const html = renderMarkdown("```sword-chronicle-sheet\nname: \"<img src=x onerror=alert(1)>\"\n```", "gm");
    // The payload survives only as escaped text, never as a live tag/attribute.
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img src=x");
  });

  it("reports invalid sword-chronicle YAML instead of throwing", () => {
    const html = renderMarkdown("```sword-chronicle-sheet\n  : : bad\n\tnope\n```", "gm");
    expect(html).toContain("scsheet-error");
  });

  it("renders traveller-sheet fenced blocks as designed sheet HTML", () => {
    const html = renderMarkdown("Before\n\n```traveller-sheet\nheader:\n  left: Third Imperium\n  center: Muster File\n  right: TAS-7\nportrait: Avery.png\nname: Avery Stone\nspecies: Racial Solomani\ncharacteristics:\n  STR: 12\nskills:\n  Advocate: 0\n  Diplomat: 2\n  \"Tactics (Naval)\": 1\nitems:\n  Vacc suit patches: 3, Field kit\ngear:\n  Spare Filter: 2, backup\nweapons:\n  Laser Pistol: 3D, Medium, sidearm\narmour:\n  Cloth: 8, jacket\nholdings:\n  Ship Share: collateral\npeople:\n  Fixer: ally\npsionics:\n  Telepathy: 1, trained\n```\n\nAfter", "gm");

    expect(html).toContain('class="tsheet"');
    expect(html).toContain("Avery Stone");
    expect(html).toContain("Third Imperium");
    expect(html).toContain("Muster File");
    expect(html).toContain("TAS-7");
    expect(html).toContain('src="/wiki/media/Avery.png"');
    expect(html).toContain("Racial Solomani");
    expect(html).toContain("Diplomat");
    expect(html).toContain("Vacc Suit");
    expect(html).toContain("Admin");
    expect(html).toContain("Total levels: 3");
    expect(html).toContain('<details class="tsheet-panel tsheet-skill-details"><summary>');
    expect(html).toContain('<span>Advocate</span><span class="tsheet-skill-lvl">0</span>');
    expect(html).toContain('<span>Tactics (Naval)</span><span class="tsheet-skill-lvl">1</span>');
    expect(html).toContain('<span>Vacc Suit</span><span class="tsheet-skill-lvl">−</span>');
    expect(html).toContain("Vacc suit patches - Field kit");
    expect(html).toContain('class="tsheet-skill-lvl">x3</span>');
    expect(html).toContain("Spare Filter - backup");
    expect(html).toContain('class="tsheet-skill-lvl">x2</span>');
    expect(html).toContain("Laser Pistol");
    expect(html).toContain("3D - Medium - sidearm");
    expect(html).toContain("Cloth");
    expect(html).toContain("8 - jacket");
    expect(html).toContain("Ship Share");
    expect(html).toContain("collateral");
    expect(html).toContain("Fixer");
    expect(html).toContain("ally");
    expect(html).toContain("Telepathy");
    expect(html).toContain("1 - trained");
    expect(html).not.toContain("Wielded");
    expect(html).not.toContain("tsheet-tabs");
    const firstSkillColumn = html.slice(html.indexOf('<div class="tsheet-skill-cols">'), html.indexOf("</ul>", html.indexOf('<div class="tsheet-skill-cols">')));
    expect(firstSkillColumn).toContain("Admin");
    expect(firstSkillColumn).toContain("Flyer (Grav)");
    expect(firstSkillColumn).not.toContain("Flyer (Ornithopter)");
    expect(firstSkillColumn).not.toContain("Vacc Suit");
    expect(html).not.toContain("<code");
  });

  it("sanitizes injected scripts and event handlers", () => {
    const html = renderMarkdown('Hi <script>alert(1)</script> <img src=x onerror="alert(2)">', "gm");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });
});

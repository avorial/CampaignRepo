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
    expect(slugify("Victor Mendes")).toBe("Victor-Mendes");
    expect(slugify("  The Jardin File!  ")).toBe("The-Jardin-File");
    expect(slugify("")).toBe("untitled");
    expect(titleFromSlug("Victor-Mendes")).toBe("Victor Mendes");
  });
});

describe("wiki links", () => {
  it("parses plain and aliased links", () => {
    const links = parseWikiLinks("See [[Jardin]] and [[Victor Mendes|Victor]].");
    expect(links).toEqual([
      { target: "Jardin", label: "Jardin" },
      { target: "Victor Mendes", label: "Victor" }
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

    const raw = serializePage(fm, "Body text [[Jardin]]");
    const page = parsePage("victor", raw);
    expect(page.frontmatter.name).toBe("Victor");
    expect(page.outgoingLinks[0].target).toBe("Jardin");
  });
});

describe("link resolution", () => {
  const pages = [
    { slug: "jardin", name: "Jardin", aliases: ["The Garden"] },
    { slug: "victor-mendes", name: "Victor Mendes", aliases: [] }
  ];
  const aliasMap = buildAliasMap(pages);
  const known = new Set(pages.map((p) => p.slug));

  it("resolves by slug, name, and alias", () => {
    expect(resolveTarget(aliasMap, "Jardin")).toBe("jardin");
    expect(resolveTarget(aliasMap, "The Garden")).toBe("jardin");
    expect(resolveTarget(aliasMap, "Victor Mendes")).toBe("victor-mendes");
  });

  it("falls back to slugify and flags missing targets", () => {
    expect(resolveLinkTarget(aliasMap, known, "Jardin")).toEqual({ slug: "jardin", missing: false });
    expect(resolveLinkTarget(aliasMap, known, "Unknown Place")).toEqual({ slug: "Unknown-Place", missing: true });
  });
});

describe("renderMarkdown", () => {
  const resolve = (target: string) =>
    target.toLowerCase() === "jardin"
      ? { href: "/campaigns/1/pages/jardin", missing: false }
      : { href: "/campaigns/1/pages/" + slugify(target), missing: true };

  it("renders rich Markdown (lists, code)", () => {
    const html = renderMarkdown("- one\n- two\n\n`code`", "gm");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<code>code</code>");
  });

  it("adds heading ids and resolves section links", () => {
    const html = renderMarkdown("## Public Face\n\n[[Jardin#Public Face]]", "gm", resolve);
    expect(html).toContain('id="public-face"');
    expect(html).toContain('href="/campaigns/1/pages/jardin#public-face"');
  });

  it("renders :::gallery blocks into an image grid", () => {
    const html = renderMarkdown(":::gallery\n![](/wiki/media/a.jpg)\n![](/wiki/media/b.jpg)\n:::", "gm", undefined, (p) => `/media/${p}`);
    expect(html).toContain('class="gallery"');
    expect(html).toContain("/media/a.jpg");
    expect(html).toContain("/media/b.jpg");
  });

  it("expands ![[Page]] embeds inline", () => {
    const includeResolve = (target: string) => (target.toLowerCase() === "jardin" ? "Embedded **lore** body." : null);
    const html = renderMarkdown("Intro.\n\n![[Jardin]]", "gm", resolve, undefined, includeResolve);
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
    const html = renderMarkdown("[[Jardin]] and [[SolSec]]", "gm", resolve);
    expect(html).toContain('href="/campaigns/1/pages/jardin"');
    expect(html).toContain('class="wiki-link"');
    expect(html).toContain("wiki-link missing");
    expect(html).toContain('data-missing="true"');
  });

  it("rewrites campaign media paths with the provided resolver", () => {
    const html = renderMarkdown("![Portrait](/wiki/media/Cass-Pien.png)", "gm", undefined, (path) => `/campaign-media/1/${path}`);
    expect(html).toContain('src="/campaign-media/1/Cass-Pien.png"');
    expect(html).toContain('alt="Portrait"');
  });

  it("renders traveller-sheet fenced blocks as designed sheet HTML", () => {
    const html = renderMarkdown("Before\n\n```traveller-sheet\nname: Victor Mendes\nspecies: Racial Solomani\ncharacteristics:\n  STR: 12\nskills:\n  - name: Advocate\n    level: 0\n  - name: Diplomat\n    level: 2\ngear:\n  - name: Vacc suit patches\n    quantity: 3\n    notes: Field kit\n```\n\nAfter", "gm");

    expect(html).toContain('class="tsheet"');
    expect(html).toContain("Victor Mendes");
    expect(html).toContain("Racial Solomani");
    expect(html).toContain("Diplomat");
    expect(html).toContain("Vacc Suit");
    expect(html).toContain("Admin");
    expect(html).toContain("Total levels: 2");
    expect(html).toContain('<span>Advocate</span><span class="tsheet-skill-lvl">0</span>');
    expect(html).toContain('<span>Vacc Suit</span><span class="tsheet-skill-lvl">−</span>');
    expect(html).toContain("Vacc suit patches - Field kit");
    expect(html).toContain('class="tsheet-skill-lvl">x3</span>');
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

import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";
import { demoKitFor } from "@/lib/demo-data";
import { gameTypes } from "@/lib/templates";

const fence = (lang: string, body: string) => "```" + lang + "\n" + body + "\n```";

describe("Dragonbane sheet renderer", () => {
  const html = renderMarkdown(fence("dragonbane-sheet", [
    "name: Pib", "kin: Mallard", "profession: Thief",
    "attributes:", "  str: 8", "  agl: 16", "  wil: 11", "  con: 10",
    "conditions:", "  scared: true", "  exhausted: false",
    "hp: 7", "hp_max: 10",
    "skills:", "  sneaking: 16", "  acrobatics: 12"
  ].join("\n")), "gm");

  it("pairs each attribute with its condition", () => {
    for (const c of ["exhausted", "sickly", "dazed", "angry", "scared", "disheartened"]) {
      expect(html).toContain(c);
    }
    expect(html).toMatch(/db-cond-on[^>]*>scared/);
    expect(html).not.toMatch(/db-cond-on[^>]*>exhausted/);
  });

  it("lists the core and weapon skills with their governing attribute", () => {
    expect(html).toContain("Sneaking");
    expect(html).toContain("Hunting &amp; Fishing");   // underscore key titleized
    expect(html).toContain("Crossbows");
    expect(html).toContain("7/10");                     // hp current/max
  });
});

describe("Call of Cthulhu sheet renderer", () => {
  const html = renderMarkdown(fence("coc-sheet", [
    "name: Dr. Mara Finch", "occupation: Alienist",
    "characteristics:", "  str: 45", "  edu: 85", "  int: 75",
    "sanity: 63", "hp: 9", "hp_max: 11",
    "skills:", "  psychoanalysis: 65", "  spot_hidden: 50"
  ].join("\n")), "gm");

  it("computes the half and fifth columns the printed sheet shows", () => {
    // EDU 85 -> half 42, fifth 17 ; Psychoanalysis 65 -> 32 / 13
    expect(html).toContain("85");
    expect(html).toContain("42");
    expect(html).toContain("17");
    expect(html).toContain("65%");
    expect(html).toContain("32");
    expect(html).toContain("13");
  });

  it("shows identity and the sanity track", () => {
    expect(html).toContain("Dr. Mara Finch");
    expect(html).toContain("Alienist");
    expect(html).toContain("Sanity");
  });
});

describe("Pendragon sheet renderer", () => {
  const html = renderMarkdown(fence("pendragon-sheet", [
    "name: Sir Gareth", "homeland: Salisbury", "glory: 1240",
    "characteristics:", "  siz: 13", "  con: 14", "  str: 14", "  dex: 12",
    "traits:", "  valorous: 16", "  generous: 15",
    "passions:", "  - name: Loyalty (Lord Roderick)", "    value: 16"
  ].join("\n")), "gm");

  it("derives the opposing half of each trait pair", () => {
    // Valorous 16 implies Cowardly 4; the pair always totals 20.
    expect(html).toContain("Valorous");
    expect(html).toContain("Cowardly");
    expect(html).toMatch(/16<\/b><i>\/<\/i><b>4</);
    expect(html).toMatch(/15<\/b><i>\/<\/i><b>5</);   // Generous 15 -> Selfish 5
  });

  it("shows glory, passions, and derived hit points", () => {
    expect(html).toContain("1240");
    expect(html).toContain("Loyalty (Lord Roderick)");
    expect(html).toContain("27/27");                   // CON 14 + SIZ 13
  });
});

describe("demo library coverage", () => {
  it("Dune is a registered game system with its own kit", () => {
    expect(gameTypes).toContain("Dune: Adventures in the Imperium");
    const kit = demoKitFor("Dune: Adventures in the Imperium");
    expect(kit.sheetIsBrief).toBe(false);
    expect(kit.sheet).toContain("Drive");
    expect(kit.pc.name).toBe("Lady Ysera Reval");
  });

  it("every game system still resolves to a usable kit", () => {
    for (const game of gameTypes) {
      const kit = demoKitFor(game);
      expect(kit.premise, game).toBeTruthy();
      expect(kit.pc.name, game).toBeTruthy();
      expect(kit.sheet, game).toBeTruthy();
    }
  });

  it("the newly-written kits ship real sheets rather than generated briefs", () => {
    for (const game of ["Dragonbane", "Call of Cthulhu", "Pendragon", "Alien RPG",
      "Dark Ages: Vampire", "Wraith: The Oblivion"] as const) {
      expect(demoKitFor(game).sheetIsBrief, game).toBe(false);
    }
  });
});

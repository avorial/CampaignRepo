import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";
import { demoKitFor } from "@/lib/demo-data";
import { gameTypes } from "@/lib/templates";

const render = (lang: string, body: string[]) =>
  renderMarkdown("```" + lang + "\n" + body.join("\n") + "\n```", "gm");

describe("OSR sheet renderer", () => {
  it("takes its ability list from the data, not a fixed set", () => {
    // Mörk Borg has four abilities; the classic games have six. One renderer
    // must handle both without inventing rows the system does not use.
    const mb = render("osr-sheet", [
      "name: Grisha", "abilities:", "  agility: 1", "  presence: 2",
      "  strength: -1", "  toughness: 0", "omens: 2", "hp: 6", "hp_max: 8"
    ]);
    expect(mb).toContain("Agility");
    expect(mb).toContain("Toughness");
    expect(mb).not.toContain("Charisma");
    expect(mb).toContain("Omens");

    const ose = render("osr-sheet", [
      "name: Brick", "abilities:", "  strength: 15", "  charisma: 8", "hp_max: 13"
    ]);
    expect(ose).toContain("Charisma");
    expect(ose).not.toContain("Omens");   // only shown when the system has them
  });

  it("signs positive modifiers and shows optional resources only when present", () => {
    const html = render("osr-sheet", ["name: Wren", "abilities:", "  dexterity: 3",
      "luck: 1", "torches: 3", "hp_max: 6"]);
    expect(html).toContain("+3");
    expect(html).toContain("Luck");
    expect(html).toContain("Torches");
  });
});

describe("Warhammer d100 sheet renderer", () => {
  it("derives the characteristic bonus as the tens digit", () => {
    const html = render("warhammer-sheet", [
      "system: wfrp", "name: Grizel Vantt", "career: Witch Hunter",
      "characteristics:", "  ws: 44", "  wp: 48", "wounds_max: 13"
    ]);
    expect(html).toMatch(/Weapon Skill<\/span><b>44<\/b><em>4</);
    expect(html).toMatch(/Willpower<\/span><b>48<\/b><em>4</);
  });

  it("swaps the characteristic list and tracks between WFRP and 40k", () => {
    const wfrp = render("warhammer-sheet", ["system: wfrp", "characteristics:", "  dex: 30"]);
    expect(wfrp).toContain("Dexterity");     // WFRP has Dex; 40k does not
    expect(wfrp).toContain("Resilience");
    expect(wfrp).not.toContain("Corruption");

    const k40 = render("warhammer-sheet", ["system: 40k", "characteristics:", "  per: 42"]);
    expect(k40).toContain("Perception");     // 40k has Per; WFRP does not
    expect(k40).toContain("Corruption");
    expect(k40).toContain("Insanity");
    expect(k40).not.toContain("Resilience");
  });
});

describe("Savage Worlds sheet renderer", () => {
  const html = render("savage-sheet", [
    "name: Cass Ryder", "bennies: 3",
    "attributes:", "  agility: d8", "  smarts: 6", "  vigor: d8",
    "wounds: 1", "fatigue: 0", "parry: 6", "toughness: 7",
    "skills:", "  shooting: d10", "  notice: d8",
    "edges:", "  - Marksman", "hindrances:", "  - Loyal"
  ]);

  it("renders traits as die types, normalizing bare numbers", () => {
    expect(html).toContain("d8");
    expect(html).toContain("d10");
    expect(html).toContain("d6");   // "smarts: 6" normalized to d6
  });

  it("shows wounds and fatigue as their capped pip tracks", () => {
    expect(html).toContain("Wounds");
    expect(html).toContain("Fatigue");
    expect(html).toMatch(/sw-pip-wound/);
    expect(html).not.toMatch(/sw-pip-fatigue/);   // fatigue 0 -> no filled pips
  });

  it("shows edges, hindrances, and derived stats", () => {
    expect(html).toContain("Marksman");
    expect(html).toContain("Loyal");
    expect(html).toContain("Toughness");
  });
});

describe("demo library is complete", () => {
  it("every game system ships a real sheet, none a generated brief", () => {
    for (const game of gameTypes) {
      const kit = demoKitFor(game);
      expect(kit.sheet, game).toBeTruthy();
      expect(kit.sheetIsBrief, game).toBe(false);
    }
  });

  it("reuses an existing renderer where the system shares that chassis", () => {
    expect(demoKitFor("Pathfinder").sheet).toContain("dnd-sheet");
    expect(demoKitFor("Starfinder").sheet).toContain("dnd-sheet");
  });
});

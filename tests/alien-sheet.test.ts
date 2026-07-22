import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";
import { demoKitFor } from "@/lib/demo-data";

const sheet = [
  "```alien-sheet",
  "name: Diaz",
  "career: Colonial Marine",
  "health: 3",
  "health_max: 4",
  "stress: 2",
  "attributes:",
  "  strength: 5",
  "  agility: 4",
  "  wits: 3",
  "  empathy: 2",
  "skills:",
  "  close_combat: 2",
  "  ranged_combat: 3",
  "  medical_aid: 1",
  "weapons:",
  "  - name: M41A Pulse Rifle",
  "    bonus: '+2'",
  "    damage: 3",
  "    range: Long",
  "conditions:",
  "  exhausted: true",
  "  starving: false",
  "talents:",
  "  - Nerves of Steel",
  "```"
].join("\n");

describe("ALIEN RPG sheet renderer", () => {
  const html = renderMarkdown(sheet, "gm");

  it("renders the four Year Zero attributes with their skills", () => {
    for (const attr of ["Strength", "Agility", "Wits", "Empathy"]) expect(html).toContain(attr);
    for (const skill of ["Close Combat", "Ranged Combat", "Medical Aid", "Heavy Machinery"]) {
      expect(html).toContain(skill);
    }
  });

  it("shows identity, tracks, weapons, and talents", () => {
    expect(html).toContain("Diaz");
    expect(html).toContain("Colonial Marine");
    expect(html).toContain("3/4");           // health current/max
    expect(html).toContain("M41A Pulse Rifle");
    expect(html).toContain("Nerves of Steel");
  });

  it("marks only the conditions that are set", () => {
    expect(html).toMatch(/alien-cond-on[^>]*>exhausted/);
    expect(html).not.toMatch(/alien-cond-on[^>]*>starving/);
  });

  it("does not leave the fenced source in the output", () => {
    expect(html).not.toContain("```alien-sheet");
    expect(html).not.toContain("attributes:");
  });

  it("reports a parse error instead of throwing on bad YAML", () => {
    const bad = renderMarkdown("```alien-sheet\n: : :\n  bad\n```", "gm");
    expect(bad).toContain("alien-sheet-error");
  });

  it("the Alien RPG demo kit ships a real sheet, not a generated brief", () => {
    const kit = demoKitFor("Alien RPG");
    expect(kit.sheetIsBrief).toBe(false);
    expect(kit.sheet).toContain("alien-sheet");
    expect(kit.sheet).toContain("Diaz");
  });
});

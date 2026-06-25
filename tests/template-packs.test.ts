import { describe, expect, it } from "vitest";
import { gameTypes } from "@/lib/templates";
import { packFor } from "@/lib/template-packs";

describe("template packs", () => {
  it("includes a character sheet template for every game type", () => {
    for (const gameType of gameTypes) {
      expect(packFor(gameType).some((template) => template.slug === "character-sheet"), gameType).toBe(true);
    }
  });

  it("seeds Traveller character sheets as editable markdown blocks", () => {
    const template = packFor("Traveller").find((item) => item.slug === "character-sheet");

    expect(template?.frontmatter.sheet).toBeUndefined();
    expect(template?.body).toContain("```traveller-sheet");
    expect(template?.body).toContain("species: Racial Solomani");
    expect(template?.body).toContain("STR: 12");
    expect(template?.body).toContain("speciality: History");
    expect(template?.body).toContain("name: Vacc Suit");
    expect(template?.body).toContain("weapons: []");
    expect(template?.body).toContain("psionics: []");
  });
});

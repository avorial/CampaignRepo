import { describe, expect, it } from "vitest";
import { gameTypes } from "@/lib/templates";
import { packFor } from "@/lib/template-packs";

describe("template packs", () => {
  it("includes a character sheet template for every game type", () => {
    for (const gameType of gameTypes) {
      expect(packFor(gameType).some((template) => template.slug === "character-sheet"), gameType).toBe(true);
    }
  });

  it("seeds Traveller character sheets with editable sheet frontmatter", () => {
    const template = packFor("Traveller").find((item) => item.slug === "character-sheet");

    expect(template?.frontmatter.sheet).toMatchObject({
      system: "traveller",
      characteristics: { STR: 12, DEX: 9, END: 10, INT: 11, EDU: 10, SOC: 12 },
      species: "Racial Solomani",
      age: 34,
      rank: "F",
      dossier: "Travel",
      status: "Unwounded",
      speciesTraits: ["Racial Solomani", "Party Patronage", "Solomani Heritage", "Solomani Cause"],
      armour: [],
      weapons: []
    });
    expect(template?.frontmatter.sheet?.skills).toEqual(
      expect.arrayContaining([
        { name: "Diplomat", level: 2 },
        { name: "Science", speciality: "History", level: 1 },
        { name: "Streetwise", level: 2 }
      ])
    );
  });
});

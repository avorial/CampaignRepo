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
    expect(template?.body).toContain("header:\n  left:\n  center:\n  right:");
    expect(template?.body).toContain("portrait:\n");
    expect(template?.body).toContain("species:\n");
    expect(template?.body).toContain("status:\n");
    expect(template?.body).toContain("  STR:\n");
    expect(template?.body).toContain('  "Advocate":');
    expect(template?.body).toContain('  "Science (History)":');
    expect(template?.body).toContain('  "Profession (K\'kree Ritual)":');
    expect(template?.body).toContain('  "Vacc Suit":');
    expect(template?.body).toContain("weapons:\n# Laser Pistol: 3D, Medium, notes");
    expect(template?.body).toContain("armour:\n# Cloth: 8, notes");
    expect(template?.body).toContain("items:\n# Medkit: 1, notes");
    expect(template?.body).toContain("people:\n# Contact Name: notes");
    expect(template?.body).toContain("psionics:\n# Telepathy: 1, notes");
    expect(template?.body).not.toContain("Racial Solomani");
    expect(template?.body).not.toContain('name: "Advocate", level: 0');
  });

  it("seeds Sword Chronicle character sheets as editable markdown blocks", () => {
    const template = packFor("Sword Chronicle").find((item) => item.slug === "character-sheet");

    expect(template?.body).toContain("```sword-chronicle-sheet");
    expect(template?.body).toContain("house:\n");
    expect(template?.body).toContain("  Agility: 2");
    expect(template?.body).toContain("  Animal Handling: 2");
    expect(template?.body).toContain("  Will: 2");
    expect(template?.body).toContain("destiny: 3");
    expect(template?.body).toContain("oaths: []");
  });

  it("seeds Yellow King Paris characters with portrait panels and ready stats", () => {
    const sheet = packFor("The King in Yellow RPG").find((item) => item.slug === "character-sheet");
    const character = packFor("The King in Yellow RPG").find((item) => item.slug === "character");
    const npc = packFor("The King in Yellow RPG").find((item) => item.slug === "npc");

    expect(sheet?.body).toContain('<aside class="wiki-infobox">');
    expect(sheet?.body).toContain('<img src="/wiki/media/REPLACE.jpg" alt="Character portrait" />');
    expect(sheet?.body).toContain("<strong>Pushes:</strong> 2");
    expect(sheet?.body).toContain("I Rely On");
    expect(sheet?.body).toContain("That Deuced Peculiar Business");
    expect(sheet?.body).toContain("<caption>General Abilities</caption>");
    expect(sheet?.body).toContain("Athletics (Physical)");
    expect(sheet?.body).toContain("Sense Trouble (Presence)");

    expect(character?.body).toContain("<caption>QuickShock Stats</caption>");
    expect(character?.body).toContain("| Field | Drive | Pushes |");
    expect(character?.body).toContain("| Art History | Paintings, schools, provenance, fashionable names. |");

    expect(npc?.body).toContain('<img src="/wiki/media/REPLACE.jpg" alt="NPC portrait" />');
    expect(npc?.body).toContain("<caption>QuickShock Stats</caption>");
    expect(npc?.body).toContain("| If the characters... | This NPC... |");
  });
});

describe("template directory names", () => {
  it("sanitizes colons for Windows-safe folders and maps both forms back", async () => {
    const { templateDirName, gameTypeFromTemplateDirName } = await import("@/lib/templates");
    expect(templateDirName("Vampire: The Masquerade")).toBe("Vampire - The Masquerade");
    expect(templateDirName("Traveller")).toBe("Traveller");
    // Both the legacy colon folder and the sanitized folder resolve to the game type.
    expect(gameTypeFromTemplateDirName("Vampire - The Masquerade")).toBe("Vampire: The Masquerade");
    expect(gameTypeFromTemplateDirName("Vampire: The Masquerade")).toBe("Vampire: The Masquerade");
    expect(gameTypeFromTemplateDirName("Some Custom Dir")).toBe("Some Custom Dir");
  });
});

import { describe, it, expect } from "vitest";
import { demoPagesFor } from "@/lib/demo-data";
import { renderMarkdown } from "@/lib/markdown";
import { gameTypes } from "@/lib/templates";
import type { GameType } from "@/lib/types";

function renderedPages(game: GameType) {
  return demoPagesFor(game).map((page) => ({ page, html: renderMarkdown(page.body, "gm") }));
}

const isBroken = (html: string) =>
  /(sheet|scsheet|tsheet)-error/.test(html) || /&lt;(\/)?(div|section)/.test(html) || html.includes("<pre>");

describe("demo data", () => {
  it("renders every game's demo pages without sheet errors or markdown mangling", () => {
    const broken: string[] = [];
    for (const game of gameTypes) {
      for (const { page, html } of renderedPages(game)) {
        if (isBroken(html)) broken.push(`${game} / ${page.slug}`);
      }
    }
    expect(broken).toEqual([]);
  });

  // Tier-1 systems that have a real sheet renderer must ship a filled-in sheet
  // on their demo sample PC, not a GM-facing design brief.
  const tier1: { game: GameType; marker: string; pc: string }[] = [
    { game: "Dungeons & Dragons", marker: "Armor Class", pc: "Rilla Windmere" },
    { game: "Traveller", marker: "tsheet", pc: "Renner" },
    { game: "Vampire: The Masquerade", marker: "Blood Pool", pc: "Nico Alvarez" },
    { game: "Werewolf: The Apocalypse", marker: "Gnosis", pc: "Ash Redhand" },
    { game: "Mage: The Ascension", marker: "mage-sheet", pc: "Jax" },
    { game: "Sword Chronicle", marker: "scsheet", pc: "Lady Elyse Vaelor" }
  ];

  it.each(tier1)("$game demo PC renders a real filled sheet", ({ game, marker, pc }) => {
    const pcPage = demoPagesFor(game).find((p) => p.body.includes(pc) && p.body.includes("Character Sheet"));
    expect(pcPage, `${game} sample PC page`).toBeTruthy();
    const html = renderMarkdown(pcPage!.body, "gm");
    expect(html).toContain(marker);
    expect(isBroken(html)).toBe(false);
    expect(pcPage!.body).not.toContain("Sheet Design Brief");
  });
});

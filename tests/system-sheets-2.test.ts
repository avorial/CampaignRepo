import { describe, expect, it } from "vitest";
import { renderMarkdown } from "@/lib/markdown";
import { demoKitFor } from "@/lib/demo-data";

const fence = (lang: string, body: string[]) => "```" + lang + "\n" + body.join("\n") + "\n```";
const render = (lang: string, body: string[]) => renderMarkdown(fence(lang, body), "gm");

describe("Fate Core sheet renderer", () => {
  const html = render("fate-sheet", [
    "name: Sam Okoro", "fate_points: 3", "refresh: 3",
    "aspects:", "  high_concept: Ex-Thief With a Conscience", "  trouble: Old Debts Come Calling",
    "skills:", "  burglary: 5", "  notice: 4", "  contacts: 4", "  fight: 1"
  ]);
  it("groups skills onto the ladder rungs", () => {
    expect(html).toContain("Superb (+5)");
    expect(html).toContain("Burglary");
    // Two skills share Great (+4) and should appear together on that rung.
    expect(html).toMatch(/Great \(\+4\)<\/span><b>Contacts, Notice</);
    expect(html).toContain("Average (+1)");
  });
  it("shows aspects and fate points", () => {
    expect(html).toContain("Ex-Thief With a Conscience");
    expect(html).toContain("Old Debts Come Calling");
  });
});

describe("Mothership sheet renderer", () => {
  const html = render("mothership-sheet", [
    "name: Kowalski", "class: Teamster",
    "stats:", "  strength: 35", "  combat: 25",
    "saves:", "  sanity: 30", "  body: 40",
    "health: 14", "health_max: 18", "stress: 4",
    "trained:", "  - Industrial Equipment", "expert:", "  - Mechanical Repair"
  ]);
  it("separates stats, saves, and the three skill tiers", () => {
    expect(html).toContain("strength");
    expect(html).toContain("sanity");
    expect(html).toContain("Trained");
    expect(html).toContain("Expert");
    expect(html).toContain("Master");
    expect(html).toContain("Industrial Equipment");
    expect(html).toContain("14/18");
  });
});

describe("Delta Green sheet renderer", () => {
  const html = render("delta-green-sheet", [
    "name: Agent REED", "profession: Special Agent (FBI)",
    "statistics:", "  str: 12", "  int: 15",
    "hp: 13", "hp_max: 13", "san: 51", "san_max: 70",
    "bonds:", "  - name: Spouse (Dana)", "    score: 11",
    "adaptation:", "  violence: 1",
    "skills:", "  criminology: 60"
  ]);
  it("computes the x5 column the form prints", () => {
    expect(html).toContain("75%");   // INT 15 x5
    expect(html).toContain("60%");   // STR 12 x5 (and criminology 60)
  });
  it("shows bonds and the adaptation boxes", () => {
    expect(html).toContain("Spouse (Dana)");
    expect(html).toContain("Violence");
    expect(html).toContain("Helplessness");
    expect(html).toMatch(/dg-box-on/);
  });
});

describe("Cyberpunk RED sheet renderer", () => {
  const html = render("cyberpunk-sheet", [
    "handle: Static", "role: Netrunner",
    "stats:", "  int: 8", "  ref: 6", "  tech: 7", "  body: 4",
    "hp: 22", "hp_max: 30", "humanity: 34", "humanity_max: 40",
    "skills:", "  cryptography: 6", "  handgun: 3"
  ]);
  it("derives BASE as stat plus level", () => {
    // Cryptography is INT-based: INT 8 + level 6 = 14
    expect(html).toMatch(/Cryptography<\/span><i>INT<\/i><b>6<\/b><em>14</);
    // Handgun is REF-based: REF 6 + level 3 = 9
    expect(html).toMatch(/Handgun<\/span><i>REF<\/i><b>3<\/b><em>9</);
  });
  it("reports the wound state from current hit points", () => {
    // RED: below full HP is Lightly Wounded; Seriously only below half.
    expect(html).toContain("Lightly Wounded");
    const hurt = render("cyberpunk-sheet", ["handle: Static", "hp: 12", "hp_max: 30"]);
    expect(hurt).toContain("Seriously Wounded");
    const down = render("cyberpunk-sheet", ["handle: Static", "hp: 0", "hp_max: 30"]);
    expect(down).toContain("Mortally Wounded");
    const fine = render("cyberpunk-sheet", ["handle: Static", "hp_max: 30"]);
    expect(fine).toContain("Unhurt");   // unspecified current means undamaged
  });
  it("shows humanity", () => {
    expect(html).toContain("34/40");
  });
});

describe("Blades in the Dark sheet renderer", () => {
  const html = render("blades-sheet", [
    "name: Quill", "playbook: Whisper", "stress: 4",
    "trauma:", "  - haunted",
    "actions:", "  attune: 3", "  study: 2", "  survey: 1", "  consort: 1", "  prowl: 1"
  ]);
  it("rates an attribute by how many of its actions have dots", () => {
    // Insight: study 2, survey 1 -> rating 2. Resolve: attune 3, consort 1 -> 2.
    expect(html).toMatch(/Insight<\/span><b>2</);
    expect(html).toMatch(/Resolve<\/span><b>2</);
    expect(html).toMatch(/Prowess<\/span><b>1</);
  });
  it("marks only the trauma actually taken", () => {
    expect(html).toMatch(/bitd-trauma-on[^>]*>haunted/);
    expect(html).not.toMatch(/bitd-trauma-on[^>]*>vicious/);
  });
  it("shows the stress track", () => expect(html).toContain("4/9"));
});

describe("Coriolis sheet renderer", () => {
  const html = render("coriolis-sheet", [
    "name: Rurik", "concept: Free trader captain", "icon: The Merchant", "birr: 1200",
    "attributes:", "  agility: 4", "  wits: 4",
    "hp: 8", "hp_max: 10", "mp_max: 10",
    "skills:", "  pilot: 3", "  manipulation: 3"
  ]);
  it("groups Coriolis skills under their Year Zero attribute", () => {
    expect(html).toContain("Pilot");
    expect(html).toContain("Data Djinn");
    expect(html).toContain("Medicurgy");
    expect(html).toContain("Agility");
  });
  it("shows icon, birr, and both point tracks", () => {
    expect(html).toContain("The Merchant");
    expect(html).toContain("1200");
    expect(html).toContain("8/10");
    expect(html).toContain("10/10");   // mind points default to max
  });
});

describe("all six kits now ship real sheets", () => {
  it("no longer falls back to a generated brief", () => {
    for (const game of ["Fate Core", "Mothership", "Delta Green",
      "Cyberpunk RED", "Blades in the Dark", "Coriolis"] as const) {
      const kit = demoKitFor(game);
      expect(kit.sheetIsBrief, game).toBe(false);
      expect(kit.sheet, game).toContain("-sheet");
    }
  });
});

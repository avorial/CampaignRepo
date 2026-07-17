import { describe, expect, it } from "vitest";
import { analyzeSessionAgenda, formatMinutes } from "@/lib/session-readiness";
import { parseSession, serializeSession, type SessionFrontmatter } from "@/lib/sessions";

describe("session readiness", () => {
  it("scores a varied agenda and reports expected runtime", () => {
    const analysis = analyzeSessionAgenda([
      { text: "Recap the last cliffhanger", done: false, sceneType: "recap", duration: 5 },
      { text: "Follow the spoor through the old quarter", done: false, sceneType: "investigation", duration: 35 },
      { text: "Negotiate with the guild factor", done: false, sceneType: "social", duration: 25 },
      { text: "Ambush on the bridge", done: false, sceneType: "combat", duration: 45, externalAction: true }
    ]);

    expect(analysis.expectedMinutes).toBe(110);
    expect(analysis.typedScenes).toBe(4);
    expect(analysis.varietyCount).toBe(4);
    expect(analysis.score).toBeGreaterThan(70);
    expect(analysis.notes).toContain("Pacing looks ready for the table.");
  });

  it("flags underspecified agendas", () => {
    const analysis = analyzeSessionAgenda([
      { text: "Opening scene", done: false },
      { text: "Second scene", done: false }
    ]);

    expect(analysis.score).toBeLessThan(50);
    expect(analysis.notes).toContain("Tag most beats with scene types so pacing can be judged.");
  });

  it("formats session duration for compact display", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(135)).toBe("2h 15m");
  });
});

describe("session frontmatter", () => {
  it("round-trips scene metadata and handouts", () => {
    const frontmatter: SessionFrontmatter = {
      title: "Session 3",
      attendees: [],
      assets: [],
      agenda: [
        { text: "Investigate the shrine", done: false, sceneType: "investigation", duration: 30 },
        { text: "Fight the cult champion", done: false, sceneType: "combat", duration: 40, externalAction: true }
      ],
      npcs: [],
      locations: [],
      threads: [],
      pinned: [],
      handouts: ["sealed-letter"]
    };

    const text = serializeSession(frontmatter, "GM notes");
    const parsed = parseSession("session-3", text);

    expect(parsed.frontmatter.agenda).toEqual(frontmatter.agenda);
    expect(parsed.frontmatter.handouts).toEqual(["sealed-letter"]);
    expect(parsed.notes.trim()).toBe("GM notes");
  });
});

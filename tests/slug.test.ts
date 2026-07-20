import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify fallback contract", () => {
  it("returns an empty string for input with no usable characters", () => {
    // The old hard-coded "untitled" was truthy, so every `slugify(x) || fb`
    // guard in the codebase was dead. Callers must be able to detect failure.
    for (const input of ["", "   ", "!!!", "???", "---", "'\""]) {
      expect(slugify(input)).toBe("");
    }
  });

  it("uses the caller's fallback when given one", () => {
    expect(slugify("", "untitled")).toBe("untitled");
    expect(slugify("!!!", "template")).toBe("template");
    expect(slugify("Real Name", "unused")).toBe("Real-Name");
  });

  it("makes `slugify(x) || fallback` guards live again", () => {
    const sessionSlug = (title: string) => slugify(title) || `session-${title.length}`;
    // Two untitled records must not collapse onto one colliding slug.
    expect(sessionSlug("!!!")).toBe("session-3");
    expect(sessionSlug("????")).toBe("session-4");
    expect(sessionSlug("Session One")).toBe("Session-One");
  });

  it("still preserves case and strips quotes", () => {
    expect(slugify("Avery's Stone")).toBe("Averys-Stone");
    expect(slugify("The Lantern File!")).toBe("The-Lantern-File");
  });
});

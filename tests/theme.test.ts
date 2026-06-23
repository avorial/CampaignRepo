import { describe, it, expect } from "vitest";
import { sanitizeTheme, themeToCssVars, hexToRgba, lighten, isValidHex } from "@/lib/theme";

describe("theme sanitization", () => {
  it("keeps valid hex colors and known fonts, drops the rest", () => {
    const theme = sanitizeTheme({ accent: "#ff8800", accent2: "#abc", displayFont: "Cinzel", banner: "banner.png", junk: 1 });
    expect(theme).toEqual({ accent: "#ff8800", accent2: "#abc", displayFont: "Cinzel", banner: "banner.png" });
  });

  it("rejects bad colors, unknown fonts, and traversal banners", () => {
    const theme = sanitizeTheme({ accent: "red", accent2: "#12345", displayFont: "Comic Sans", banner: "../secret.png" });
    expect(theme).toEqual({});
  });

  it("validates hex shapes", () => {
    expect(isValidHex("#abc")).toBe(true);
    expect(isValidHex("#aabbcc")).toBe(true);
    expect(isValidHex("#ggg")).toBe(false);
    expect(isValidHex("blue")).toBe(false);
  });
});

describe("theme to css vars", () => {
  it("maps accents to gold/purple variables with derived glow + bright", () => {
    const vars = themeToCssVars({ accent: "#d4a957", accent2: "#a075ff", displayFont: "Cinzel" });
    expect(vars["--gold"]).toBe("#d4a957");
    expect(vars["--purple"]).toBe("#a075ff");
    expect(vars["--gold-glow"]).toBe("rgba(212, 169, 87, 0.25)");
    expect(vars["--gold-bright"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars["--font-display"]).toContain("Cinzel");
  });

  it("returns no vars for an empty theme", () => {
    expect(themeToCssVars({})).toEqual({});
  });
});

describe("color helpers", () => {
  it("expands short hex for rgba", () => {
    expect(hexToRgba("#abc", 0.5)).toBe("rgba(170, 187, 204, 0.5)");
  });

  it("lightens toward white", () => {
    expect(lighten("#000000", 0.5)).toBe("#808080");
    expect(lighten("#ffffff", 0.5)).toBe("#ffffff");
  });
});

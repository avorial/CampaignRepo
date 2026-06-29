import { themePresetNames, type ThemePreset } from "@/lib/game-pack-branding";

// Pure, client-safe campaign theming helpers. No db/github imports here so this
// module can be bundled into client components for live theme previews.

export type CampaignTheme = {
  preset?: ThemePreset;
  accent?: string;
  accent2?: string;
  displayFont?: string;
  banner?: string;
  logo?: string;
};

/** Curated display fonts (all preloaded globally in app/layout.tsx). */
export const themeFonts: Record<string, string> = {
  Fraunces: '"Fraunces", "Cormorant Garamond", Georgia, serif',
  Cinzel: '"Cinzel", "Fraunces", Georgia, serif',
  "Cormorant Garamond": '"Cormorant Garamond", Georgia, serif',
  "Uncial Antiqua": '"Uncial Antiqua", "Fraunces", serif',
  "IM Fell English": '"IM Fell English", Georgia, serif'
};

export const themeFontNames = Object.keys(themeFonts);

export const defaultAccent = "#d4a957";
export const defaultAccent2 = "#a075ff";

const hexPattern = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHex(value: unknown): value is string {
  return typeof value === "string" && hexPattern.test(value.trim());
}

function expandHex(hex: string) {
  const clean = hex.trim().replace(/^#/, "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

export function hexToRgba(hex: string, alpha: number) {
  const { r, g, b } = expandHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Mix a hex color toward white by `amount` (0..1) for a brighter hover tone. */
export function lighten(hex: string, amount: number) {
  const { r, g, b } = expandHex(hex);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/** Validate/sanitize an arbitrary parsed object into a CampaignTheme. */
export function sanitizeTheme(input: unknown): CampaignTheme {
  const theme: CampaignTheme = {};
  if (!input || typeof input !== "object") return theme;
  const raw = input as Record<string, unknown>;
  if (typeof raw.preset === "string" && themePresetNames.includes(raw.preset as ThemePreset)) theme.preset = raw.preset as ThemePreset;
  if (isValidHex(raw.accent)) theme.accent = raw.accent.trim();
  if (isValidHex(raw.accent2)) theme.accent2 = raw.accent2.trim();
  if (typeof raw.displayFont === "string" && themeFonts[raw.displayFont]) theme.displayFont = raw.displayFont;
  if (typeof raw.banner === "string" && raw.banner.trim() && !raw.banner.includes("..")) theme.banner = raw.banner.trim();
  if (typeof raw.logo === "string" && raw.logo.trim() && !raw.logo.includes("..")) theme.logo = raw.logo.trim();
  return theme;
}

/** Map a theme to CSS custom properties suitable for a React style object. */
export function themeToCssVars(theme: CampaignTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  const shouldApplyAccent = !theme.preset || theme.accent !== defaultAccent;
  const shouldApplyAccent2 = !theme.preset || theme.accent2 !== defaultAccent2;
  const shouldApplyDisplayFont = !theme.preset || theme.displayFont !== "Fraunces";
  if (theme.accent && shouldApplyAccent) {
    vars["--gold"] = theme.accent;
    vars["--gold-bright"] = lighten(theme.accent, 0.18);
    vars["--gold-glow"] = hexToRgba(theme.accent, 0.25);
    vars["--accent"] = theme.accent;
  }
  if (theme.accent2 && shouldApplyAccent2) {
    vars["--purple"] = theme.accent2;
    vars["--purple-glow"] = hexToRgba(theme.accent2, 0.35);
    vars["--accent-2"] = theme.accent2;
  }
  if (theme.displayFont && themeFonts[theme.displayFont] && shouldApplyDisplayFont) {
    vars["--font-display"] = themeFonts[theme.displayFont];
  }
  return vars;
}

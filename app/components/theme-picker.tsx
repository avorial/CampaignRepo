"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { themePresetNames, themePresetLabels, type ThemePreset } from "@/lib/game-pack-branding";

const STORAGE_KEY = "cr-theme-pref";
// "auto" = follow whatever the page/campaign sets; any preset key = force that theme.
type Pref = "auto" | ThemePreset;

// Inline custom-accent/font vars a campaign can set (see lib/theme.ts themeToCssVars).
// An explicit pick strips these so the chosen theme fully wins; Auto restores them.
const OVERRIDE_VARS = ["--gold", "--gold-bright", "--gold-glow", "--accent", "--purple", "--purple-glow", "--accent-2", "--font-display"];

// Auth screens have no app-shell to retheme, so the picker stays out of the way there.
const HIDDEN_PREFIXES = ["/login", "/register", "/change-password"];

/**
 * Floating theme picker, pinned bottom-left on every app page. Persists a
 * browser-local preferred theme and overrides the server-set data-theme on the
 * current .app-shell, re-applying after client-side navigation.
 */
export default function ThemePicker() {
  const pathname = usePathname() || "";
  const [pref, setPref] = useState<Pref>("auto");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load the stored preference once on mount.
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "auto" || (saved !== null && (themePresetNames as readonly string[]).includes(saved))) {
        setPref(saved as Pref);
      }
    } catch { /* ignore */ }
  }, []);

  // Apply the override to the app-shell whenever the preference or route changes.
  useEffect(() => {
    if (!mounted) return;
    const shell = document.querySelector<HTMLElement>(".app-shell");
    if (!shell) return;
    // Snapshot the page's own defaults once (before we ever override this shell):
    // the server-set data-theme and any inline custom accent/font vars.
    if (!shell.hasAttribute("data-theme-auto")) {
      shell.setAttribute("data-theme-auto", shell.getAttribute("data-theme") || "");
      const saved: Record<string, string> = {};
      for (const v of OVERRIDE_VARS) {
        const value = shell.style.getPropertyValue(v);
        if (value) saved[v] = value;
      }
      shell.setAttribute("data-theme-vars", JSON.stringify(saved));
    }
    const auto = shell.getAttribute("data-theme-auto") || "";
    const savedVars: Record<string, string> = JSON.parse(shell.getAttribute("data-theme-vars") || "{}");
    const effective = pref === "auto" ? auto : pref;
    if (effective) shell.setAttribute("data-theme", effective);
    else shell.removeAttribute("data-theme");
    if (pref === "auto") {
      // Restore the campaign's own accents/font.
      for (const v of OVERRIDE_VARS) {
        if (savedVars[v]) shell.style.setProperty(v, savedVars[v]);
        else shell.style.removeProperty(v);
      }
    } else {
      // Explicit pick fully wins — drop inline accents so the theme's own values show.
      for (const v of OVERRIDE_VARS) shell.style.removeProperty(v);
    }
  }, [pref, pathname, mounted]);

  if (!mounted) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const choose = (value: Pref) => {
    setPref(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
    setOpen(false);
  };

  const currentLabel = pref === "auto" ? "Auto" : themePresetLabels[pref];

  return (
    <div className="theme-switch-fab">
      {open && (
        <div className="theme-menu" role="menu" aria-label="Preferred theme">
          <div className="theme-menu-label">Preferred theme</div>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={pref === "auto"}
            className={pref === "auto" ? "theme-menu-item active" : "theme-menu-item"}
            onClick={() => choose("auto")}
          >
            Auto — follow the campaign
          </button>
          {themePresetNames.map((preset) => (
            <button
              key={preset || "base"}
              type="button"
              role="menuitemradio"
              aria-checked={pref === preset}
              className={pref === preset ? "theme-menu-item active" : "theme-menu-item"}
              onClick={() => choose(preset)}
            >
              {themePresetLabels[preset]}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="theme-fab-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="theme-fab-dot" aria-hidden="true" />
        Theme: {currentLabel}
      </button>
    </div>
  );
}

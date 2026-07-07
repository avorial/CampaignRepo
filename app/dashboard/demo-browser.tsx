"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import { gameTypeGroups } from "@/lib/templates";
import { demoKitFor, demoPagesFor } from "@/lib/demo-data";
import type { GameType } from "@/lib/types";

const OPEN_KEY = "cr-demo-browser-open";

/**
 * Collapsible dashboard panel for browsing each game system's demo content
 * without creating a campaign. The same pages are what a campaign seeds on
 * opt-in. Open by default on first visit, then remembers its state.
 */
export default function DemoBrowser() {
  const [game, setGame] = useState<GameType>("Dungeons & Dragons");
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    try { setOpen(localStorage.getItem(OPEN_KEY) !== "closed"); } catch { setOpen(true); }
  }, []);

  const onToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const next = event.currentTarget.open;
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, next ? "open" : "closed"); } catch { /* ignore */ }
  };

  const pages = demoPagesFor(game);
  const kit = demoKitFor(game);
  const sheetBrief = kit.sheetBrief;

  return (
    <section className="dashboard-grid">
      <details className="panel dashboard-toggle-panel" open={ready && open} onToggle={onToggle}>
        <summary>
          <span>Demo library</span>
          <small>Preview example content per game</small>
        </summary>
        <div className="dashboard-toggle-body demo-browser">
          <label>
            Game system
            <select value={game} onChange={(event) => setGame(event.target.value as GameType)}>
              {gameTypeGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.types.map((type) => <option key={type} value={type}>{type}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="demo-research-summary">
            <span className="demo-research-status">{kit.researchStatus || "base"}</span>
            <p className="muted create-page-hint">Opt in from a campaign&apos;s workspace to seed these example pages into that repo.</p>
          </div>
          {sheetBrief && (
            <details className="demo-sheet-brief">
              <summary>Sheet direction</summary>
              <p>{sheetBrief.layoutDirection}</p>
              <div className="demo-brief-columns">
                <div>
                  <h4>Fields</h4>
                  <ul>{sheetBrief.fieldGroups.map((field) => <li key={field}>{field}</li>)}</ul>
                </div>
                <div>
                  <h4>Visual notes</h4>
                  <ul>{sheetBrief.visualNotes.map((note) => <li key={note}>{note}</li>)}</ul>
                </div>
              </div>
            </details>
          )}
          <div className="demo-preview-grid">
            {pages.map((page) => (
              <details key={page.slug} className="demo-preview-card">
                <summary>
                  <strong>{page.name}</strong>
                  <span className="demo-preview-cat">{page.category}{page.visibility === "gm" ? " - GM" : ""}</span>
                </summary>
                <p className="muted">{page.summary}</p>
              </details>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Logo from "@/app/components/logo";

type Site = { slug: string; name: string; gameType: string; clones: number };

export default function PublicGalleryClient({ sites }: { sites: Site[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((s) => s.name.toLowerCase().includes(needle) || s.gameType.toLowerCase().includes(needle));
  }, [sites, query]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <Logo href="/site" />
          <h1>Explore worlds</h1>
          <p className="muted">Browse published RPG campaigns — no account needed.</p>
        </div>
        <div className="topbar-actions">
          <Link href="/login" className="quiet-link">Sign in</Link>
        </div>
      </header>

      <div className="gallery-shell">
        <input
          className="gallery-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search worlds by name or system…"
          aria-label="Search public worlds"
        />
        <p className="gallery-count">{filtered.length} of {sites.length} world{sites.length === 1 ? "" : "s"}</p>

        {sites.length === 0 ? (
          <p className="public-empty">No public worlds have been published yet.</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No worlds match "{query}".</p>
        ) : (
          <div className="gallery-grid">
            {filtered.map((s) => (
              <Link key={s.slug} className="gallery-card" href={`/site/${s.slug}`}>
                <strong>{s.name}</strong>
                <span>{s.gameType}{s.clones > 0 ? ` · ${s.clones} clone${s.clones === 1 ? "" : "s"}` : ""}</span>
                <span className="gallery-card-cta">View world →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

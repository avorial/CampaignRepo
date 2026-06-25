"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Site = { slug: string; name: string; gameType: string };

export default function PublicGalleryClient({ sites }: { sites: Site[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sites;
    return sites.filter((s) => s.name.toLowerCase().includes(needle) || s.gameType.toLowerCase().includes(needle));
  }, [sites, query]);

  return (
    <div className="public-site">
      <header className="public-masthead">
        <div className="public-masthead-inner">
          <p className="public-kicker">CampaignRepo · Public worlds</p>
          <h1>Explore worlds</h1>
          <p>Browse published RPG campaigns. Read and search any world — no account needed.</p>
        </div>
      </header>

      <main className="gallery-shell">
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
          <p className="muted">No worlds match “{query}”.</p>
        ) : (
          <div className="gallery-grid">
            {filtered.map((s) => (
              <Link key={s.slug} className="gallery-card" href={`/site/${s.slug}`}>
                <strong>{s.name}</strong>
                <span>{s.gameType}</span>
                <span className="gallery-card-cta">View world →</span>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="public-footer">
        <span>Published with CampaignRepo</span>
        <Link className="quiet-link" href="/login">Sign in</Link>
      </footer>
    </div>
  );
}

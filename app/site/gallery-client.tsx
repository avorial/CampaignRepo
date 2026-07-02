"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Logo from "@/app/components/logo";

type Site = { slug: string; name: string; gameType: string; clones: number; publishedAt: string; description: string | null; tags: string[] };
type SortKey = "clones" | "az" | "newest";

export default function PublicGalleryClient({ sites }: { sites: Site[] }) {
  const [query, setQuery] = useState("");
  const [systemFilter, setSystemFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("clones");

  const systems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sites) counts.set(s.gameType, (counts.get(s.gameType) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [sites]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sites) for (const t of (s.tags || [])) counts.set(t, (counts.get(t) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [sites]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let result = sites;
    if (systemFilter) result = result.filter((s) => s.gameType === systemFilter);
    if (tagFilter) result = result.filter((s) => (s.tags || []).includes(tagFilter));
    if (needle) result = result.filter((s) => s.name.toLowerCase().includes(needle) || s.gameType.toLowerCase().includes(needle) || (s.tags || []).some((t) => t.includes(needle)));
    if (sort === "clones") return [...result].sort((a, b) => b.clones - a.clones || a.name.localeCompare(b.name));
    if (sort === "newest") return [...result].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, query, systemFilter, tagFilter, sort]);

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
        <div className="gallery-controls">
          <input
            className="gallery-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search worlds by name, system, or tag…"
            aria-label="Search public worlds"
          />
          <div className="gallery-sort">
            <span className="gallery-sort-label">Sort:</span>
            <button type="button" className={`gallery-sort-btn${sort === "clones" ? " active" : ""}`} onClick={() => setSort("clones")}>Most cloned</button>
            <button type="button" className={`gallery-sort-btn${sort === "az" ? " active" : ""}`} onClick={() => setSort("az")}>A–Z</button>
            <button type="button" className={`gallery-sort-btn${sort === "newest" ? " active" : ""}`} onClick={() => setSort("newest")}>Newest</button>
          </div>
        </div>

        {systems.length > 1 && (
          <div className="gallery-systems">
            <button
              type="button"
              className={`gallery-system-chip${systemFilter === null ? " active" : ""}`}
              onClick={() => setSystemFilter(null)}
            >
              All systems
            </button>
            {systems.map(([sys, count]) => (
              <button
                key={sys}
                type="button"
                className={`gallery-system-chip${systemFilter === sys ? " active" : ""}`}
                onClick={() => setSystemFilter(systemFilter === sys ? null : sys)}
              >
                {sys} <span className="gallery-system-count">{count}</span>
              </button>
            ))}
          </div>
        )}

        {allTags.length > 0 && (
          <div className="gallery-tags">
            {tagFilter && (
              <button
                type="button"
                className="gallery-tag-chip active"
                onClick={() => setTagFilter(null)}
              >
                ✕ {tagFilter}
              </button>
            )}
            {allTags.filter(([t]) => t !== tagFilter).map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                className="gallery-tag-chip"
                onClick={() => setTagFilter(tag)}
              >
                {tag} <span className="gallery-system-count">{count}</span>
              </button>
            ))}
          </div>
        )}

        <p className="gallery-count">{filtered.length} of {sites.length} world{sites.length === 1 ? "" : "s"}</p>

        {sites.length === 0 ? (
          <p className="public-empty">No public worlds have been published yet.</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No worlds match your search.</p>
        ) : (
          <div className="gallery-grid">
            {filtered.map((s) => (
              <Link key={s.slug} className="gallery-card" href={`/site/${s.slug}`}>
                <strong>{s.name}</strong>
                <span className="gallery-card-system">{s.gameType}</span>
                {s.description && <span className="gallery-card-description">{s.description}</span>}
                {(s.tags || []).length > 0 && (
                  <div className="gallery-card-tags">
                    {s.tags.map((t) => <span key={t} className="gallery-card-tag">{t}</span>)}
                  </div>
                )}
                <span className="gallery-card-meta">{s.clones > 0 ? `${s.clones} clone${s.clones === 1 ? "" : "s"}` : "Be the first to clone"}</span>
                <span className="gallery-card-cta">View world →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

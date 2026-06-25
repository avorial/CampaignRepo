"use client";

import { CSSProperties, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { WikiPage } from "@/lib/types";
import { renderMarkdown, type MediaPathResolver, type WikiLinkResolver } from "@/lib/markdown";
import { buildAliasMap, resolveLinkTarget } from "@/lib/links";
import { themeToCssVars, type CampaignTheme } from "@/lib/theme";

export default function PublicSiteClient({
  slug,
  campaignName,
  gameType,
  pages,
  theme
}: {
  slug: string;
  campaignName: string;
  gameType: string;
  pages: WikiPage[];
  theme: CampaignTheme;
}) {
  const [selectedSlug, setSelectedSlug] = useState(pages[0]?.slug || "");
  const [query, setQuery] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneMsg, setCloneMsg] = useState("");

  async function cloneWorld() {
    setCloning(true);
    setCloneMsg("Cloning this world into your own repo…");
    const res = await fetch(`/api/site/${slug}/clone`, { method: "POST" });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.campaignId) {
      window.location.href = `/campaigns/${data.campaignId}`;
      return;
    }
    setCloning(false);
    setCloneMsg(data.error || "Could not clone this world.");
  }

  useEffect(() => {
    const hashSlug = window.location.hash.replace(/^#/, "");
    if (hashSlug && pages.some((page) => page.slug === hashSlug)) setSelectedSlug(hashSlug);
  }, [pages]);

  const filteredPages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return pages;
    return pages.filter((page) => {
      const haystack = [
        page.frontmatter.name,
        page.frontmatter.summary,
        page.frontmatter.category,
        ...(page.frontmatter.tags || []),
        ...(page.frontmatter.aliases || [])
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [pages, query]);

  const selectedPage = pages.find((page) => page.slug === selectedSlug) || filteredPages[0] || pages[0];

  // Group the sidebar by category, in a stable, friendly order.
  const categoryOrder = ["lore", "location", "organization", "character", "npc", "species", "item", "event", "game"];
  const grouped = useMemo(() => {
    const byCat = new Map<string, WikiPage[]>();
    for (const page of filteredPages) {
      const cat = page.frontmatter.category || "lore";
      byCat.set(cat, [...(byCat.get(cat) || []), page]);
    }
    return [...byCat.entries()].sort(
      (a, b) => (categoryOrder.indexOf(a[0]) + 1 || 99) - (categoryOrder.indexOf(b[0]) + 1 || 99) || a[0].localeCompare(b[0])
    );
  }, [filteredPages]);

  const resolveLink = useMemo<WikiLinkResolver>(() => {
    const aliasMap = buildAliasMap(
      pages.map((page) => ({ slug: page.slug, name: page.frontmatter.name, aliases: page.frontmatter.aliases || [] }))
    );
    const knownSlugs = new Set(pages.map((page) => page.slug));
    return (target: string) => {
      const { slug: resolved, missing } = resolveLinkTarget(aliasMap, knownSlugs, target);
      return { href: `#${resolved}`, missing };
    };
  }, [pages]);

  const resolveMedia = useMemo<MediaPathResolver>(
    () => (path: string) => `/public-media/${slug}/${path.split("/").map(encodeURIComponent).join("/")}`,
    [slug]
  );

  const preview = useMemo(
    () => renderMarkdown(selectedPage?.content || "", "handout", resolveLink, resolveMedia),
    [selectedPage, resolveLink, resolveMedia]
  );

  const onPreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const anchor = (event.target as HTMLElement).closest("a.wiki-link");
      if (!anchor) return;
      event.preventDefault();
      if (anchor.getAttribute("data-missing") === "true") return;
      const target = (anchor.getAttribute("href") || "").replace(/^#/, "");
      if (pages.some((page) => page.slug === target)) {
        setSelectedSlug(target);
        window.history.replaceState(null, "", `#${target}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [pages]
  );

  const cover = selectedPage?.frontmatter.cover ? resolveMedia(selectedPage.frontmatter.cover) : "";
  const themeVars = useMemo(() => themeToCssVars(theme) as CSSProperties, [theme]);
  const banner = theme.banner ? resolveMedia(theme.banner) : "";

  return (
    <main className="public-site" data-theme={theme.preset || undefined} style={themeVars}>
      <header className={banner ? "public-masthead has-banner" : "public-masthead"} style={banner ? { backgroundImage: `linear-gradient(180deg, rgba(8,5,15,0.35), rgba(8,5,15,0.92)), url("${banner}")` } : undefined}>
        <div className="public-masthead-inner">
          <span className="public-kicker">{gameType}</span>
          <h1>{campaignName}</h1>
          <p>A published world powered by CampaignRepo</p>
          <div className="public-masthead-actions">
            <button type="button" className="button" onClick={cloneWorld} disabled={cloning}>Clone this world</button>
            {cloneMsg && <span className="muted">{cloneMsg}</span>}
          </div>
        </div>
      </header>

      <div className="public-shell">
        <aside className="public-library">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this world" />
          {grouped.map(([cat, catPages]) => (
            <div className="public-nav-group" key={cat}>
              <h3>
                <span className="cat-dot" style={{ background: `var(--cat-${cat})` }} />
                {cat}
              </h3>
              {catPages.map((page) => (
                <button
                  type="button"
                  key={page.slug}
                  className={page.slug === selectedPage?.slug ? "public-nav-link active" : "public-nav-link"}
                  onClick={() => {
                    setSelectedSlug(page.slug);
                    window.history.replaceState(null, "", `#${page.slug}`);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {page.frontmatter.name}
                </button>
              ))}
            </div>
          ))}
          {!filteredPages.length && <p className="muted">No public pages match.</p>}
        </aside>

        <article className="public-reader">
          {selectedPage ? (
            <>
              {cover && <div className="public-cover" style={{ backgroundImage: `url("${cover}")` }} />}
              <header className="public-article-header">
                <p className="public-article-cat">{selectedPage.frontmatter.category}</p>
                <h1>{selectedPage.frontmatter.name}</h1>
                {selectedPage.frontmatter.summary && <p className="public-summary">{selectedPage.frontmatter.summary}</p>}
                {Boolean(selectedPage.frontmatter.tags?.length) && (
                  <div className="public-tags">
                    {(selectedPage.frontmatter.tags || []).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}
              </header>
              <div className="public-prose" onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: preview }} />
            </>
          ) : (
            <div className="public-empty">
              <h2>This world is just getting started</h2>
              <p className="muted">No player-visible pages have been published yet. Check back soon.</p>
            </div>
          )}
        </article>
      </div>

      <footer className="public-footer">
        <span>{campaignName}</span>
        <span>Published with CampaignRepo</span>
      </footer>
    </main>
  );
}

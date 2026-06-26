"use client";

import { CSSProperties, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { WikiPage } from "@/lib/types";
import { renderMarkdown, type MediaPathResolver, type WikiLinkResolver } from "@/lib/markdown";
import { buildAliasMap, resolveLinkTarget } from "@/lib/links";
import { themeToCssVars, type CampaignTheme } from "@/lib/theme";
import Logo from "@/app/components/logo";

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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!lightboxSrc) return;
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxSrc]);

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

  const categoryOrder = ["lore", "location", "organization", "character", "npc", "species", "item", "event", "game"];
  const categoryLabels: Record<string, string> = {
    character: "Characters",
    npc: "NPCs",
    location: "Locations",
    event: "Events",
    game: "Game",
    organization: "Organizations",
    species: "Species",
    item: "Items",
    lore: "Lore"
  };
  const sortedPages = useMemo(() => [...pages].sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name)), [pages]);
  const pageBySlug = useMemo(() => new Map(pages.map((page) => [page.slug, page])), [pages]);
  const childrenByParent = useMemo(() => {
    const byParent = new Map<string, WikiPage[]>();
    for (const page of sortedPages) {
      const parentPage = page.frontmatter.parent ? pageBySlug.get(page.frontmatter.parent) : undefined;
      if (parentPage && parentPage.frontmatter.category === page.frontmatter.category) {
        byParent.set(page.frontmatter.parent!, [...(byParent.get(page.frontmatter.parent!) || []), page]);
      }
    }
    return byParent;
  }, [pageBySlug, sortedPages]);
  const queryActive = query.trim().length > 0;
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
      const galleryAnchor = (event.target as HTMLElement).closest("a.gallery-item");
      if (galleryAnchor) {
        event.preventDefault();
        setLightboxSrc(galleryAnchor.getAttribute("href") || null);
        return;
      }
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
  const selectPublicPage = (page: WikiPage) => {
    setSelectedSlug(page.slug);
    window.history.replaceState(null, "", `#${page.slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const renderTree = (page: WikiPage, depth = 0) => {
    const kids = childrenByParent.get(page.slug) || [];
    const isOpen = openNodes[page.slug] ?? true;
    return (
      <div className="nav-tree-item" key={page.slug}>
        <div className="nav-tree-row" style={{ paddingLeft: depth * 14 }}>
          {kids.length ? (
            <button
              type="button"
              className="nav-tree-toggle"
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${kids.length} child page${kids.length === 1 ? "" : "s"} under ${page.frontmatter.name}`}
              title={`${isOpen ? "Collapse" : "Expand"} ${kids.length} child page${kids.length === 1 ? "" : "s"}`}
              onClick={() => setOpenNodes((state) => ({ ...state, [page.slug]: !isOpen }))}
            >
              {isOpen ? "-" : "+"}
            </button>
          ) : (
            <span className="nav-tree-spacer" />
          )}
          <button
            type="button"
            className={page.slug === selectedPage?.slug ? "nav-link nav-tree-link active" : "nav-link nav-tree-link"}
            onClick={() => selectPublicPage(page)}
          >
            <span className="cat-dot" style={{ background: `var(--cat-${page.frontmatter.category})` }} />
            <span className="nav-tree-name">{page.frontmatter.name}</span>
            {kids.length > 0 && <span className="nav-tree-child-count" title={`${kids.length} direct child page${kids.length === 1 ? "" : "s"}`}>{kids.length}</span>}
          </button>
        </div>
        {kids.length > 0 && isOpen && kids.map((child) => renderTree(child, depth + 1))}
      </div>
    );
  };

  return (
    <main className="app-shell" data-theme={theme.preset || undefined} style={themeVars}>
      <header className="topbar">
        <div>
          <Logo href="/site" />
          <h1>{campaignName}</h1>
          <p className="muted">{gameType}</p>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={cloneWorld} disabled={cloning}>Clone this world</button>
          {cloneMsg && <span className="public-clone-message">{cloneMsg}</span>}
        </div>
      </header>

      <div className="workspace">
        <aside className="side-nav">
          <input className="nav-filter" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this world" />
          {grouped.map(([cat, catPages]) => (
            <div className="nav-group" key={cat}>
              <button type="button" className="nav-group-header" aria-expanded={openCats[cat] ?? true} onClick={() => setOpenCats((state) => ({ ...state, [cat]: !(state[cat] ?? true) }))}>
                <span className="nav-group-title">
                  {(openCats[cat] ?? true) ? "v" : ">"} {categoryLabels[cat] || cat}
                </span>
                <span className="nav-count">{catPages.length}</span>
              </button>
              {(openCats[cat] ?? true) && (queryActive
                ? catPages.map((page) => (
                    <button
                      type="button"
                      key={page.slug}
                      className={page.slug === selectedPage?.slug ? "nav-link nav-tree-link nav-tree-filtered active" : "nav-link nav-tree-link nav-tree-filtered"}
                      onClick={() => selectPublicPage(page)}
                    >
                      <span className="cat-dot" style={{ background: `var(--cat-${page.frontmatter.category})` }} />
                      {page.frontmatter.name}
                    </button>
                  ))
                : catPages
                    .filter((page) => {
                      const parentPage = page.frontmatter.parent ? pageBySlug.get(page.frontmatter.parent) : undefined;
                      return !(parentPage && parentPage.frontmatter.category === cat);
                    })
                    .map((page) => renderTree(page)))}
            </div>
          ))}
          {!filteredPages.length && <p className="muted">No public pages match.</p>}
        </aside>

        <div className="reader-shell">
          <article className="preview page-reader">
            {selectedPage ? (
              <>
                {cover && <img className="page-cover page-cover-clickable" src={cover} alt={selectedPage.frontmatter.name} onClick={() => setLightboxSrc(cover)} />}
                <header className="handout-header">
                  <p>{selectedPage.frontmatter.category}</p>
                  <h1>{selectedPage.frontmatter.name}</h1>
                  {selectedPage.frontmatter.summary && <span>{selectedPage.frontmatter.summary}</span>}
                  {Boolean(selectedPage.frontmatter.tags?.length) && (
                    <div className="badges">
                      {(selectedPage.frontmatter.tags || []).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </header>
                <div onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: preview }} />
              </>
            ) : (
              <div className="public-empty">
                <h2>This world is just getting started</h2>
                <p className="muted">No player-visible pages have been published yet. Check back soon.</p>
              </div>
            )}
          </article>
        </div>
      </div>
      {lightboxSrc && (
        <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)} role="dialog" aria-modal>
          <button className="lightbox-close" onClick={() => setLightboxSrc(null)} aria-label="Close">✕</button>
          <img className="lightbox-img" src={lightboxSrc} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </main>
  );
}

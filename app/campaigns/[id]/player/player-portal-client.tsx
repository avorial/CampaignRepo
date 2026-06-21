"use client";

import { MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Campaign, WikiPage } from "@/lib/types";
import { renderMarkdown, type MediaPathResolver, type WikiLinkResolver } from "@/lib/markdown";
import { buildAliasMap, resolveLinkTarget } from "@/lib/links";

export default function PlayerPortalClient({ campaign }: { campaign: Campaign }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}/pages?mode=player`)
      .then((res) => res.json())
      .then((data) => {
        const safePages = Array.isArray(data.pages) ? data.pages : [];
        const hashSlug = window.location.hash.replace(/^#/, "");
        setPages(safePages);
        setSelectedSlug((current) => current || (safePages.some((page: WikiPage) => page.slug === hashSlug) ? hashSlug : safePages[0]?.slug || ""));
      });
  }, [campaign.id]);

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
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [pages, query]);

  const selectedPage = pages.find((page) => page.slug === selectedSlug) || filteredPages[0] || pages[0];

  const resolveLink = useMemo<WikiLinkResolver>(() => {
    const aliasMap = buildAliasMap(
      pages.map((page) => ({ slug: page.slug, name: page.frontmatter.name, aliases: page.frontmatter.aliases || [] }))
    );
    const knownSlugs = new Set(pages.map((page) => page.slug));
    return (target: string) => {
      const { slug, missing } = resolveLinkTarget(aliasMap, knownSlugs, target);
      return { href: `#${slug}`, missing };
    };
  }, [pages]);

  const resolveMedia = useMemo<MediaPathResolver>(
    () => (path: string) => `/campaign-media/${campaign.id}/${path.split("/").map(encodeURIComponent).join("/")}`,
    [campaign.id]
  );

  const preview = useMemo(() => renderMarkdown(selectedPage?.content || "", "handout", resolveLink, resolveMedia), [selectedPage, resolveLink, resolveMedia]);

  const onPreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const anchor = (event.target as HTMLElement).closest("a.wiki-link");
      if (!anchor) return;
      event.preventDefault();
      if (anchor.getAttribute("data-missing") === "true") return;
      const slug = (anchor.getAttribute("href") || "").replace(/^#/, "");
      if (pages.some((page) => page.slug === slug)) {
        setSelectedSlug(slug);
        window.history.replaceState(null, "", `#${slug}`);
      }
    },
    [pages]
  );

  async function copyHandoutLink() {
    if (!selectedPage) return;
    window.history.replaceState(null, "", `#${selectedPage.slug}`);
    await navigator.clipboard.writeText(`${window.location.origin}/campaigns/${campaign.id}/player#${selectedPage.slug}`);
    setMessage("Copied player portal link.");
  }

  return (
    <section className="player-portal">
      <aside className="player-library">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player lore" />
        <div className="nav-group">
          <h3>Player Pages</h3>
          {filteredPages.map((page) => (
            <button
              type="button"
              key={page.slug}
              className={page.slug === selectedPage?.slug ? "nav-link active" : "nav-link"}
              onClick={() => {
                setSelectedSlug(page.slug);
                window.history.replaceState(null, "", `#${page.slug}`);
              }}
            >
              <strong>{page.frontmatter.name}</strong>
              <span>{page.frontmatter.category}</span>
            </button>
          ))}
          {!filteredPages.length && <p className="muted">No approved player-visible pages match.</p>}
        </div>
      </aside>

      <article className="player-reader panel">
        {selectedPage ? (
          <>
            <header className="handout-header">
              <p>{selectedPage.frontmatter.category}</p>
              <h1>{selectedPage.frontmatter.name}</h1>
              {selectedPage.frontmatter.summary && <span>{selectedPage.frontmatter.summary}</span>}
              <div className="badges">
                {(selectedPage.frontmatter.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            </header>
            <div className="player-reader-actions">
              <button type="button" className="secondary" onClick={copyHandoutLink}>Copy Link</button>
            </div>
            <div onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: preview }} />
          </>
        ) : (
          <p className="muted">No approved player-visible pages yet.</p>
        )}
      </article>
      {message && <p className="toast">{message}</p>}
    </section>
  );
}

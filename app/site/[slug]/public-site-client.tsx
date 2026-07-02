"use client";

import { CSSProperties, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { WikiPage } from "@/lib/types";
import type { Quest } from "@/lib/quests";
import { renderMarkdown, type IncludeResolver, type MediaPathResolver, type WikiLinkResolver } from "@/lib/markdown";
import { buildAliasMap, resolveLinkTarget } from "@/lib/links";
import { themeToCssVars, type CampaignTheme } from "@/lib/theme";
import Logo from "@/app/components/logo";

export default function PublicSiteClient({
  slug,
  campaignName,
  gameType,
  pages,
  quests,
  theme,
  categories
}: {
  slug: string;
  campaignName: string;
  gameType: string;
  pages: WikiPage[];
  quests: Quest[];
  theme: CampaignTheme;
  categories: { id: string; label: string }[];
}) {
  const [selectedSlug, setSelectedSlug] = useState(pages[0]?.slug || "");
  const [selectedQuestSlug, setSelectedQuestSlug] = useState(pages[0] ? "" : quests[0]?.slug || "");
  const [query, setQuery] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneMsg, setCloneMsg] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [diceRoll, setDiceRoll] = useState<{ label: string; detail: string; total: number } | null>(null);
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
    if (hashSlug.startsWith("quest:")) {
      const questSlug = hashSlug.replace(/^quest:/, "");
      if (quests.some((quest) => quest.slug === questSlug)) {
        setSelectedSlug("");
        setSelectedQuestSlug(questSlug);
      }
      return;
    }
    if (hashSlug && pages.some((page) => page.slug === hashSlug)) {
      setSelectedQuestSlug("");
      setSelectedSlug(hashSlug);
    }
  }, [pages, quests]);

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
  const filteredQuests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return quests;
    return quests.filter((quest) => {
      const haystack = [
        quest.frontmatter.title,
        quest.frontmatter.status,
        quest.frontmatter.arc,
        quest.frontmatter.reward,
        ...quest.frontmatter.objectives.map((objective) => objective.text),
        ...quest.frontmatter.participants,
        ...quest.frontmatter.locations
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [quests, query]);
  const selectedQuest = quests.find((quest) => quest.slug === selectedQuestSlug);

  const categoryOrder = categories.map((category) => category.id);
  const categoryLabels = Object.fromEntries(categories.map((category) => [category.id, category.label]));
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

  const resolveInclude = useMemo<IncludeResolver>(() => {
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    const aliasMap = buildAliasMap(pages.map((p) => ({ slug: p.slug, name: p.frontmatter.name, aliases: p.frontmatter.aliases || [] })));
    return (target: string) => {
      const resolved = aliasMap.get(target.trim().toLowerCase());
      const page = resolved ? bySlug.get(resolved) : undefined;
      return page ? page.content : null;
    };
  }, [pages]);

  const preview = useMemo(
    () => renderMarkdown(selectedPage?.content || "", "handout", resolveLink, resolveMedia, resolveInclude),
    [selectedPage, resolveLink, resolveMedia, resolveInclude]
  );
  const questPreview = useMemo(
    () => renderMarkdown(selectedQuest?.description || "", "handout", resolveLink, resolveMedia, resolveInclude),
    [selectedQuest, resolveLink, resolveMedia, resolveInclude]
  );

  const onPreviewClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const rollEl = (event.target as HTMLElement).closest("[data-roll]");
      if (rollEl) {
        event.preventDefault();
        const dice = rollEl.getAttribute("data-roll") || "2d6";
        const mod = parseInt(rollEl.getAttribute("data-mod") || "0", 10);
        const label = rollEl.getAttribute("data-label") || "Roll";
        if (dice === "2d6") {
          const d1 = Math.floor(Math.random() * 6) + 1;
          const d2 = Math.floor(Math.random() * 6) + 1;
          const total = d1 + d2 + mod;
          const modStr = mod === 0 ? "" : mod > 0 ? ` + ${mod}` : ` − ${Math.abs(mod)}`;
          setDiceRoll({ label, detail: `${d1} + ${d2}${modStr} = ${total}`, total });
        } else {
          const d = Math.floor(Math.random() * 20) + 1;
          const total = d + mod;
          const modStr = mod === 0 ? "" : mod > 0 ? ` + ${mod}` : ` − ${Math.abs(mod)}`;
          setDiceRoll({ label, detail: `${d}${modStr} = ${total}`, total });
        }
        return;
      }
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
    setSelectedQuestSlug("");
    window.history.replaceState(null, "", `#${page.slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const selectPublicQuest = (quest: Quest) => {
    setSelectedSlug("");
    setSelectedQuestSlug(quest.slug);
    window.history.replaceState(null, "", `#quest:${quest.slug}`);
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
            <span className="cat-dot" style={{ background: `var(--cat-${page.frontmatter.category}, var(--gold))` }} />
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
                      <span className="cat-dot" style={{ background: `var(--cat-${page.frontmatter.category}, var(--gold))` }} />
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
          {quests.length > 0 && (
            <div className="nav-group">
              <button type="button" className="nav-group-header" aria-expanded={openCats.__quests ?? true} onClick={() => setOpenCats((state) => ({ ...state, __quests: !(state.__quests ?? true) }))}>
                <span className="nav-group-title">
                  {(openCats.__quests ?? true) ? "v" : ">"} Quests
                </span>
                <span className="nav-count">{filteredQuests.length}</span>
              </button>
              {(openCats.__quests ?? true) && filteredQuests.map((quest) => (
                <button
                  type="button"
                  key={quest.slug}
                  className={quest.slug === selectedQuest?.slug ? "nav-link nav-tree-link public-quest-link active" : "nav-link nav-tree-link public-quest-link"}
                  onClick={() => selectPublicQuest(quest)}
                >
                  <span className={`badge badge-${quest.frontmatter.status}`}>{quest.frontmatter.status}</span>
                  <span className="nav-tree-name">{quest.frontmatter.title}</span>
                </button>
              ))}
              {(openCats.__quests ?? true) && !filteredQuests.length && <p className="muted">No public quests match.</p>}
            </div>
          )}
          {!filteredPages.length && !filteredQuests.length && <p className="muted">No public content matches.</p>}
        </aside>

        <div className="reader-shell">
          <article className="preview page-reader">
            {selectedQuest ? (
              <>
                <header className="handout-header">
                  <p>Quest</p>
                  <h1>{selectedQuest.frontmatter.title}</h1>
                  <div className="badges">
                    <span className={`badge badge-${selectedQuest.frontmatter.status}`}>{selectedQuest.frontmatter.status}</span>
                    {selectedQuest.frontmatter.arc && <span>{selectedQuest.frontmatter.arc}</span>}
                    {selectedQuest.frontmatter.reward && <span>Reward: {selectedQuest.frontmatter.reward}</span>}
                  </div>
                </header>
                <section className="public-quest-detail">
                  {selectedQuest.frontmatter.objectives.length > 0 && (
                    <div className="player-quest-objectives">
                      <h2>Objectives</h2>
                      <ul className="player-quest-obj-list">
                        {selectedQuest.frontmatter.objectives.map((objective, index) => (
                          <li key={`${objective.text}-${index}`} className={objective.done ? "obj-done" : ""}>{objective.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedQuest.frontmatter.clocks.length > 0 && (
                    <div className="public-quest-clocks">
                      <h2>Clocks</h2>
                      {selectedQuest.frontmatter.clocks.map((clock) => (
                        <div className="player-quest-objectives" key={clock.name}>
                          <div className="player-quest-meta">
                            <strong>{clock.name}</strong>
                            <span className="player-quest-obj-count">{clock.filled}/{clock.segments}</span>
                          </div>
                          <div className="player-quest-progress">
                            <div className="player-quest-bar" style={{ width: `${clock.segments ? (clock.filled / clock.segments) * 100 : 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {(selectedQuest.frontmatter.participants.length > 0 || selectedQuest.frontmatter.locations.length > 0) && (
                    <div className="public-quest-meta-grid">
                      {selectedQuest.frontmatter.participants.length > 0 && (
                        <div>
                          <h2>Participants</h2>
                          <p>{selectedQuest.frontmatter.participants.join(", ")}</p>
                        </div>
                      )}
                      {selectedQuest.frontmatter.locations.length > 0 && (
                        <div>
                          <h2>Locations</h2>
                          <p>{selectedQuest.frontmatter.locations.join(", ")}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {questPreview && <div onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: questPreview }} />}
                </section>
              </>
            ) : selectedPage ? (
              <>
                {cover && <img className="page-cover page-cover-clickable" src={cover} alt={selectedPage.frontmatter.name} onClick={() => setLightboxSrc(cover)} />}
                <header className="handout-header">
                  <p>{categoryLabels[selectedPage.frontmatter.category] || selectedPage.frontmatter.category}</p>
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
      {diceRoll && (
        <div className="dice-roll-toast" onClick={() => setDiceRoll(null)} role="status">
          <span className="dice-roll-label">{diceRoll.label}</span>
          <span className="dice-roll-detail">{diceRoll.detail}</span>
        </div>
      )}
    </main>
  );
}

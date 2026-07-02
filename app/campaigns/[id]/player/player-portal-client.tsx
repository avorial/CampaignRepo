"use client";

import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Campaign, WikiPage } from "@/lib/types";
import { renderMarkdown, type IncludeResolver, type MediaPathResolver, type WikiLinkResolver } from "@/lib/markdown";
import { buildAliasMap, resolveLinkTarget } from "@/lib/links";

type PlayerQuest = {
  slug: string;
  frontmatter: { title: string; status: string; arc?: string; reward?: string; objectives: { text: string; done: boolean }[] };
  description: string;
};

export default function PlayerPortalClient({ campaign, categories }: { campaign: Campaign; categories: { id: string; label: string }[] }) {
  const [tab, setTab] = useState<"lore" | "quests">("lore");
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestCategory, setSuggestCategory] = useState(categories[0]?.id || "lore");
  const [suggestSummary, setSuggestSummary] = useState("");
  const [suggestContent, setSuggestContent] = useState("");
  const [suggestSubmitting, setSuggestSubmitting] = useState(false);
  const [quests, setQuests] = useState<PlayerQuest[]>([]);
  const [questsLoaded, setQuestsLoaded] = useState(false);

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
  const categoryLabels = useMemo(() => new Map(categories.map((category) => [category.id, category.label])), [categories]);

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

  const resolveInclude = useMemo<IncludeResolver>(() => {
    const bySlug = new Map(pages.map((p) => [p.slug, p]));
    const aliasMap = buildAliasMap(pages.map((p) => ({ slug: p.slug, name: p.frontmatter.name, aliases: p.frontmatter.aliases || [] })));
    return (target: string) => {
      const resolved = aliasMap.get(target.trim().toLowerCase());
      const page = resolved ? bySlug.get(resolved) : undefined;
      return page ? page.content : null;
    };
  }, [pages]);

  const preview = useMemo(() => renderMarkdown(selectedPage?.content || "", "handout", resolveLink, resolveMedia, resolveInclude), [selectedPage, resolveLink, resolveMedia, resolveInclude]);

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

  function switchTab(t: "lore" | "quests") {
    setTab(t);
    if (t === "quests" && !questsLoaded) {
      fetch(`/api/campaigns/${campaign.id}/quests?mode=player`)
        .then((r) => r.json())
        .then((d) => { setQuests(d.quests || []); setQuestsLoaded(true); })
        .catch(() => setQuestsLoaded(true));
    }
  }

  async function copyHandoutLink() {
    if (!selectedPage) return;
    window.history.replaceState(null, "", `#${selectedPage.slug}`);
    await navigator.clipboard.writeText(`${window.location.origin}/campaigns/${campaign.id}/player#${selectedPage.slug}`);
    setMessage("Copied player portal link.");
  }

  async function submitSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuggestSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestTitle,
          category: suggestCategory,
          summary: suggestSummary,
          content: suggestContent
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not submit suggestion.");
      setSuggestTitle("");
      setSuggestSummary("");
      setSuggestContent("");
      setMessage("Suggestion submitted for GM review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit suggestion.");
    } finally {
      setSuggestSubmitting(false);
    }
  }

  const activeQuests = quests.filter((q) => q.frontmatter.status === "active" || q.frontmatter.status === "hook");
  const doneQuests = quests.filter((q) => q.frontmatter.status === "completed" || q.frontmatter.status === "failed");

  return (
    <section className="player-portal">
      <div className="tab-row player-tab-row">
        <button type="button" className={tab === "lore" ? "tab-btn active" : "tab-btn"} onClick={() => switchTab("lore")}>Lore</button>
        <button type="button" className={tab === "quests" ? "tab-btn active" : "tab-btn"} onClick={() => switchTab("quests")}>Quests</button>
      </div>

      {tab === "lore" && (
        <>
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
                  <span>{categoryLabels.get(page.frontmatter.category) || page.frontmatter.category}</span>
                </button>
              ))}
              {!filteredPages.length && <p className="muted">No approved player-visible pages match.</p>}
            </div>
            <form className="player-suggestion-form" onSubmit={submitSuggestion}>
              <h3>Suggest an Addition</h3>
              <label>
                Title
                <input value={suggestTitle} onChange={(event) => setSuggestTitle(event.target.value)} placeholder="Name or topic" required />
              </label>
              <label>
                Category
                <select value={suggestCategory} onChange={(event) => setSuggestCategory(event.target.value)}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                </select>
              </label>
              <label>
                Summary
                <input value={suggestSummary} onChange={(event) => setSuggestSummary(event.target.value)} placeholder="Optional short note" />
              </label>
              <label>
                Details
                <textarea value={suggestContent} onChange={(event) => setSuggestContent(event.target.value)} placeholder="What should the GM review?" rows={6} required />
              </label>
              <button type="submit" disabled={suggestSubmitting || !suggestTitle.trim() || suggestContent.trim().length < 10}>
                {suggestSubmitting ? "Submitting..." : "Send to GM"}
              </button>
            </form>
          </aside>

          <article className="player-reader panel">
            {selectedPage ? (
              <>
                <header className="handout-header">
                  <p>{categoryLabels.get(selectedPage.frontmatter.category) || selectedPage.frontmatter.category}</p>
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
        </>
      )}

      {tab === "quests" && (
        <div className="player-quests">
          {!questsLoaded && <p className="muted">Loading quests…</p>}
          {questsLoaded && quests.length === 0 && <p className="muted">No player-visible quests yet.</p>}
          {activeQuests.length > 0 && (
            <section className="player-quest-group">
              <h3>Active &amp; Hooks</h3>
              {activeQuests.map((q) => {
                const done = q.frontmatter.objectives.filter((o) => o.done).length;
                const total = q.frontmatter.objectives.length;
                return (
                  <article className="player-quest-card" key={q.slug}>
                    <h4>{q.frontmatter.title}</h4>
                    <div className="player-quest-meta">
                      {q.frontmatter.arc && <span className="badge">{q.frontmatter.arc}</span>}
                      <span className={`badge badge-${q.frontmatter.status}`}>{q.frontmatter.status}</span>
                      {q.frontmatter.reward && <span className="badge">Reward: {q.frontmatter.reward}</span>}
                    </div>
                    {total > 0 && (
                      <div className="player-quest-objectives">
                        <div className="player-quest-progress">
                          <div className="player-quest-bar" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
                        </div>
                        <span className="player-quest-obj-count">{done}/{total} objectives</span>
                        <ul className="player-quest-obj-list">
                          {q.frontmatter.objectives.map((o, i) => (
                            <li key={i} className={o.done ? "obj-done" : ""}>{o.text}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {q.description.trim() && <p className="player-quest-desc">{q.description.trim().slice(0, 300)}{q.description.length > 300 ? "…" : ""}</p>}
                  </article>
                );
              })}
            </section>
          )}
          {doneQuests.length > 0 && (
            <section className="player-quest-group player-quest-group-done">
              <h3>Completed / Failed</h3>
              {doneQuests.map((q) => (
                <article className="player-quest-card player-quest-card-done" key={q.slug}>
                  <h4>{q.frontmatter.title}</h4>
                  <div className="player-quest-meta">
                    {q.frontmatter.arc && <span className="badge">{q.frontmatter.arc}</span>}
                    <span className={`badge badge-${q.frontmatter.status}`}>{q.frontmatter.status}</span>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      )}

      {message && <p className="toast">{message}</p>}
    </section>
  );
}

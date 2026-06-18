"use client";

import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignMedia, WikiPage } from "@/lib/types";
import { renderMarkdown, type WikiLinkResolver } from "@/lib/markdown";
import { buildAliasMap, resolveLinkTarget } from "@/lib/links";

export default function PageEditor({ campaign, slug }: { campaign: Campaign; slug: string }) {
  const router = useRouter();
  const [page, setPage] = useState<WikiPage | null>(null);
  const [content, setContent] = useState("");
  const [frontmatter, setFrontmatter] = useState<any>({});
  const [knownPages, setKnownPages] = useState<WikiPage[]>([]);
  const [media, setMedia] = useState<CampaignMedia[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canManage = campaign.role === "owner" || campaign.role === "gm";
  const [mode, setMode] = useState<"gm" | "player" | "handout">(canManage ? "gm" : "player");
  const [message, setMessage] = useState("");
  const [conflictPage, setConflictPage] = useState<WikiPage | null>(null);

  const applyPage = useCallback((nextPage: WikiPage) => {
    setPage(nextPage);
    setContent(nextPage.content);
    setFrontmatter(nextPage.frontmatter);
  }, []);

  const loadPage = useCallback(() => {
    return fetch(`/api/campaigns/${campaign.id}/pages/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.page) applyPage(data.page);
      });
  }, [applyPage, campaign.id, slug]);

  useEffect(() => {
    loadPage();
    fetch(`/api/campaigns/${campaign.id}/pages`)
      .then((res) => res.json())
      .then((data) => setKnownPages(Array.isArray(data.pages) ? data.pages : []));
    if (canManage) {
      fetch(`/api/campaigns/${campaign.id}/media`)
        .then((res) => res.json())
        .then((data) => setMedia(Array.isArray(data.media) ? data.media : []));
    }
  }, [campaign.id, canManage, loadPage, slug]);

  const resolveLink = useMemo<WikiLinkResolver>(() => {
    const aliasMap = buildAliasMap(
      knownPages.map((p) => ({ slug: p.slug, name: p.frontmatter.name, aliases: p.frontmatter.aliases || [] }))
    );
    const knownSlugs = new Set(knownPages.map((p) => p.slug));
    return (target: string) => {
      const { slug: target_slug, missing } = resolveLinkTarget(aliasMap, knownSlugs, target);
      return { href: `/campaigns/${campaign.id}/pages/${target_slug}`, missing };
    };
  }, [knownPages, campaign.id]);

  const preview = useMemo(() => renderMarkdown(content, mode, resolveLink), [content, mode, resolveLink]);

  const onPreviewClick = useCallback(
    async (event: MouseEvent<HTMLDivElement>) => {
      const anchor = (event.target as HTMLElement).closest("a.wiki-link");
      if (!anchor) return;
      event.preventDefault();
      const href = anchor.getAttribute("href");
      const missing = anchor.getAttribute("data-missing") === "true";
      const target = anchor.getAttribute("data-target") || "";
      if (!missing) {
        if (href) router.push(href);
        return;
      }
      if (!canManage) return;
      if (!confirm(`"${target}" has no page yet. Create it now?`)) return;
      const res = await fetch(`/api/campaigns/${campaign.id}/pages`, {
        method: "POST",
        body: JSON.stringify({ name: target, category: "npc", visibility: "gm" })
      });
      const data = await res.json();
      if (res.ok && data.slug) router.push(`/campaigns/${campaign.id}/pages/${data.slug}`);
      else setMessage(data.error || "Could not create page.");
    },
    [campaign.id, canManage, router]
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const res = await fetch(`/api/campaigns/${campaign.id}/pages/${slug}`, {
      method: "PUT",
      body: JSON.stringify({ frontmatter, content, sha: page?.sha })
    });
    const data = await res.json();
    if (res.ok) {
      setConflictPage(null);
      setPage((current) => (current ? { ...current, sha: data.sha || current.sha } : current));
      setMessage("Saved and committed to GitHub.");
      return;
    }
    if (res.status === 409 && data.latest) {
      setConflictPage(data.latest);
      setMessage(data.error || "This page has a GitHub conflict.");
      return;
    }
    setMessage(data.error || "Save failed.");
  }

  function reloadConflict() {
    if (!conflictPage) return;
    applyPage(conflictPage);
    setConflictPage(null);
    setMessage("Loaded the latest GitHub version.");
  }

  function updateField(field: string, value: unknown) {
    setFrontmatter((current: any) => ({ ...current, [field]: value }));
  }

  function insertSnippet(snippet: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((current) => `${current}${current.endsWith("\n") || !current ? "" : "\n"}${snippet}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const selected = content.slice(start, end);
    const after = content.slice(end);
    const text = snippet.includes("{{selection}}") ? snippet.replace("{{selection}}", selected || "Secret notes.") : snippet;
    const next = `${before}${text}${after}`;
    setContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + text.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  function insertWikiLink(target: string) {
    if (!target) return;
    insertSnippet(`[[${target}]]`);
  }

  function insertMedia(path: string) {
    const item = media.find((mediaItem) => mediaItem.path === path);
    if (!item) return;
    insertSnippet(item.markdown);
  }

  if (!page) return <p className="muted">Loading page...</p>;
  const keyLinks = Array.isArray(frontmatter.keyLinks) ? frontmatter.keyLinks : [];
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const tradeCodes = Array.isArray(frontmatter.tradeCodes) ? frontmatter.tradeCodes : [];
  const isTraveller = campaign.gameType === "Traveller";
  const isEvent = frontmatter.category === "event";

  return (
    <form onSubmit={save} className="page-grid">
      <aside className="page-sidebar">
        <h2>{frontmatter.name}</h2>
        <p>{frontmatter.summary || "No summary yet."}</p>
        <div className="badges">
          <span>{frontmatter.category}</span>
          <span>{frontmatter.visibility}</span>
          <span>{frontmatter.approvalStatus}</span>
          {frontmatter.knownToPlayers && <span>known</span>}
        </div>

        <div className="field-group">
          <h3>Page</h3>
          <label>Name<input value={frontmatter.name || ""} onChange={(e) => updateField("name", e.target.value)} readOnly={!canManage} /></label>
          <label>Summary<textarea value={frontmatter.summary || ""} onChange={(e) => updateField("summary", e.target.value)} readOnly={!canManage} /></label>
          <label>Status<input value={frontmatter.status || ""} onChange={(e) => updateField("status", e.target.value)} readOnly={!canManage} placeholder="alive, active, destroyed..." /></label>
          <label>Tags<input value={tags.join(", ")} onChange={(e) => updateField("tags", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!canManage} /></label>
          <label>Aliases<input value={(frontmatter.aliases || []).join(", ")} onChange={(e) => updateField("aliases", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!canManage} /></label>
        </div>

        <div className="field-group">
          <h3>Visibility</h3>
          <label>Visibility<select value={frontmatter.visibility} onChange={(e) => updateField("visibility", e.target.value)} disabled={!canManage}><option value="gm">GM only</option><option value="players">Players</option></select></label>
          <label>Approval<select value={frontmatter.approvalStatus} onChange={(e) => updateField("approvalStatus", e.target.value)} disabled={!canManage}><option value="approved">Approved</option><option value="unapproved">Unapproved</option><option value="rejected">Rejected</option></select></label>
          <label className="check"><input type="checkbox" checked={Boolean(frontmatter.knownToPlayers)} onChange={(e) => updateField("knownToPlayers", e.target.checked)} disabled={!canManage} /> Known to players</label>
        </div>

        <div className="field-group">
          <h3>Links</h3>
          <label>Key links<input value={keyLinks.join(", ")} onChange={(e) => updateField("keyLinks", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!canManage} /></label>
          <label>Foundry link<input value={frontmatter.foundryLink || ""} onChange={(e) => updateField("foundryLink", e.target.value)} readOnly={!canManage} placeholder="Actor UUID or scene URL" /></label>
        </div>

        {isEvent && (
          <div className="field-group">
            <h3>Timeline</h3>
            <label>Event date<input value={frontmatter.eventDate || ""} onChange={(e) => updateField("eventDate", e.target.value)} readOnly={!canManage} placeholder="1105-123 or 2026-06-17" /></label>
            <label>Timeline date<input value={frontmatter.timelineDate || ""} onChange={(e) => updateField("timelineDate", e.target.value)} readOnly={!canManage} /></label>
          </div>
        )}

        {isTraveller && (
          <div className="field-group">
            <h3>Traveller</h3>
            <label>UWP<input value={frontmatter.uwp || ""} onChange={(e) => updateField("uwp", e.target.value)} readOnly={!canManage} placeholder="A867A74-C" /></label>
            <label>Allegiance<input value={frontmatter.allegiance || ""} onChange={(e) => updateField("allegiance", e.target.value)} readOnly={!canManage} placeholder="Solomani Confederation" /></label>
            <label>Trade codes<input value={tradeCodes.join(", ")} onChange={(e) => updateField("tradeCodes", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!canManage} /></label>
            <label>Subsector<input value={frontmatter.subsector || ""} onChange={(e) => updateField("subsector", e.target.value)} readOnly={!canManage} /></label>
            <label>Patron<input value={frontmatter.patron || ""} onChange={(e) => updateField("patron", e.target.value)} readOnly={!canManage} /></label>
            <label>Tech level<input value={frontmatter.techLevel || ""} onChange={(e) => updateField("techLevel", e.target.value)} readOnly={!canManage} /></label>
          </div>
        )}

        {frontmatter.sourceImport && <p className="muted">Source: {frontmatter.sourceImport}</p>}
        <h3>Key links</h3>
        {keyLinks.map((link: string) => <a key={link} className="nav-link" href={`/campaigns/${campaign.id}/pages/${link}`}>{link}</a>)}
        <h3>Backlinks</h3>
        {(page.backlinks || []).map((link) => <a key={link} className="nav-link" href={`/campaigns/${campaign.id}/pages/${link}`}>{link}</a>)}
      </aside>

      <section className="editor-panel">
        <div className="editor-toolbar">
          {canManage && <button type="button" className={mode === "gm" ? "active" : ""} onClick={() => setMode("gm")}>GM preview</button>}
          <button type="button" className={mode === "player" ? "active" : ""} onClick={() => setMode("player")}>Player preview</button>
          <button type="button" className={mode === "handout" ? "active" : ""} onClick={() => setMode("handout")}>Handout</button>
          {canManage && <button type="submit">Save commit</button>}
        </div>
        {canManage && (
          <div className="insert-toolbar">
            <label>
              Wiki link
              <select defaultValue="" onChange={(event) => { insertWikiLink(event.target.value); event.target.value = ""; }}>
                <option value="">Insert page link</option>
                {knownPages.map((knownPage) => <option key={knownPage.slug} value={knownPage.frontmatter.name}>{knownPage.frontmatter.name}</option>)}
              </select>
            </label>
            <label>
              Media
              <select defaultValue="" onChange={(event) => { insertMedia(event.target.value); event.target.value = ""; }}>
                <option value="">Insert media</option>
                {media.map((item) => <option key={item.path} value={item.path}>{item.name}</option>)}
              </select>
            </label>
            <button type="button" className="secondary" onClick={() => insertSnippet(":::gm\n{{selection}}\n:::")}>GM Block</button>
            <button type="button" className="secondary" onClick={() => insertSnippet("[[Page Name|label]]")}>Alias Link</button>
          </div>
        )}
        {conflictPage && (
          <div className="conflict-banner">
            <span>This page changed on GitHub after you opened it.</span>
            <button type="button" className="secondary" onClick={reloadConflict}>Load latest</button>
          </div>
        )}
        <div className="editor-split">
          <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} readOnly={!canManage} />
          <article className={mode === "handout" ? "preview handout-preview" : "preview"}>
            {mode === "handout" && (
              <header className="handout-header">
                <p>Player Handout</p>
                <h1>{frontmatter.name}</h1>
                {frontmatter.summary && <span>{frontmatter.summary}</span>}
              </header>
            )}
            <div onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: preview }} />
          </article>
        </div>
        {message && <p className="toast">{message}</p>}
      </section>
    </form>
  );
}

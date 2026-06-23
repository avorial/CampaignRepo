"use client";

import { FormEvent, KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bold, Code2, Heading1, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote } from "lucide-react";
import type { Campaign, CampaignMedia, WikiPage } from "@/lib/types";
import { renderMarkdown, type IncludeResolver, type MediaPathResolver, type WikiLinkResolver } from "@/lib/markdown";
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
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [conflictPage, setConflictPage] = useState<WikiPage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sourceJsonDraft, setSourceJsonDraft] = useState("");
  const [sourceDiff, setSourceDiff] = useState<any | null>(null);
  const [parentFilter, setParentFilter] = useState("");
  const [linkFilter, setLinkFilter] = useState("");
  const [mediaFilter, setMediaFilter] = useState("");

  const applyPage = useCallback((nextPage: WikiPage) => {
    setPage(nextPage);
    setContent(nextPage.content);
    setFrontmatter(nextPage.frontmatter);
  }, []);

  const loadPage = useCallback(() => {
    return fetch(`/api/campaigns/${campaign.id}/pages/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.page) {
          applyPage(data.page);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true));
  }, [applyPage, campaign.id, slug]);

  useEffect(() => {
    loadPage();
    setIsEditing(canManage && new URLSearchParams(window.location.search).get("edit") === "1");
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

  const resolveMedia = useMemo<MediaPathResolver>(
    () => (path: string) => `/campaign-media/${campaign.id}/${path.split("/").map(encodeURIComponent).join("/")}`,
    [campaign.id]
  );

  const resolveInclude = useMemo<IncludeResolver>(() => {
    const aliasMap = buildAliasMap(
      knownPages.map((p) => ({ slug: p.slug, name: p.frontmatter.name, aliases: p.frontmatter.aliases || [] }))
    );
    const bySlug = new Map(knownPages.map((p) => [p.slug, p]));
    return (target: string) => {
      if (target === slug) return null; // no self-embed
      const resolved = aliasMap.get(target.trim().toLowerCase());
      const page = resolved ? bySlug.get(resolved) : undefined;
      return page ? page.content : null;
    };
  }, [knownPages, slug]);

  const preview = useMemo(() => renderMarkdown(content, mode, resolveLink, resolveMedia, resolveInclude), [content, mode, resolveLink, resolveMedia, resolveInclude]);

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
      if ((res.ok || res.status === 409) && data.slug) {
        const editQuery = res.status === 409 ? "?edit=1" : "";
        router.push(`/campaigns/${campaign.id}/pages/${data.slug}${editQuery}`);
      }
      else setMessage(data.error || "Could not create page.");
    },
    [campaign.id, canManage, router]
  );

  async function savePage(finish = false) {
    if (isSaving) return;
    setIsSaving(true);
    setMessage("Saving commit to GitHub...");
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/pages/${slug}`, {
        method: "PUT",
        body: JSON.stringify({ frontmatter, content, sha: page?.sha })
      });
      const data = await res.json();
      if (res.ok) {
        setConflictPage(null);
        setPage((current) => (current ? { ...current, sha: data.sha || current.sha } : current));
        setMessage(finish ? "Saved and finished." : "Saved. Keep working when ready.");
        if (finish) setIsEditing(false);
        return;
      }
      if (res.status === 409 && data.latest) {
        setConflictPage(data.latest);
        setMessage(data.error || "This page has a GitHub conflict.");
        return;
      }
      setMessage(data.error || "Save failed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePage() {
    if (isSaving) return;
    if (!confirm(`Delete "${frontmatter.name || slug}"? This removes the page from the repo. Other pages that link to it will show as missing.`)) return;
    setIsSaving(true);
    setMessage("Deleting page...");
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/pages/${slug}`, { method: "DELETE" });
      if (res.ok) {
        router.push(`/campaigns/${campaign.id}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Delete failed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await savePage(false);
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

  function replaceSelection(replacer: (selected: string) => { text: string; cursorOffset?: number }) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const selected = content.slice(start, end);
    const after = content.slice(end);
    const { text, cursorOffset } = replacer(selected);
    setContent(`${before}${text}${after}`);
    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + (cursorOffset ?? text.length);
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function wrapSelection(prefix: string, suffix = prefix, fallback = "text") {
    replaceSelection((selected) => {
      const inner = selected || fallback;
      return {
        text: `${prefix}${inner}${suffix}`,
        cursorOffset: selected ? `${prefix}${inner}${suffix}`.length : prefix.length + inner.length
      };
    });
  }

  function prefixSelectedLines(prefix: string) {
    replaceSelection((selected) => {
      const text = selected || "List item";
      return { text: text.split("\n").map((line) => (line.trim() ? `${prefix}${line}` : line)).join("\n") };
    });
  }

  function heading(level: 1 | 2 | 3) {
    replaceSelection((selected) => {
      const marks = "#".repeat(level);
      const text = selected || "Heading";
      return { text: text.split("\n").map((line) => `${marks} ${line.replace(/^#{1,6}\s+/, "")}`).join("\n") };
    });
  }

  function numberedList() {
    replaceSelection((selected) => {
      const lines = (selected || "List item").split("\n");
      let index = 1;
      return { text: lines.map((line) => (line.trim() ? `${index++}. ${line}` : line)).join("\n") };
    });
  }

  function codeBlock() {
    replaceSelection((selected) => ({ text: `\`\`\`text\n${selected || "code"}\n\`\`\`` }));
  }

  function markdownLink() {
    replaceSelection((selected) => ({
      text: `[${selected || "label"}](https://example.com)`,
      cursorOffset: selected ? selected.length + 3 : 6
    }));
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      wrapSelection("**", "**", "bold text");
    } else if (key === "i") {
      event.preventDefault();
      wrapSelection("*", "*", "italic text");
    } else if (key === "s") {
      event.preventDefault();
      savePage(false);
    }
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

  async function compareSourceImport() {
    if (!frontmatter.sourceImport) return;
    let sourceJson: unknown;
    try {
      sourceJson = JSON.parse(sourceJsonDraft);
    } catch {
      setMessage("New source JSON is invalid.");
      return;
    }
    const res = await fetch(`/api/campaigns/${campaign.id}/imports/characters/diff`, {
      method: "POST",
      body: JSON.stringify({ sourcePath: frontmatter.sourceImport, sourceJson })
    });
    const data = await res.json();
    if (res.ok) {
      setSourceDiff(data);
      setMessage("Source JSON compared.");
    } else {
      setMessage(data.error || "Could not compare source JSON.");
    }
  }

  if (notFound) {
    return (
      <div className="panel">
        <h2>Page not found</h2>
        <p className="muted">No page named <code>{slug}</code> exists in this campaign repo yet.</p>
        {canManage && (
          <button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/campaigns/${campaign.id}/pages`, {
                method: "POST",
                body: JSON.stringify({ name: slug.replace(/-/g, " "), category: "npc", visibility: "gm" })
              });
              const data = await res.json();
              if ((res.ok || res.status === 409) && data.slug) {
                const editQuery = res.status === 409 ? "?edit=1" : "";
                router.push(`/campaigns/${campaign.id}/pages/${data.slug}${editQuery}`);
              }
              else setMessage(data.error || "Could not create page.");
            }}
          >
            Create this page
          </button>
        )}
        <p className="muted"><a className="quiet-link" href={`/campaigns/${campaign.id}`}>← Back to campaign</a></p>
        {message && <p className="toast">{message}</p>}
      </div>
    );
  }
  if (!page) return <p className="muted">Loading page...</p>;
  const fieldsEditable = canManage && isEditing;
  const keyLinks = Array.isArray(frontmatter.keyLinks) ? frontmatter.keyLinks : [];
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const tradeCodes = Array.isArray(frontmatter.tradeCodes) ? frontmatter.tradeCodes : [];
  const isTraveller = campaign.gameType === "Traveller";
  const isEvent = frontmatter.category === "event";

  // Ancestor chain (breadcrumbs) + cycle-safe parent options.
  const pageBySlug = new Map(knownPages.map((p) => [p.slug, p]));
  const breadcrumbs: { slug: string; name: string }[] = [];
  {
    let cursor = frontmatter.parent as string | undefined;
    const seen = new Set<string>([slug]);
    while (cursor && pageBySlug.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      const ancestor = pageBySlug.get(cursor)!;
      breadcrumbs.unshift({ slug: ancestor.slug, name: ancestor.frontmatter.name });
      cursor = ancestor.frontmatter.parent;
    }
  }
  const childMap = new Map<string, string[]>();
  for (const p of knownPages) {
    const par = p.frontmatter.parent || "";
    childMap.set(par, [...(childMap.get(par) || []), p.slug]);
  }
  const blocked = new Set<string>([slug]);
  const stack = [slug];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const child of childMap.get(cur) || []) if (!blocked.has(child)) (blocked.add(child), stack.push(child));
  }
  const parentOptions = knownPages.filter((p) => !blocked.has(p.slug)).sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
  const pageMatches = (candidate: WikiPage, filter: string) => {
    const query = filter.trim().toLowerCase();
    if (!query) return true;
    return [candidate.frontmatter.name, candidate.slug, candidate.frontmatter.category, ...(candidate.frontmatter.tags || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  };
  const filteredParentOptions = parentOptions.filter((candidate) => candidate.slug === frontmatter.parent || pageMatches(candidate, parentFilter));
  const filteredLinkPages = knownPages
    .filter((candidate) => pageMatches(candidate, linkFilter))
    .sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
  const filteredInsertMedia = media.filter((item) => {
    const query = mediaFilter.trim().toLowerCase();
    return !query || [item.name, item.path, item.caption, item.alt, ...(item.tags || [])].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
  const breadcrumbsEl = breadcrumbs.length > 0 && (
    <nav className="breadcrumbs">
      {breadcrumbs.map((b) => (
        <a key={b.slug} href={`/campaigns/${campaign.id}/pages/${b.slug}`}>{b.name}</a>
      ))}
      <span>{frontmatter.name}</span>
    </nav>
  );

  const coverRaw = frontmatter.cover ? String(frontmatter.cover) : "";
  const coverSrc = coverRaw ? (/^https?:\/\//i.test(coverRaw) ? coverRaw : resolveMedia(coverRaw.replace(/^\/?wiki\/media\//, ""))) : "";
  const coverEl = coverSrc ? <img className="page-cover" src={coverSrc} alt="" /> : null;

  if (!isEditing) {
    return (
      <section className="reader-shell">
        <div className="editor-panel">
          <div className="editor-toolbar">
            {canManage && <button type="button" className={mode === "gm" ? "active" : ""} onClick={() => setMode("gm")}>GM preview</button>}
            <button type="button" className={mode === "player" ? "active" : ""} onClick={() => setMode("player")}>Player preview</button>
            <button type="button" className={mode === "handout" ? "active" : ""} onClick={() => setMode("handout")}>Handout</button>
            {canManage && <button type="button" onClick={() => setIsEditing(true)}>Edit page</button>}
            {canManage && <button type="button" className="danger" disabled={isSaving} onClick={deletePage}>Delete page</button>}
          </div>
          {message && <p className="toast editor-toast">{message}</p>}
          {mode !== "handout" && breadcrumbsEl}
          <article className={mode === "handout" ? "preview page-reader handout-preview" : "preview page-reader"}>
            {coverEl}
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
      </section>
    );
  }

  return (
    <form onSubmit={save} className="page-grid">
      <aside className="page-sidebar">
        {breadcrumbsEl}
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
          <label>Name<input value={frontmatter.name || ""} onChange={(e) => updateField("name", e.target.value)} readOnly={!fieldsEditable} /></label>
          <label>Summary<textarea value={frontmatter.summary || ""} onChange={(e) => updateField("summary", e.target.value)} readOnly={!fieldsEditable} /></label>
          <label>Status<input value={frontmatter.status || ""} onChange={(e) => updateField("status", e.target.value)} readOnly={!fieldsEditable} placeholder="alive, active, destroyed..." /></label>
          <label>Tags<input value={tags.join(", ")} onChange={(e) => updateField("tags", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!fieldsEditable} /></label>
          <label>Aliases<input value={(frontmatter.aliases || []).join(", ")} onChange={(e) => updateField("aliases", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!fieldsEditable} /></label>
          <label>Parent page
            {fieldsEditable && <input type="search" value={parentFilter} onChange={(event) => setParentFilter(event.target.value)} placeholder="Filter pages" />}
            <select value={frontmatter.parent || ""} onChange={(e) => updateField("parent", e.target.value || undefined)} disabled={!fieldsEditable}>
            <option value="">— none (top level) —</option>
            {filteredParentOptions.map((p) => <option key={p.slug} value={p.slug}>{p.frontmatter.name} · {p.frontmatter.category}</option>)}
          </select></label>
        </div>

        <div className="field-group">
          <h3>Visibility</h3>
          <label>Visibility<select value={frontmatter.visibility} onChange={(e) => updateField("visibility", e.target.value)} disabled={!fieldsEditable}><option value="gm">GM only</option><option value="players">Players</option></select></label>
          <label>Approval<select value={frontmatter.approvalStatus} onChange={(e) => updateField("approvalStatus", e.target.value)} disabled={!fieldsEditable}><option value="approved">Approved</option><option value="unapproved">Unapproved</option><option value="rejected">Rejected</option></select></label>
          <label className="check"><input type="checkbox" checked={Boolean(frontmatter.knownToPlayers)} onChange={(e) => updateField("knownToPlayers", e.target.checked)} disabled={!fieldsEditable} /> Known to players</label>
        </div>

        <div className="field-group">
          <h3>Links</h3>
          <label>Key links<input value={keyLinks.join(", ")} onChange={(e) => updateField("keyLinks", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!fieldsEditable} /></label>
          <label>Cover image<input value={frontmatter.cover || ""} onChange={(e) => updateField("cover", e.target.value || undefined)} readOnly={!fieldsEditable} placeholder="filename.jpg (in /wiki/media) or URL" /></label>
          <label>Foundry link<input value={frontmatter.foundryLink || ""} onChange={(e) => updateField("foundryLink", e.target.value)} readOnly={!fieldsEditable} placeholder="Actor UUID or scene URL" /></label>
        </div>

        {isEvent && (
          <div className="field-group">
            <h3>Timeline</h3>
            <label>Event date<input value={frontmatter.eventDate || ""} onChange={(e) => updateField("eventDate", e.target.value)} readOnly={!fieldsEditable} placeholder="1105-123 or 2026-06-17" /></label>
            <label>Timeline date<input value={frontmatter.timelineDate || ""} onChange={(e) => updateField("timelineDate", e.target.value)} readOnly={!fieldsEditable} /></label>
            <label>Era<input value={frontmatter.era || ""} onChange={(e) => updateField("era", e.target.value || undefined)} readOnly={!fieldsEditable} placeholder="The Long Night, Third Age..." /></label>
            <label>Track<input value={frontmatter.track || ""} onChange={(e) => updateField("track", e.target.value || undefined)} readOnly={!fieldsEditable} placeholder="political, personal, cosmic..." /></label>
          </div>
        )}

        {isTraveller && (
          <div className="field-group">
            <h3>Traveller</h3>
            <label>UWP<input value={frontmatter.uwp || ""} onChange={(e) => updateField("uwp", e.target.value)} readOnly={!fieldsEditable} placeholder="A867A74-C" /></label>
            <label>Allegiance<input value={frontmatter.allegiance || ""} onChange={(e) => updateField("allegiance", e.target.value)} readOnly={!fieldsEditable} placeholder="Solomani Confederation" /></label>
            <label>Trade codes<input value={tradeCodes.join(", ")} onChange={(e) => updateField("tradeCodes", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!fieldsEditable} /></label>
            <label>Subsector<input value={frontmatter.subsector || ""} onChange={(e) => updateField("subsector", e.target.value)} readOnly={!fieldsEditable} /></label>
            <label>Patron<input value={frontmatter.patron || ""} onChange={(e) => updateField("patron", e.target.value)} readOnly={!fieldsEditable} /></label>
            <label>Tech level<input value={frontmatter.techLevel || ""} onChange={(e) => updateField("techLevel", e.target.value)} readOnly={!fieldsEditable} /></label>
          </div>
        )}

        {frontmatter.sourceImport && (
          <div className="field-group">
            <h3>Source Import</h3>
            <p className="muted">{frontmatter.sourceImport}</p>
            {fieldsEditable && (
              <>
                <label>New source JSON<textarea value={sourceJsonDraft} onChange={(event) => setSourceJsonDraft(event.target.value)} rows={6} placeholder='{"name":"Updated Actor"}' /></label>
                <button type="button" className="secondary" onClick={compareSourceImport}>Compare source</button>
                {sourceDiff && (
                  <div className="diff-list">
                    <p className="muted">
                      {sourceDiff.counts.added} added · {sourceDiff.counts.changed} changed · {sourceDiff.counts.removed} removed
                    </p>
                    {sourceDiff.changes.map((change: any) => (
                      <article key={`${change.type}-${change.path}`} className={`diff-row ${change.type}`}>
                        <strong>{change.type}</strong>
                        <span>{change.path}</span>
                        <code>{change.type === "added" ? String(change.after) : change.type === "removed" ? String(change.before) : `${String(change.before)} -> ${String(change.after)}`}</code>
                      </article>
                    ))}
                    {!sourceDiff.changes.length && <p className="muted">No source changes detected.</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}
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
          {fieldsEditable && <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>}
          {fieldsEditable && <button type="button" disabled={isSaving} onClick={() => savePage(true)}>{isSaving ? "Saving..." : "Save and finish"}</button>}
          {canManage && !isEditing && <button type="button" onClick={() => setIsEditing(true)}>Edit page</button>}
          {canManage && <button type="button" className="danger" disabled={isSaving} onClick={deletePage}>Delete page</button>}
        </div>
        {message && <p className="toast editor-toast">{message}</p>}
        {fieldsEditable && (
          <div className="insert-toolbar">
            <label>
              Wiki link
              <input type="search" value={linkFilter} onChange={(event) => setLinkFilter(event.target.value)} placeholder="Filter pages" />
              <select defaultValue="" onChange={(event) => { insertWikiLink(event.target.value); event.target.value = ""; }}>
                <option value="">Insert page link</option>
                {filteredLinkPages.map((knownPage) => <option key={knownPage.slug} value={knownPage.frontmatter.name}>{knownPage.frontmatter.name} · {knownPage.frontmatter.category}</option>)}
              </select>
            </label>
            <label>
              Media
              <input type="search" value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value)} placeholder="Filter media" />
              <select defaultValue="" onChange={(event) => { insertMedia(event.target.value); event.target.value = ""; }}>
                <option value="">Insert media</option>
                {filteredInsertMedia.map((item) => <option key={item.path} value={item.path}>{item.name}</option>)}
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
        {isEditing ? (
          <div className="editor-workspace">
            {fieldsEditable && (
              <div className="format-toolbar" aria-label="Markdown formatting controls">
                <button type="button" className="icon-button" title="Heading 1" onClick={() => heading(1)}><Heading1 size={18} /></button>
                <button type="button" className="icon-button" title="Heading 2" onClick={() => heading(2)}><Heading2 size={18} /></button>
                <button type="button" className="icon-button" title="Heading 3" onClick={() => heading(3)}><Heading3 size={18} /></button>
                <button type="button" className="icon-button" title="Bold" onClick={() => wrapSelection("**", "**", "bold text")}><Bold size={18} /></button>
                <button type="button" className="icon-button" title="Italic" onClick={() => wrapSelection("*", "*", "italic text")}><Italic size={18} /></button>
                <button type="button" className="icon-button" title="Bulleted list" onClick={() => prefixSelectedLines("- ")}><List size={18} /></button>
                <button type="button" className="icon-button" title="Numbered list" onClick={numberedList}><ListOrdered size={18} /></button>
                <button type="button" className="icon-button" title="Quote" onClick={() => prefixSelectedLines("> ")}><Quote size={18} /></button>
                <button type="button" className="icon-button" title="Inline code" onClick={() => wrapSelection("`", "`", "code")}><Code2 size={18} /></button>
                <button type="button" className="icon-button" title="Code block" onClick={codeBlock}><Code2 size={18} /></button>
                <button type="button" className="icon-button" title="Link" onClick={markdownLink}><Link2 size={18} /></button>
              </div>
            )}
            <div className="editor-split">
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={onEditorKeyDown} spellCheck={false} readOnly={!fieldsEditable} />
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
          </div>
        ) : (
          <article className={mode === "handout" ? "preview page-reader handout-preview" : "preview page-reader"}>
            {coverEl}
            {mode === "handout" && (
              <header className="handout-header">
                <p>Player Handout</p>
                <h1>{frontmatter.name}</h1>
                {frontmatter.summary && <span>{frontmatter.summary}</span>}
              </header>
            )}
            <div onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: preview }} />
          </article>
        )}
      </section>
    </form>
  );
}

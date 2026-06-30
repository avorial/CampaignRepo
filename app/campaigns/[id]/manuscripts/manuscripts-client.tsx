"use client";

import { useEffect, useMemo, useState } from "react";
import type { Manuscript } from "@/lib/manuscripts";
import type { WikiPage } from "@/lib/types";
import { renderMarkdown } from "@/lib/markdown";

type KnownPage = { slug: string; name: string; category: string };

export default function ManuscriptsClient({ campaignId }: { campaignId: number }) {
  const api = `/api/campaigns/${campaignId}`;

  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [allPages, setAllPages] = useState<KnownPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Manuscript | null>(null);
  const [view, setView] = useState<"list" | "edit" | "read">("list");

  // Edit state
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVisibility, setEditVisibility] = useState<"gm" | "players">("gm");
  const [editPages, setEditPages] = useState<string[]>([]);
  const [pageFilter, setPageFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // New manuscript form
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Read view: full page content
  const [readPages, setReadPages] = useState<WikiPage[]>([]);
  const [readLoading, setReadLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${api}/manuscripts`).then((r) => r.json()),
      fetch(`${api}/pages`).then((r) => r.json())
    ]).then(([mData, pData]) => {
      setManuscripts(mData.manuscripts || []);
      const pages: WikiPage[] = pData.pages || [];
      setAllPages(pages.map((p) => ({ slug: p.slug, name: p.frontmatter.name, category: p.frontmatter.category })));
      setLoading(false);
    });
  }, [campaignId]);

  function openEdit(m: Manuscript) {
    setSelected(m);
    setEditTitle(m.title);
    setEditDesc(m.description || "");
    setEditVisibility(m.visibility);
    setEditPages([...m.pages]);
    setPageFilter("");
    setMessage("");
    setView("edit");
  }

  async function openRead(m: Manuscript) {
    setSelected(m);
    setView("read");
    setReadLoading(true);
    const pages = await Promise.all(
      m.pages.map((slug) => fetch(`${api}/pages/${slug}`).then((r) => r.json()).then((d) => d.page || null).catch(() => null))
    );
    setReadPages(pages.filter(Boolean));
    setReadLoading(false);
  }

  async function createManuscript() {
    if (!newTitle.trim()) return;
    setSaving(true);
    const res = await fetch(`${api}/manuscripts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), pages: [], visibility: "gm" })
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      const created: Manuscript = { slug: data.slug, title: newTitle.trim(), visibility: "gm", pages: [] };
      setManuscripts((prev) => [...prev, created]);
      setNewTitle("");
      setShowNew(false);
      openEdit(created);
    }
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    setMessage("Saving…");
    const res = await fetch(`${api}/manuscripts/${selected.slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, description: editDesc, visibility: editVisibility, pages: editPages })
    });
    setSaving(false);
    if (res.ok) {
      const updated = { ...selected, title: editTitle, description: editDesc, visibility: editVisibility, pages: editPages };
      setManuscripts((prev) => prev.map((m) => m.slug === selected.slug ? updated : m));
      setSelected(updated);
      setMessage("Saved.");
      setTimeout(() => setMessage(""), 2000);
    } else {
      const d = await res.json();
      setMessage(d.error || "Save failed.");
    }
  }

  async function deleteManuscript(m: Manuscript) {
    if (!window.confirm(`Delete "${m.title}"?`)) return;
    await fetch(`${api}/manuscripts/${m.slug}`, { method: "DELETE" });
    setManuscripts((prev) => prev.filter((x) => x.slug !== m.slug));
    if (selected?.slug === m.slug) { setSelected(null); setView("list"); }
  }

  function addPage(slug: string) {
    if (!editPages.includes(slug)) setEditPages((prev) => [...prev, slug]);
  }

  function removePage(slug: string) {
    setEditPages((prev) => prev.filter((s) => s !== slug));
  }

  function movePage(slug: string, dir: -1 | 1) {
    setEditPages((prev) => {
      const idx = prev.indexOf(slug);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  const pageMap = useMemo(() => new Map(allPages.map((p) => [p.slug, p])), [allPages]);

  const filteredPages = useMemo(() => {
    const q = pageFilter.trim().toLowerCase();
    return allPages.filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.includes(q));
  }, [allPages, pageFilter]);

  // ── Read view ──────────────────────────────────────────────────────────────
  if (view === "read" && selected) {
    return (
      <div className="manuscript-shell">
        <div className="manuscript-toolbar">
          <button className="secondary" onClick={() => setView("list")}>← Back</button>
          <button onClick={() => openEdit(selected)}>Edit</button>
          <strong style={{ flex: 1 }}>{selected.title}</strong>
          <button className="secondary" onClick={() => window.print()}>Print / PDF</button>
        </div>
        <div className="manuscript-reader">
          {readLoading ? <p className="muted">Loading pages…</p> : readPages.map((p, i) => (
            <article key={p.slug} className="manuscript-chapter">
              <h1 className="manuscript-chapter-title">{p.frontmatter.name}</h1>
              {p.frontmatter.summary && <p className="manuscript-chapter-summary">{p.frontmatter.summary}</p>}
              <div
                className="prose"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(p.content, "gm") }}
              />
              {i < readPages.length - 1 && <hr className="manuscript-break" />}
            </article>
          ))}
          {!readLoading && readPages.length === 0 && <p className="muted">No pages in this manuscript yet.</p>}
        </div>
      </div>
    );
  }

  // ── Edit view ──────────────────────────────────────────────────────────────
  if (view === "edit" && selected) {
    return (
      <div className="manuscript-shell">
        <div className="manuscript-toolbar">
          <button className="secondary" onClick={() => setView("list")}>← Back</button>
          <button onClick={() => openRead(selected)}>Read</button>
          <strong style={{ flex: 1 }}>{editTitle || "Untitled"}</strong>
          {message && <span className={message.startsWith("Save") ? "toast" : "error"}>{message}</span>}
          <button onClick={saveEdit} disabled={saving}>Save</button>
        </div>

        <div className="manuscript-edit-layout">
          {/* Meta panel */}
          <div className="manuscript-meta panel stack">
            <label>Title<input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></label>
            <label>Description<textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} /></label>
            <label>Visibility
              <select value={editVisibility} onChange={(e) => setEditVisibility(e.target.value as "gm" | "players")}>
                <option value="gm">GM only</option>
                <option value="players">Players</option>
              </select>
            </label>
          </div>

          {/* Page order panel */}
          <div className="panel">
            <h3 style={{ margin: "0 0 10px" }}>Pages in this manuscript ({editPages.length})</h3>
            {editPages.length === 0 && <p className="muted" style={{ fontSize: "13px" }}>Add pages from the list on the right →</p>}
            <ul className="manuscript-page-list">
              {editPages.map((slug, i) => {
                const p = pageMap.get(slug);
                return (
                  <li key={slug} className="manuscript-page-row">
                    <span className="manuscript-page-num">{i + 1}</span>
                    <span className="manuscript-page-name">{p?.name || slug}</span>
                    <span className="tag-chip" style={{ marginLeft: 4 }}>{p?.category || "?"}</span>
                    <div className="manuscript-page-actions">
                      <button type="button" className="linklike" onClick={() => movePage(slug, -1)} disabled={i === 0} title="Move up">↑</button>
                      <button type="button" className="linklike" onClick={() => movePage(slug, 1)} disabled={i === editPages.length - 1} title="Move down">↓</button>
                      <button type="button" className="linklike" style={{ color: "var(--danger, #c0392b)" }} onClick={() => removePage(slug)}>✕</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Page picker */}
          <div className="panel">
            <h3 style={{ margin: "0 0 10px" }}>Add pages</h3>
            <input
              placeholder="Filter pages…"
              value={pageFilter}
              onChange={(e) => setPageFilter(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <ul className="manuscript-page-list" style={{ maxHeight: 400, overflowY: "auto" }}>
              {filteredPages.map((p) => (
                <li key={p.slug} className="manuscript-page-row">
                  <span className="manuscript-page-name">{p.name}</span>
                  <span className="tag-chip" style={{ marginLeft: 4 }}>{p.category}</span>
                  {editPages.includes(p.slug)
                    ? <span className="muted" style={{ fontSize: "11px", marginLeft: "auto" }}>added</span>
                    : <button type="button" className="linklike" style={{ marginLeft: "auto" }} onClick={() => addPage(p.slug)}>+ Add</button>
                  }
                </li>
              ))}
              {filteredPages.length === 0 && <li className="muted">No pages match.</li>}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="manuscript-shell">
      {loading ? <p className="muted">Loading…</p> : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button onClick={() => setShowNew(true)}>+ New manuscript</button>
          </div>

          {showNew && (
            <div className="panel stack" style={{ marginBottom: 16, maxWidth: 400 }}>
              <label>Title<input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Session Zero Notes" autoFocus /></label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={createManuscript} disabled={saving || !newTitle.trim()}>Create</button>
                <button className="secondary" onClick={() => { setShowNew(false); setNewTitle(""); }}>Cancel</button>
              </div>
            </div>
          )}

          {manuscripts.length === 0 && !showNew && (
            <div className="onboarding-hero">
              <div className="onboarding-hero-icon">📜</div>
              <h3>No manuscripts yet</h3>
              <p>A manuscript stitches your wiki pages into an ordered document — perfect for campaign bibles, session prep packets, or player handouts.</p>
              <button onClick={() => setShowNew(true)}>Create your first manuscript</button>
            </div>
          )}

          <div className="manuscript-grid">
            {manuscripts.map((m) => (
              <div key={m.slug} className="panel manuscript-card">
                <div className="manuscript-card-header">
                  <strong>{m.title}</strong>
                  <span className="tag-chip">{m.visibility === "players" ? "players" : "GM"}</span>
                </div>
                {m.description && <p className="muted" style={{ fontSize: "13px", margin: "6px 0" }}>{m.description}</p>}
                <p className="muted" style={{ fontSize: "12px" }}>{m.pages.length} page{m.pages.length !== 1 ? "s" : ""}</p>
                <div className="manuscript-card-actions">
                  <button className="secondary" onClick={() => openEdit(m)}>Edit</button>
                  <button onClick={() => openRead(m)}>Read</button>
                  <button className="danger" onClick={() => deleteManuscript(m)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

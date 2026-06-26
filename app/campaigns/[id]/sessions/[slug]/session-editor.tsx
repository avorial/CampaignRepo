"use client";

import { useEffect, useMemo, useState } from "react";
import type { Campaign } from "@/lib/types";

type AgendaItem = { text: string; done: boolean };
type Frontmatter = { title: string; date?: string; status?: string; agenda: AgendaItem[]; pinned: string[] };
type PageRef = { slug: string; name: string };

export default function SessionEditor({ campaign, slug }: { campaign: Campaign; slug: string }) {
  const base = `/campaigns/${campaign.id}`;
  const api = `/api${base}`;
  const [fm, setFm] = useState<Frontmatter | null>(null);
  const [notes, setNotes] = useState("");
  const [pages, setPages] = useState<PageRef[]>([]);
  const [newItem, setNewItem] = useState("");
  const [pinSlug, setPinSlug] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [sRes, pRes] = await Promise.all([fetch(`${api}/sessions/${slug}`), fetch(`${api}/pages`)]);
      if (sRes.ok) {
        const data = await sRes.json();
        setFm(data.session.frontmatter);
        setNotes(data.session.notes || "");
      } else {
        setMessage("Could not load session.");
      }
      if (pRes.ok) {
        const data = await pRes.json();
        setPages((data.pages || []).map((p: any) => ({ slug: p.slug, name: p.frontmatter.name })));
      }
    })();
  }, [slug]);

  const nameBySlug = useMemo(() => new Map(pages.map((p) => [p.slug, p.name])), [pages]);

  function patch(next: Partial<Frontmatter>) {
    setFm((f) => (f ? { ...f, ...next } : f));
  }

  async function save() {
    if (!fm) return;
    setBusy(true);
    setMessage("Saving…");
    const res = await fetch(`${api}/sessions/${slug}`, { method: "PUT", body: JSON.stringify({ frontmatter: fm, notes }) });
    setBusy(false);
    setMessage(res.ok ? "Session saved." : (await res.json().catch(() => ({})))?.error || "Save failed.");
  }

  async function remove() {
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    const res = await fetch(`${api}/sessions/${slug}`, { method: "DELETE" });
    if (res.ok) window.location.href = `${base}/sessions`;
    else setMessage("Could not delete session.");
  }

  async function toReport() {
    if (!fm) return;
    const agendaMd = fm.agenda.length ? "\n\n## Agenda\n" + fm.agenda.map((a) => `- [${a.done ? "x" : " "}] ${a.text}`).join("\n") : "";
    const body = `${notes}${agendaMd}\n`;
    setBusy(true);
    setMessage("Creating report page…");
    const res = await fetch(`${api}/pages`, {
      method: "POST",
      body: JSON.stringify({ name: `${fm.title} (report)`, category: "event", visibility: "gm" })
    });
    const data = await res.json();
    if (!((res.ok || res.status === 409) && data.slug)) {
      setBusy(false);
      setMessage(data.error || "Could not create report.");
      return;
    }
    // Round-trip: read the created page's frontmatter, then write the notes body.
    const pageRes = await fetch(`${api}/pages/${data.slug}`);
    if (pageRes.ok) {
      const { page } = await pageRes.json();
      await fetch(`${api}/pages/${data.slug}`, {
        method: "PUT",
        body: JSON.stringify({ frontmatter: page.frontmatter, content: body })
      }).catch(() => undefined);
    }
    setBusy(false);
    window.location.href = `${base}/pages/${data.slug}?edit=1`;
  }

  if (!fm) return <p className="muted">{message || "Loading session…"}</p>;

  const unpinned = pages.filter((p) => !fm.pinned.includes(p.slug));

  return (
    <section className="page-grid">
      <div className="page-sidebar">
        <label>Title<input value={fm.title} onChange={(e) => patch({ title: e.target.value })} /></label>
        <label>Date<input type="date" value={fm.date || ""} onChange={(e) => patch({ date: e.target.value })} /></label>
        <label>Status
          <select value={fm.status || ""} onChange={(e) => patch({ status: e.target.value })}>
            <option value="">—</option>
            <option value="planned">Planned</option>
            <option value="in-progress">In progress</option>
            <option value="played">Played</option>
          </select>
        </label>

        <div className="field-group">
          <h3>Pinned pages</h3>
          <div className="badges">
            {fm.pinned.map((s) => (
              <span key={s}>
                <a href={`${base}/pages/${s}`}>{nameBySlug.get(s) || s}</a>
                <button type="button" className="linklike" onClick={() => patch({ pinned: fm.pinned.filter((x) => x !== s) })}> ✕</button>
              </span>
            ))}
            {!fm.pinned.length && <span className="muted">None pinned.</span>}
          </div>
          <div className="inline-form">
            <select value={pinSlug} onChange={(e) => setPinSlug(e.target.value)}>
              <option value="">Add a page…</option>
              {unpinned.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
            <button type="button" className="secondary" disabled={!pinSlug} onClick={() => { patch({ pinned: [...fm.pinned, pinSlug] }); setPinSlug(""); }}>Pin</button>
          </div>
        </div>

        <div className="field-group">
          <button type="button" onClick={save} disabled={busy}>Save session</button>
          <button type="button" className="secondary" onClick={toReport} disabled={busy}>Make report page</button>
          <button type="button" className="secondary danger" onClick={remove}>Delete</button>
        </div>
        {message && <p className="toast">{message}</p>}
      </div>

      <div className="workspace-main">
        <div className="panel">
          <h2>Agenda</h2>
          <ul className="steps" style={{ gridTemplateColumns: "1fr" }}>
            {fm.agenda.map((item, i) => (
              <li key={i} className="check">
                <input type="checkbox" checked={item.done} onChange={() => patch({ agenda: fm.agenda.map((a, j) => (j === i ? { ...a, done: !a.done } : a)) })} />
                <span style={{ flex: 1, textDecoration: item.done ? "line-through" : "none", color: item.done ? "var(--text-tertiary)" : "var(--text-primary)" }}>{item.text}</span>
                <button type="button" className="linklike" onClick={() => patch({ agenda: fm.agenda.filter((_, j) => j !== i) })}>remove</button>
              </li>
            ))}
            {!fm.agenda.length && <li className="muted">No agenda items yet.</li>}
          </ul>
          <form
            className="inline-form"
            onSubmit={(e) => { e.preventDefault(); if (newItem.trim()) { patch({ agenda: [...fm.agenda, { text: newItem.trim(), done: false }] }); setNewItem(""); } }}
          >
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add agenda item…" />
            <button className="secondary">Add</button>
          </form>
        </div>

        <div className="panel">
          <h2>GM notes</h2>
          <p className="muted">Private prep + play notes (Markdown). Stored in the repo, never shown to players.</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={16} placeholder="Scenes, encounters, secrets, beats…" />
        </div>
      </div>
    </section>
  );
}

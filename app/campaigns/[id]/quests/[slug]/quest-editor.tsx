"use client";

import { useEffect, useMemo, useState } from "react";
import type { Campaign } from "@/lib/types";

type Objective = { text: string; done: boolean };
type Frontmatter = {
  title: string;
  status: "hook" | "active" | "completed" | "failed";
  arc?: string;
  reward?: string;
  visibility: "gm" | "players";
  objectives: Objective[];
  participants: string[];
  locations: string[];
};
type PageRef = { slug: string; name: string };

const STATUSES: Frontmatter["status"][] = ["hook", "active", "completed", "failed"];

export default function QuestEditor({ campaign, slug }: { campaign: Campaign; slug: string }) {
  const base = `/campaigns/${campaign.id}`;
  const [fm, setFm] = useState<Frontmatter | null>(null);
  const [description, setDescription] = useState("");
  const [pages, setPages] = useState<PageRef[]>([]);
  const [newObj, setNewObj] = useState("");
  const [addPart, setAddPart] = useState("");
  const [addLoc, setAddLoc] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [qRes, pRes] = await Promise.all([fetch(`${base}/quests/${slug}`), fetch(`${base}/pages`)]);
      if (qRes.ok) {
        const data = await qRes.json();
        setFm(data.quest.frontmatter);
        setDescription(data.quest.description || "");
      } else setMessage("Could not load quest.");
      if (pRes.ok) {
        const data = await pRes.json();
        setPages((data.pages || []).map((p: any) => ({ slug: p.slug, name: p.frontmatter.name })));
      }
    })();
  }, [slug]);

  const nameBySlug = useMemo(() => new Map(pages.map((p) => [p.slug, p.name])), [pages]);
  const patch = (p: Partial<Frontmatter>) => setFm((f) => (f ? { ...f, ...p } : f));

  async function save() {
    if (!fm) return;
    setBusy(true);
    setMessage("Saving…");
    const res = await fetch(`${base}/quests/${slug}`, { method: "PUT", body: JSON.stringify({ frontmatter: fm, description }) });
    setBusy(false);
    setMessage(res.ok ? "Quest saved." : (await res.json().catch(() => ({})))?.error || "Save failed.");
  }
  async function remove() {
    if (!window.confirm("Delete this quest?")) return;
    const res = await fetch(`${base}/quests/${slug}`, { method: "DELETE" });
    if (res.ok) window.location.href = `${base}/quests`;
    else setMessage("Could not delete quest.");
  }

  if (!fm) return <p className="muted">{message || "Loading quest…"}</p>;

  const linkPicker = (key: "participants" | "locations", value: string, setValue: (v: string) => void, label: string) => {
    const current = fm[key];
    const available = pages.filter((p) => !current.includes(p.slug));
    return (
      <div className="field-group">
        <h3>{label}</h3>
        <div className="badges">
          {current.map((s) => (
            <span key={s}>
              <a href={`${base}/pages/${s}`}>{nameBySlug.get(s) || s}</a>
              <button type="button" className="linklike" onClick={() => patch({ [key]: current.filter((x) => x !== s) } as Partial<Frontmatter>)}> ✕</button>
            </span>
          ))}
          {!current.length && <span className="muted">None.</span>}
        </div>
        <div className="inline-form">
          <select value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">Add…</option>
            {available.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
          <button type="button" className="secondary" disabled={!value} onClick={() => { patch({ [key]: [...current, value] } as Partial<Frontmatter>); setValue(""); }}>Add</button>
        </div>
      </div>
    );
  };

  return (
    <section className="page-grid">
      <div className="page-sidebar">
        <label>Title<input value={fm.title} onChange={(e) => patch({ title: e.target.value })} /></label>
        <label>Status
          <select value={fm.status} onChange={(e) => patch({ status: e.target.value as Frontmatter["status"] })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Arc<input value={fm.arc || ""} onChange={(e) => patch({ arc: e.target.value })} placeholder="Story arc / chapter" /></label>
        <label>Reward<input value={fm.reward || ""} onChange={(e) => patch({ reward: e.target.value })} placeholder="2,000 Cr, a favor…" /></label>
        <label>Visibility
          <select value={fm.visibility} onChange={(e) => patch({ visibility: e.target.value as Frontmatter["visibility"] })}>
            <option value="gm">GM only</option>
            <option value="players">Players</option>
          </select>
        </label>

        {linkPicker("participants", addPart, setAddPart, "Participants")}
        {linkPicker("locations", addLoc, setAddLoc, "Locations")}

        <div className="field-group">
          <button type="button" onClick={save} disabled={busy}>Save quest</button>
          <button type="button" className="secondary danger" onClick={remove}>Delete</button>
        </div>
        {message && <p className="toast">{message}</p>}
      </div>

      <div className="workspace-main">
        <div className="panel">
          <h2>Objectives</h2>
          <ul className="steps" style={{ gridTemplateColumns: "1fr" }}>
            {fm.objectives.map((item, i) => (
              <li key={i} className="check">
                <input type="checkbox" checked={item.done} onChange={() => patch({ objectives: fm.objectives.map((o, j) => (j === i ? { ...o, done: !o.done } : o)) })} />
                <span style={{ flex: 1, textDecoration: item.done ? "line-through" : "none", color: item.done ? "var(--text-tertiary)" : "var(--text-primary)" }}>{item.text}</span>
                <button type="button" className="linklike" onClick={() => patch({ objectives: fm.objectives.filter((_, j) => j !== i) })}>remove</button>
              </li>
            ))}
            {!fm.objectives.length && <li className="muted">No objectives yet.</li>}
          </ul>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (newObj.trim()) { patch({ objectives: [...fm.objectives, { text: newObj.trim(), done: false }] }); setNewObj(""); } }}>
            <input value={newObj} onChange={(e) => setNewObj(e.target.value)} placeholder="Add objective…" />
            <button className="secondary">Add</button>
          </form>
        </div>

        <div className="panel">
          <h2>Details</h2>
          <p className="muted">Description, clues, secrets (use <code>:::gm</code> blocks for GM-only secrets). Markdown.</p>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={14} placeholder="The hook, the truth behind it, clues, and how it can resolve…" />
        </div>
      </div>
    </section>
  );
}

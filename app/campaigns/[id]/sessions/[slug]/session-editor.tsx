"use client";

import { useEffect, useMemo, useState } from "react";
import type { Campaign } from "@/lib/types";
import { DatePicker, formatDateDisplay } from "../date-picker";

const MOODS = ["investigation", "combat", "political", "travel", "mystery", "downtime", "horror", "social", "heist"];
const MOOD_LABEL: Record<string, string> = {
  investigation: "Investigation", combat: "Combat", political: "Political",
  travel: "Travel", mystery: "Mystery", downtime: "Downtime",
  horror: "Horror", social: "Social", heist: "Heist"
};
const VALID_STATUSES = ["planned", "played", "cancelled"];

type Attendee = { name: string; status: "present" | "late" | "left-early" | "absent" };
type AssetLink = { label: string; url: string };
type AgendaItem = { text: string; done: boolean };
type Thread = { text: string; done: boolean };
type Frontmatter = {
  title: string;
  number?: number;
  date?: string;
  status?: "planned" | "played" | "cancelled";
  mood?: string;
  arc?: string;
  attendees: Attendee[];
  assets: AssetLink[];
  agenda: AgendaItem[];
  summary?: string;
  npcs: string[];
  locations: string[];
  threads: Thread[];
  pinned: string[];
};
type PageRef = { slug: string; name: string };

export default function SessionEditor({ campaign, slug }: { campaign: Campaign; slug: string }) {
  const base = `/campaigns/${campaign.id}`;
  const api = `/api${base}`;
  const [fm, setFm] = useState<Frontmatter | null>(null);
  const [notes, setNotes] = useState("");
  const [pages, setPages] = useState<PageRef[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newAttendee, setNewAttendee] = useState("");
  const [newAgenda, setNewAgenda] = useState("");
  const [newThread, setNewThread] = useState("");
  const [addNpc, setAddNpc] = useState("");
  const [addLoc, setAddLoc] = useState("");
  const [addPin, setAddPin] = useState("");
  const [newAssetLabel, setNewAssetLabel] = useState("");
  const [newAssetUrl, setNewAssetUrl] = useState("");

  useEffect(() => {
    (async () => {
      const [sRes, pRes] = await Promise.all([fetch(`${api}/sessions/${slug}`), fetch(`${api}/pages`)]);
      if (sRes.ok) {
        const data = await sRes.json();
        const s = data.session;
        const rawStatus = s.frontmatter.status;
        setFm({
          title: s.frontmatter.title || "",
          number: s.frontmatter.number,
          date: s.frontmatter.date || "",
          status: VALID_STATUSES.includes(rawStatus) ? rawStatus : "planned",
          mood: s.frontmatter.mood || "",
          arc: s.frontmatter.arc || "",
          attendees: s.frontmatter.attendees || [],
          assets: s.frontmatter.assets || [],
          agenda: s.frontmatter.agenda || [],
          summary: s.frontmatter.summary || "",
          npcs: s.frontmatter.npcs || [],
          locations: s.frontmatter.locations || [],
          threads: s.frontmatter.threads || [],
          pinned: s.frontmatter.pinned || []
        });
        setNotes(s.notes || "");
      } else {
        setMessage("Could not load session.");
      }
      if (pRes.ok) {
        const data = await pRes.json();
        setPages((data.pages || []).map((p: { slug: string; frontmatter: { name: string } }) => ({ slug: p.slug, name: p.frontmatter.name })));
      }
    })();
  }, [slug]);

  const nameBySlug = useMemo(() => new Map(pages.map((p) => [p.slug, p.name])), [pages]);
  const patch = (p: Partial<Frontmatter>) => setFm((f) => (f ? { ...f, ...p } : f));

  async function save() {
    if (!fm) return;
    setBusy(true);
    setMessage("Saving…");
    const res = await fetch(`${api}/sessions/${slug}`, {
      method: "PUT",
      body: JSON.stringify({
        frontmatter: {
          ...fm,
          date: fm.date || undefined,
          status: fm.status || undefined,
          mood: fm.mood || undefined,
          arc: fm.arc || undefined,
          summary: fm.summary || undefined,
          number: fm.number || undefined
        },
        notes
      })
    });
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
    setBusy(true);
    setMessage("Creating report page…");

    const title = fm.number ? `Session ${fm.number} — ${fm.title}` : `${fm.title} (report)`;
    const present = fm.attendees.filter((a) => a.status !== "absent");

    let body = "";
    if (fm.date) body += `**Date:** ${formatDateDisplay(fm.date)}\n\n`;
    if (present.length) {
      const names = present.map((a) =>
        a.name + (a.status === "late" ? " *(late)*" : a.status === "left-early" ? " *(left early)*" : "")
      ).join(", ");
      body += `**Attended:** ${names} — ${present.length}/${fm.attendees.length}\n\n`;
    }
    if (fm.summary) body += `## Summary\n\n${fm.summary}\n\n`;
    if (fm.locations.length) body += `## Locations\n\n${fm.locations.map((s) => `- [[${nameBySlug.get(s) || s}]]`).join("\n")}\n\n`;
    if (fm.npcs.length) body += `## NPCs\n\n${fm.npcs.map((s) => `- [[${nameBySlug.get(s) || s}]]`).join("\n")}\n\n`;
    const openThreads = fm.threads.filter((t) => !t.done);
    if (openThreads.length) body += `## Outstanding Questions\n\n${openThreads.map((t) => `- [ ] ${t.text}`).join("\n")}\n\n`;

    const res = await fetch(`${api}/pages`, {
      method: "POST",
      body: JSON.stringify({ name: title, category: "event", visibility: "gm" })
    });
    const data = await res.json();
    if (!((res.ok || res.status === 409) && data.slug)) {
      setBusy(false);
      setMessage(data.error || "Could not create report.");
      return;
    }
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

  const presentCount = fm.attendees.filter((a) => a.status !== "absent").length;

  return (
    <section className="page-grid">

      {/* ─── Sidebar ─── */}
      <div className="page-sidebar">
        <label>Title<input value={fm.title} onChange={(e) => patch({ title: e.target.value })} /></label>

        <div className="mapper-grid">
          <label>Session #
            <input type="number" min={1} value={fm.number ?? ""} placeholder="—"
              onChange={(e) => patch({ number: e.target.value ? Number(e.target.value) : undefined })} />
          </label>
          <label>Status
            <select value={fm.status || ""}
              onChange={(e) => patch({ status: (e.target.value || undefined) as Frontmatter["status"] })}>
              <option value="">—</option>
              <option value="planned">Planned</option>
              <option value="played">Played</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>

        <label>Date<DatePicker value={fm.date || ""} onChange={(v) => patch({ date: v })} /></label>

        <label>Mood
          <select value={fm.mood || ""} onChange={(e) => patch({ mood: e.target.value || undefined })}>
            <option value="">—</option>
            {MOODS.map((m) => <option key={m} value={m}>{MOOD_LABEL[m]}</option>)}
          </select>
        </label>

        <label>Arc / Season
          <input value={fm.arc || ""} placeholder="e.g. Act 1 — Arrival"
            onChange={(e) => patch({ arc: e.target.value || undefined })} />
        </label>

        <div className="field-group">
          <h3>Session assets</h3>
          {fm.assets.map((a, i) => (
            <div className="tsheet-skill-row" key={i} style={{ gridTemplateColumns: "90px 1fr auto" }}>
              <input value={a.label} placeholder="Podcast"
                onChange={(e) => patch({ assets: fm.assets.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
              <input value={a.url} placeholder="https://…"
                onChange={(e) => patch({ assets: fm.assets.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
              <button type="button" className="linklike"
                onClick={() => patch({ assets: fm.assets.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <form className="inline-form" onSubmit={(e) => {
            e.preventDefault();
            if (newAssetUrl.trim()) {
              patch({ assets: [...fm.assets, { label: newAssetLabel.trim() || "Link", url: newAssetUrl.trim() }] });
              setNewAssetLabel(""); setNewAssetUrl("");
            }
          }}>
            <input value={newAssetLabel} onChange={(e) => setNewAssetLabel(e.target.value)}
              placeholder="Label" style={{ flex: "0 0 80px" }} />
            <input value={newAssetUrl} onChange={(e) => setNewAssetUrl(e.target.value)} placeholder="URL" />
            <button type="submit" className="secondary">+</button>
          </form>
        </div>

        <div className="field-group">
          <button type="button" onClick={save} disabled={busy}>Save session</button>
          <button type="button" className="secondary" onClick={toReport} disabled={busy}>Generate report</button>
          <button type="button" className="secondary danger" onClick={remove}>Delete</button>
        </div>
        {message && <p className="toast">{message}</p>}
      </div>

      {/* ─── Main ─── */}
      <div className="workspace-main">

        {/* Attendance */}
        <div className="panel">
          <h2>
            Attendance
            {fm.attendees.length > 0 && (
              <span className="tsheet-count"> · {presentCount} / {fm.attendees.length} attended</span>
            )}
          </h2>
          {fm.attendees.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "6px", marginBottom: "0.75em" }}>
              {fm.attendees.map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "4px 8px", background: "var(--input-bg, rgba(255,255,255,0.04))", borderRadius: "4px"
                }}>
                  <input type="checkbox" checked={a.status !== "absent"}
                    onChange={() => patch({ attendees: fm.attendees.map((x, j) => j === i ? { ...x, status: x.status === "absent" ? "present" : "absent" } : x) })} />
                  <span style={{
                    flex: 1, fontSize: "0.9em",
                    textDecoration: a.status === "absent" ? "line-through" : "none",
                    color: a.status === "absent" ? "var(--text-tertiary)" : "var(--text-primary)"
                  }}>{a.name}</span>
                  <select value={a.status}
                    onChange={(e) => patch({ attendees: fm.attendees.map((x, j) => j === i ? { ...x, status: e.target.value as Attendee["status"] } : x) })}
                    style={{ fontSize: "0.7em", padding: "0.15em 0.25em", width: "auto", flex: "0 0 auto" }}>
                    <option value="present">present</option>
                    <option value="late">late</option>
                    <option value="left-early">left early</option>
                    <option value="absent">absent</option>
                  </select>
                  <button type="button" className="linklike"
                    onClick={() => patch({ attendees: fm.attendees.filter((_, j) => j !== i) })}
                    style={{ fontSize: "0.8em" }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <form className="inline-form" onSubmit={(e) => {
            e.preventDefault();
            if (newAttendee.trim()) {
              patch({ attendees: [...fm.attendees, { name: newAttendee.trim(), status: "present" }] });
              setNewAttendee("");
            }
          }}>
            <input value={newAttendee} onChange={(e) => setNewAttendee(e.target.value)}
              placeholder="Add player or character…" />
            <button type="submit" className="secondary">Add</button>
          </form>
        </div>

        {/* Agenda */}
        <div className="panel">
          <h2>Agenda</h2>
          <ul className="steps" style={{ gridTemplateColumns: "1fr" }}>
            {fm.agenda.map((item, i) => (
              <li key={i} className="check">
                <input type="checkbox" checked={item.done}
                  onChange={() => patch({ agenda: fm.agenda.map((a, j) => j === i ? { ...a, done: !a.done } : a) })} />
                <span style={{
                  flex: 1,
                  textDecoration: item.done ? "line-through" : "none",
                  color: item.done ? "var(--text-tertiary)" : "var(--text-primary)"
                }}>{item.text}</span>
                <button type="button" className="linklike"
                  onClick={() => patch({ agenda: fm.agenda.filter((_, j) => j !== i) })}>remove</button>
              </li>
            ))}
            {!fm.agenda.length && <li className="muted">No planned beats yet.</li>}
          </ul>
          <form className="inline-form" onSubmit={(e) => {
            e.preventDefault();
            if (newAgenda.trim()) {
              patch({ agenda: [...fm.agenda, { text: newAgenda.trim(), done: false }] });
              setNewAgenda("");
            }
          }}>
            <input value={newAgenda} onChange={(e) => setNewAgenda(e.target.value)} placeholder="Add beat or scene…" />
            <button className="secondary">Add</button>
          </form>
        </div>

        {/* After session */}
        <div className="panel">
          <h2>After session</h2>

          <div className="field-group">
            <label style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>
              Summary
              <span className="muted" style={{ fontWeight: 400, marginLeft: "0.5em", fontSize: "0.85em" }}>
                Player-visible in generated reports
              </span>
            </label>
            <textarea value={fm.summary || ""} rows={4} placeholder="What happened this session?"
              onChange={(e) => patch({ summary: e.target.value || undefined })} />
          </div>

          <div className="field-group">
            <h3>NPCs introduced</h3>
            <div className="badges">
              {fm.npcs.map((s) => (
                <span key={s}>
                  <a href={`${base}/pages/${s}`}>{nameBySlug.get(s) || s}</a>
                  <button type="button" className="linklike"
                    onClick={() => patch({ npcs: fm.npcs.filter((x) => x !== s) })}> ✕</button>
                </span>
              ))}
              {!fm.npcs.length && <span className="muted">None yet.</span>}
            </div>
            <div className="inline-form">
              <select value={addNpc} onChange={(e) => setAddNpc(e.target.value)}>
                <option value="">Add from wiki…</option>
                {pages.filter((p) => !fm.npcs.includes(p.slug)).map((p) =>
                  <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </select>
              <button type="button" className="secondary" disabled={!addNpc}
                onClick={() => { patch({ npcs: [...fm.npcs, addNpc] }); setAddNpc(""); }}>Add</button>
            </div>
          </div>

          <div className="field-group">
            <h3>Locations visited</h3>
            <div className="badges">
              {fm.locations.map((s) => (
                <span key={s}>
                  <a href={`${base}/pages/${s}`}>{nameBySlug.get(s) || s}</a>
                  <button type="button" className="linklike"
                    onClick={() => patch({ locations: fm.locations.filter((x) => x !== s) })}> ✕</button>
                </span>
              ))}
              {!fm.locations.length && <span className="muted">None yet.</span>}
            </div>
            <div className="inline-form">
              <select value={addLoc} onChange={(e) => setAddLoc(e.target.value)}>
                <option value="">Add from wiki…</option>
                {pages.filter((p) => !fm.locations.includes(p.slug)).map((p) =>
                  <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </select>
              <button type="button" className="secondary" disabled={!addLoc}
                onClick={() => { patch({ locations: [...fm.locations, addLoc] }); setAddLoc(""); }}>Add</button>
            </div>
          </div>

          <div className="field-group">
            <h3>Loose threads</h3>
            <ul className="steps" style={{ gridTemplateColumns: "1fr" }}>
              {fm.threads.map((t, i) => (
                <li key={i} className="check">
                  <input type="checkbox" checked={t.done}
                    onChange={() => patch({ threads: fm.threads.map((x, j) => j === i ? { ...x, done: !x.done } : x) })} />
                  <span style={{
                    flex: 1,
                    textDecoration: t.done ? "line-through" : "none",
                    color: t.done ? "var(--text-tertiary)" : "var(--text-primary)"
                  }}>{t.text}</span>
                  <button type="button" className="linklike"
                    onClick={() => patch({ threads: fm.threads.filter((_, j) => j !== i) })}>remove</button>
                </li>
              ))}
              {!fm.threads.length && <li className="muted">No open threads.</li>}
            </ul>
            <form className="inline-form" onSubmit={(e) => {
              e.preventDefault();
              if (newThread.trim()) {
                patch({ threads: [...fm.threads, { text: newThread.trim(), done: false }] });
                setNewThread("");
              }
            }}>
              <input value={newThread} onChange={(e) => setNewThread(e.target.value)} placeholder="Add loose thread…" />
              <button className="secondary">Add</button>
            </form>
          </div>
        </div>

        {/* Linked pages */}
        <div className="panel">
          <h2>Linked pages</h2>
          <div className="badges">
            {fm.pinned.map((s) => (
              <span key={s}>
                <a href={`${base}/pages/${s}`}>{nameBySlug.get(s) || s}</a>
                <button type="button" className="linklike"
                  onClick={() => patch({ pinned: fm.pinned.filter((x) => x !== s) })}> ✕</button>
              </span>
            ))}
            {!fm.pinned.length && <span className="muted">No linked pages.</span>}
          </div>
          <div className="inline-form">
            <select value={addPin} onChange={(e) => setAddPin(e.target.value)}>
              <option value="">Link a page…</option>
              {pages.filter((p) => !fm.pinned.includes(p.slug)).map((p) =>
                <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
            <button type="button" className="secondary" disabled={!addPin}
              onClick={() => { patch({ pinned: [...fm.pinned, addPin] }); setAddPin(""); }}>Link</button>
          </div>
        </div>

        {/* GM notes */}
        <div className="panel">
          <h2>GM notes</h2>
          <p className="muted">Private prep + play notes (Markdown). Never shown to players.</p>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={16}
            placeholder="Scenes, encounters, secrets, beats…" />
        </div>
      </div>
    </section>
  );
}

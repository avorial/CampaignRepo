"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Campaign } from "@/lib/types";

type Session = {
  slug: string;
  frontmatter: { title: string; date?: string; status?: string; agenda: { text: string; done: boolean }[]; pinned: string[] };
};

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplay(ymd: string) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => value ? new Date(value + "T12:00:00") : today);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function select(day: number) {
    const picked = toYMD(new Date(year, month, day));
    onChange(picked);
    setOpen(false);
  }

  function prevMonth() { setView(new Date(year, month - 1, 1)); }
  function nextMonth() { setView(new Date(year, month + 1, 1)); }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "var(--input-bg, #1a1a1a)",
          border: "1px solid var(--border, #333)",
          borderRadius: "4px",
          padding: "0.45em 0.65em",
          color: value ? "var(--fg, #e0e0e0)" : "var(--muted, #666)",
          cursor: "pointer",
          fontSize: "inherit",
          fontFamily: "inherit"
        }}
      >
        {value ? formatDisplay(value) : "Pick a date (optional)"}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            position: "absolute", right: "0.5em", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "var(--muted, #666)", cursor: "pointer",
            padding: "0 0.2em", fontSize: "0.9em", lineHeight: 1
          }}
          aria-label="Clear date"
        >✕</button>
      )}
      {open && (
        <div style={{
          position: "absolute", zIndex: 100, top: "calc(100% + 4px)", left: 0,
          background: "var(--panel-bg, #111)", border: "1px solid var(--border, #333)",
          borderRadius: "6px", padding: "0.75em", minWidth: "240px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6em" }}>
            <button type="button" onClick={prevMonth} style={{ background: "none", border: "none", color: "var(--fg, #e0e0e0)", cursor: "pointer", fontSize: "1em", padding: "0 0.3em" }}>‹</button>
            <span style={{ fontWeight: 600, color: "var(--fg, #e0e0e0)", fontSize: "0.9em" }}>{MONTHS[month]} {year}</span>
            <button type="button" onClick={nextMonth} style={{ background: "none", border: "none", color: "var(--fg, #e0e0e0)", cursor: "pointer", fontSize: "1em", padding: "0 0.3em" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", textAlign: "center" }}>
            {DAYS.map((d) => (
              <div key={d} style={{ fontSize: "0.7em", color: "var(--muted, #666)", padding: "0.2em 0", fontWeight: 600 }}>{d}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />;
              const ymd = toYMD(new Date(year, month, day));
              const isSelected = ymd === value;
              const isToday = ymd === toYMD(today);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => select(day)}
                  style={{
                    background: isSelected ? "var(--accent, #7c5cfc)" : "none",
                    border: isToday && !isSelected ? "1px solid var(--accent, #7c5cfc)" : "1px solid transparent",
                    borderRadius: "4px",
                    color: isSelected ? "#fff" : "var(--fg, #e0e0e0)",
                    cursor: "pointer",
                    padding: "0.3em 0",
                    fontSize: "0.82em",
                    lineHeight: 1.4
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SessionsClient({ campaign }: { campaign: Campaign }) {
  const base = `/campaigns/${campaign.id}`;
  const api = `/api${base}`;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionDate, setSessionDate] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`${api}/sessions`);
    const data = res.ok ? await res.json() : { sessions: [] };
    setSessions(data.sessions || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("Creating session…");
    const res = await fetch(`${api}/sessions`, {
      method: "POST",
      body: JSON.stringify({ title: form.get("title"), date: sessionDate || undefined })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = `${base}/sessions/${data.session.slug}`;
    } else {
      setMessage(data.error || "Could not create session.");
    }
  }

  return (
    <section className="admin-grid">
      <div className="panel">
        <h2>New session</h2>
        <form onSubmit={create} className="stack">
          <label>Title<input name="title" required placeholder="Session 1 — The Heist" /></label>
          <label>Date<DatePicker value={sessionDate} onChange={setSessionDate} /></label>
          <button>Create session</button>
        </form>
        {message && <p className="toast">{message}</p>}
      </div>

      <div className="panel admin-wide">
        <h2>All sessions</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="muted">No sessions yet. Create your first one.</p>
        ) : (
          <div className="review-list">
            {sessions.map((s) => {
              const done = s.frontmatter.agenda.filter((a) => a.done).length;
              return (
                <article className="review-row" key={s.slug}>
                  <div>
                    <a href={`${base}/sessions/${s.slug}`}><strong>{s.frontmatter.title}</strong></a>
                    <span>
                      {[s.frontmatter.date, s.frontmatter.status].filter(Boolean).join(" · ") || "no date"}
                      {s.frontmatter.agenda.length > 0 && ` · agenda ${done}/${s.frontmatter.agenda.length}`}
                      {s.frontmatter.pinned.length > 0 && ` · ${s.frontmatter.pinned.length} pinned`}
                    </span>
                  </div>
                  <a className="button secondary" href={`${base}/sessions/${s.slug}`}>Open</a>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

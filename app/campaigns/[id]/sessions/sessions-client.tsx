"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";
import { DatePicker, formatDateDisplay } from "./date-picker";

type Attendee = { name: string; status: string };
type WorldDate = { year: number; month: number; day: number };
type CalMonth = { name: string; days: number };
type Cal = { months: CalMonth[]; weekdays: string[]; eraName?: string };
type Session = {
  slug: string;
  frontmatter: {
    title: string;
    number?: number;
    date?: string;
    worldDate?: WorldDate;
    status?: string;
    mood?: string;
    attendees?: Attendee[];
    agenda: { text: string; done: boolean }[];
  };
};

function fmtWorldDate(cal: Cal, d: WorldDate): string {
  const monthName = cal.months[Math.max(0, d.month - 1)]?.name ?? `Month ${d.month}`;
  return `${d.day} ${monthName}, ${d.year}${cal.eraName ? ` ${cal.eraName}` : ""}`;
}

const MOOD_LABEL: Record<string, string> = {
  investigation: "Investigation", combat: "Combat", political: "Political",
  travel: "Travel", mystery: "Mystery", downtime: "Downtime",
  horror: "Horror", social: "Social", heist: "Heist"
};

export default function SessionsClient({ campaign }: { campaign: Campaign }) {
  const base = `/campaigns/${campaign.id}`;
  const api = `/api${base}`;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [calendar, setCalendar] = useState<Cal | null>(null);

  async function load() {
    setLoading(true);
    const [res, calRes] = await Promise.all([fetch(`${api}/sessions`), fetch(`${api}/calendar`)]);
    const data = res.ok ? await res.json() : { sessions: [] };
    setSessions(data.sessions || []);
    if (calRes.ok) { const d = await calRes.json(); if (d.calendar) setCalendar(d.calendar); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("Creating session…");
    const res = await fetch(`${api}/sessions`, {
      method: "POST",
      body: JSON.stringify({ title: form.get("title"), date: sessionDate || undefined })
    });
    const data = await res.json();
    if (res.ok) window.location.href = `${base}/sessions/${data.session.slug}`;
    else setMessage(data.error || "Could not create session.");
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
              const attendees = s.frontmatter.attendees || [];
              const present = attendees.filter((a) => a.status !== "absent").length;
              const agendaDone = s.frontmatter.agenda.filter((a) => a.done).length;
              const title = s.frontmatter.number ? `${s.frontmatter.number}. ${s.frontmatter.title}` : s.frontmatter.title;
              const worldDateStr = s.frontmatter.worldDate && calendar
                ? fmtWorldDate(calendar, s.frontmatter.worldDate) : null;
              const meta = [
                s.frontmatter.date ? formatDateDisplay(s.frontmatter.date) : null,
                worldDateStr ? `⟨${worldDateStr}⟩` : null,
                s.frontmatter.status,
                s.frontmatter.mood ? MOOD_LABEL[s.frontmatter.mood] || s.frontmatter.mood : null,
                attendees.length > 0 ? `${present}/${attendees.length} attended` : null,
                s.frontmatter.agenda.length > 0 ? `agenda ${agendaDone}/${s.frontmatter.agenda.length}` : null
              ].filter(Boolean).join(" · ");
              return (
                <article className="review-row" key={s.slug}>
                  <div>
                    <a href={`${base}/sessions/${s.slug}`}><strong>{title}</strong></a>
                    <span>{meta || "no date"}</span>
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

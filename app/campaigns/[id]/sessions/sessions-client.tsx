"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";

type Session = {
  slug: string;
  frontmatter: { title: string; date?: string; status?: string; agenda: { text: string; done: boolean }[]; pinned: string[] };
};

export default function SessionsClient({ campaign }: { campaign: Campaign }) {
  const base = `/campaigns/${campaign.id}`;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`${base}/sessions`);
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
    const res = await fetch(`${base}/sessions`, {
      method: "POST",
      body: JSON.stringify({ title: form.get("title"), date: form.get("date") })
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
          <label>Date<input name="date" type="date" /></label>
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

"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";

type Objective = { text: string; done: boolean };
type Quest = {
  slug: string;
  frontmatter: { title: string; status: string; arc?: string; reward?: string; visibility: string; objectives: Objective[]; participants: string[]; locations: string[] };
};

const STATUS_ORDER = ["active", "hook", "completed", "failed"];
const STATUS_LABEL: Record<string, string> = { active: "Active", hook: "Hooks", completed: "Completed", failed: "Failed" };

export default function QuestsClient({ campaign }: { campaign: Campaign }) {
  const base = `/campaigns/${campaign.id}`;
  const api = `/api${base}`;
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`${api}/quests`);
    const data = res.ok ? await res.json() : { quests: [] };
    setQuests(data.quests || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("Creating quest…");
    const res = await fetch(`${api}/quests`, { method: "POST", body: JSON.stringify({ title: form.get("title") }) });
    const data = await res.json();
    if (res.ok) window.location.href = `${base}/quests/${data.quest.slug}`;
    else setMessage(data.error || "Could not create quest.");
  }

  return (
    <section className="admin-grid">
      <div className="panel">
        <h2>New quest</h2>
        <form onSubmit={create} className="stack">
          <label>Title<input name="title" required placeholder="Recover the missing ledger" /></label>
          <button>Create quest</button>
        </form>
        {message && <p className="toast">{message}</p>}
      </div>

      <div className="panel admin-wide">
        <h2>All quests</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : quests.length === 0 ? (
          <p className="muted">No quests yet.</p>
        ) : (
          STATUS_ORDER.filter((s) => quests.some((q) => q.frontmatter.status === s)).map((status) => (
            <div className="band" key={status} style={{ paddingTop: 8 }}>
              <h3>{STATUS_LABEL[status] || status}</h3>
              <div className="review-list">
                {quests.filter((q) => q.frontmatter.status === status).map((q) => {
                  const done = q.frontmatter.objectives.filter((o) => o.done).length;
                  return (
                    <article className="review-row" key={q.slug}>
                      <div>
                        <a href={`${base}/quests/${q.slug}`}><strong>{q.frontmatter.title}</strong></a>
                        <span>
                          {[q.frontmatter.arc, q.frontmatter.visibility === "players" ? "players" : "gm"].filter(Boolean).join(" · ")}
                          {q.frontmatter.objectives.length > 0 && ` · ${done}/${q.frontmatter.objectives.length} objectives`}
                          {q.frontmatter.reward && ` · ${q.frontmatter.reward}`}
                        </span>
                      </div>
                      <a className="button secondary" href={`${base}/quests/${q.slug}`}>Open</a>
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

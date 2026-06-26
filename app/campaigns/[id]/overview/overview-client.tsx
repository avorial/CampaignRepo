"use client";

import { useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";

// Client-safe widget metadata (mirrors lib/dashboard.WIDGETS without its
// server-only imports). gmOnly widgets never render in the player view.
type WidgetId = "calendar" | "counts" | "timeline" | "quicklinks" | "quests" | "review" | "health" | "activity";
const WIDGETS: { id: WidgetId; label: string; gmOnly: boolean }[] = [
  { id: "calendar", label: "Current date", gmOnly: false },
  { id: "counts", label: "Page counts", gmOnly: false },
  { id: "timeline", label: "Timeline", gmOnly: false },
  { id: "quicklinks", label: "Quick links", gmOnly: false },
  { id: "quests", label: "Active quests", gmOnly: true },
  { id: "review", label: "Review queue", gmOnly: true },
  { id: "health", label: "Campaign health", gmOnly: true },
  { id: "activity", label: "Recent activity", gmOnly: true }
];
const labelOf = (id: WidgetId) => WIDGETS.find((w) => w.id === id)?.label || id;
const gmOnly = (id: WidgetId) => WIDGETS.find((w) => w.id === id)?.gmOnly ?? false;

export default function OverviewClient({ campaign, canManage }: { campaign: Campaign; canManage: boolean }) {
  const base = `/campaigns/${campaign.id}`;
  const api = `/api${base}`;
  const [widgets, setWidgets] = useState<WidgetId[]>([]);
  const [draft, setDraft] = useState<WidgetId[] | null>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const cfg = await fetch(`${api}/dashboard`).then((r) => (r.ok ? r.json() : { dashboard: { widgets: [] } }));
    setWidgets(cfg.dashboard?.widgets || []);

    const reqs: Record<string, Promise<any>> = {
      pages: fetch(`${api}/pages`).then((r) => (r.ok ? r.json() : { pages: [] })),
      graph: fetch(`${api}/graph`).then((r) => (r.ok ? r.json() : { timeline: [] })),
      calendar: fetch(`${api}/calendar`).then((r) => (r.ok ? r.json() : null))
    };
    if (canManage) {
      reqs.reviews = fetch(`${api}/admin/reviews`).then((r) => (r.ok ? r.json() : { reviews: [] }));
      reqs.health = fetch(`${api}/health`).then((r) => (r.ok ? r.json() : { findings: [], counts: {} }));
      reqs.quests = fetch(`${api}/quests`).then((r) => (r.ok ? r.json() : { quests: [] }));
      reqs.activity = fetch(`${api}/activity`).then((r) => (r.ok ? r.json() : []));
    }
    const entries = await Promise.all(Object.entries(reqs).map(async ([k, p]) => [k, await p.catch(() => null)] as const));
    setData(Object.fromEntries(entries));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const visible = widgets.filter((id) => canManage || !gmOnly(id));

  async function saveLayout() {
    if (!draft) return;
    setMessage("Saving layout…");
    const res = await fetch(`${api}/dashboard`, { method: "PUT", body: JSON.stringify({ dashboard: { widgets: draft } }) });
    const out = await res.json();
    if (res.ok) {
      setWidgets(out.dashboard.widgets);
      setDraft(null);
      setMessage("Layout saved to campaign.yaml.");
    } else {
      setMessage(out.error || "Could not save layout.");
    }
  }

  function toggle(id: WidgetId) {
    setDraft((d) => {
      const list = d || widgets;
      return list.includes(id) ? list.filter((w) => w !== id) : [...list, id];
    });
  }
  function move(id: WidgetId, dir: -1 | 1) {
    setDraft((d) => {
      const list = [...(d || widgets)];
      const i = list.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j], list[i]];
      return list;
    });
  }

  return (
    <section className="overview">
      {canManage && (
        <div className="overview-controls">
          {draft ? (
            <>
              <button type="button" onClick={saveLayout}>Save layout</button>
              <button type="button" className="secondary" onClick={() => setDraft(null)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="secondary" onClick={() => setDraft(widgets)}>Edit layout</button>
          )}
        </div>
      )}

      {draft && (
        <div className="panel overview-editor">
          <h2>Widgets</h2>
          <p className="muted">Toggle widgets and reorder them. GM-only widgets are hidden from players.</p>
          <div className="widget-config">
            {WIDGETS.map((w) => {
              const on = draft.includes(w.id);
              return (
                <div className="widget-config-row" key={w.id}>
                  <label className="check"><input type="checkbox" checked={on} onChange={() => toggle(w.id)} /> {w.label}</label>
                  {w.gmOnly && <span className="badges"><span>GM only</span></span>}
                  {on && (
                    <span className="member-actions">
                      <button type="button" className="secondary" onClick={() => move(w.id, -1)}>↑</button>
                      <button type="button" className="secondary" onClick={() => move(w.id, 1)}>↓</button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading overview…</p>
      ) : visible.length === 0 ? (
        <p className="muted">No widgets enabled{canManage ? " — use Edit layout to add some." : "."}</p>
      ) : (
        <div className="overview-grid">
          {visible.map((id) => (
            <Widget key={id} id={id} base={base} data={data} canManage={canManage} />
          ))}
        </div>
      )}
      {message && <p className="toast">{message}</p>}
    </section>
  );
}

function Widget({ id, base, data, canManage }: { id: WidgetId; base: string; data: Record<string, any>; canManage: boolean }) {
  return (
    <div className="panel overview-widget">
      <h2>{labelOf(id)}</h2>
      {id === "calendar" && <CalendarWidget data={data.calendar} base={base} />}
      {id === "counts" && <Counts pages={data.pages?.pages || []} />}
      {id === "timeline" && <Timeline items={data.graph?.timeline || []} base={base} />}
      {id === "quicklinks" && <QuickLinks base={base} canManage={canManage} />}
      {id === "quests" && <Quests quests={data.quests?.quests || []} base={base} />}
      {id === "review" && <Reviews reviews={data.reviews?.reviews || []} base={base} />}
      {id === "health" && <HealthSummary health={data.health} base={base} />}
      {id === "activity" && <ActivityFeed commits={Array.isArray(data.activity) ? data.activity : []} />}
    </div>
  );
}

function CalendarWidget({ data, base }: { data: any; base: string }) {
  if (!data?.formatted) return <p className="muted">No calendar set. <a href={`${base}/calendar`}>Set it up</a></p>;
  return <p className="tsheet-credits" style={{ margin: 0, fontSize: "var(--text-lg)" }}>{data.formatted}</p>;
}

function Counts({ pages }: { pages: any[] }) {
  const by = new Map<string, number>();
  for (const p of pages) by.set(p.frontmatter.category, (by.get(p.frontmatter.category) || 0) + 1);
  const rows = [...by.entries()].sort((a, b) => b[1] - a[1]);
  if (!pages.length) return <p className="muted">No pages yet.</p>;
  return (
    <ul className="overview-stats">
      <li><strong>{pages.length}</strong> pages total</li>
      {rows.map(([cat, n]) => <li key={cat}><strong>{n}</strong> {cat}</li>)}
    </ul>
  );
}

function Timeline({ items, base }: { items: any[]; base: string }) {
  if (!items.length) return <p className="muted">No timeline events.</p>;
  return (
    <div className="results">
      {items.slice(0, 6).map((e) => (
        <a key={e.slug} href={`${base}/pages/${e.slug}`}>
          <strong>{e.name}</strong>
          <span>{[e.eventDate || e.era, e.track].filter(Boolean).join(" · ") || "event"}</span>
        </a>
      ))}
    </div>
  );
}

function QuickLinks({ base, canManage }: { base: string; canManage: boolean }) {
  return (
    <div className="topbar-actions">
      {canManage ? (
        <>
          <a className="button secondary" href={base}>Pages</a>
          <a className="button secondary" href={`${base}/organize`}>Organize</a>
          <a className="button secondary" href={`${base}/health`}>Health</a>
          <a className="button secondary" href={`${base}/maps`}>Maps</a>
          <a className="button secondary" href={`${base}/admin`}>Admin</a>
        </>
      ) : (
        <a className="button secondary" href={`${base}/player`}>Player portal</a>
      )}
    </div>
  );
}

function Quests({ quests, base }: { quests: any[]; base: string }) {
  const active = quests.filter((q) => q.frontmatter.status === "active");
  if (!active.length) return <p className="muted">No active quests. <a href={`${base}/quests`}>Open quests</a></p>;
  return (
    <div className="results">
      {active.slice(0, 6).map((q) => {
        const done = q.frontmatter.objectives.filter((o: any) => o.done).length;
        return (
          <a key={q.slug} href={`${base}/quests/${q.slug}`}>
            <strong>{q.frontmatter.title}</strong>
            <span>{[q.frontmatter.arc, q.frontmatter.objectives.length ? `${done}/${q.frontmatter.objectives.length}` : null].filter(Boolean).join(" · ") || "active"}</span>
          </a>
        );
      })}
    </div>
  );
}

function Reviews({ reviews, base }: { reviews: any[]; base: string }) {
  if (!reviews.length) return <p className="muted">Nothing waiting for review. ✓</p>;
  return (
    <>
      <p className="muted">{reviews.length} page{reviews.length === 1 ? "" : "s"} awaiting approval. <a href={`${base}/admin`}>Open queue</a></p>
      <div className="results">
        {reviews.slice(0, 5).map((r) => (
          <a key={r.slug} href={`${base}/pages/${r.slug}`}><strong>{r.name}</strong><span>{r.category} · {r.approvalStatus}</span></a>
        ))}
      </div>
    </>
  );
}

function HealthSummary({ health, base }: { health: any; base: string }) {
  if (!health) return <p className="muted">Health data unavailable.</p>;
  const total = (health.findings || []).length;
  if (total === 0) return <p className="health-clean">✓ No issues found.</p>;
  const counts = health.counts || {};
  return (
    <>
      <p className="muted">{total} finding{total === 1 ? "" : "s"}. <a href={`${base}/health`}>Open health</a></p>
      <ul className="overview-stats">
        {Object.entries(counts).map(([type, n]) => <li key={type}><strong>{n as number}</strong> {type.replace(/-/g, " ")}</li>)}
      </ul>
    </>
  );
}

function ActivityFeed({ commits }: { commits: { sha: string; url: string; message: string; author: string; date: string }[] }) {
  if (!commits.length) return <p className="muted">No recent activity.</p>;
  return (
    <div className="activity-feed">
      {commits.slice(0, 15).map((c) => (
        <div className="activity-commit" key={c.sha}>
          <div>
            <div className="activity-commit-meta">{new Date(c.date).toLocaleDateString()} · {c.author}</div>
            <a href={c.url} target="_blank" rel="noreferrer" className="activity-commit-msg">{c.message}</a>
          </div>
          <span className="activity-sha">{c.sha.slice(0, 7)}</span>
        </div>
      ))}
    </div>
  );
}

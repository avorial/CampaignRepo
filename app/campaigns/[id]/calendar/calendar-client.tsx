"use client";

import { useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";

type Month = { name: string; days: number };
type WorldDate = { year: number; month: number; day: number };
type Holiday = { name: string; month: number; day: number };
type Calendar = { months: Month[]; weekdays: string[]; eraName?: string; currentDate: WorldDate; holidays?: Holiday[] };
type WorldEvent = { slug: string; title: string; worldDate: WorldDate; kind: "session" | "event" | "quest" | "holiday" | "born"; href: string; recurring?: boolean };

// Pure date helpers (mirror lib/calendar; kept here so the client bundle stays
// free of the server-only campaign.yaml loaders).
const daysInYear = (c: Calendar) => c.months.reduce((s, m) => s + Math.max(1, m.days), 0);
function toAbs(c: Calendar, d: WorldDate) {
  let days = (d.year - 1) * daysInYear(c);
  for (let i = 0; i < d.month - 1 && i < c.months.length; i++) days += c.months[i].days;
  return days + (d.day - 1);
}
function fromAbs(c: Calendar, abs: number): WorldDate {
  const yd = daysInYear(c);
  const a = Math.max(0, abs);
  const year = Math.floor(a / yd) + 1;
  let rem = a % yd;
  let month = 1;
  for (const m of c.months) { if (rem < m.days) break; rem -= m.days; month++; }
  return { year, month: Math.min(month, c.months.length), day: rem + 1 };
}
const addDays = (c: Calendar, d: WorldDate, n: number) => fromAbs(c, toAbs(c, d) + n);
function format(c: Calendar, d: WorldDate) {
  const idx = ((toAbs(c, d) % c.weekdays.length) + c.weekdays.length) % c.weekdays.length;
  const m = c.months[Math.min(c.months.length, Math.max(1, d.month)) - 1];
  return `${c.weekdays[idx]}, ${d.day} ${m?.name || ""}, ${d.year}${c.eraName ? ` ${c.eraName}` : ""}`;
}
function shortDate(c: Calendar, d: WorldDate) {
  const m = c.months[Math.min(c.months.length, Math.max(1, d.month)) - 1];
  return `${d.day} ${m?.name || ""} ${d.year}${c.eraName ? ` ${c.eraName}` : ""}`;
}

export default function CalendarClient({ campaign }: { campaign: Campaign }) {
  const base = `/campaigns/${campaign.id}`;
  const api = `/api${base}`;
  const [cal, setCal] = useState<Calendar | null>(null);
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${api}/calendar`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setCal(d.calendar)).catch(() => setMessage("Could not load calendar."));
    // Fetch sessions, event pages, and quests for the world timeline
    Promise.all([
      fetch(`${api}/sessions`).then((r) => r.ok ? r.json() : { sessions: [] }).catch(() => ({ sessions: [] })),
      fetch(`${api}/pages`).then((r) => r.ok ? r.json() : { pages: [] }).catch(() => ({ pages: [] })),
      fetch(`${api}/quests`).then((r) => r.ok ? r.json() : { quests: [] }).catch(() => ({ quests: [] })),
    ]).then(([sessData, pageData, questData]) => {
      const evts: WorldEvent[] = [];
      for (const s of (sessData.sessions || [])) {
        if (s.frontmatter?.worldDate) {
          evts.push({ slug: s.slug, title: s.frontmatter.title || s.slug, worldDate: s.frontmatter.worldDate, kind: "session", href: `${base}/sessions/${s.slug}` });
        }
      }
      for (const p of (pageData.pages || [])) {
        if (p.frontmatter?.worldDate) {
          evts.push({ slug: p.slug, title: p.frontmatter.name || p.slug, worldDate: p.frontmatter.worldDate, kind: "event", href: `${base}/pages/${p.slug}` });
        }
        if (p.frontmatter?.birthdate) {
          evts.push({ slug: `born-${p.slug}`, title: p.frontmatter.name || p.slug, worldDate: p.frontmatter.birthdate, kind: "born", href: `${base}/pages/${p.slug}` });
        }
      }
      for (const q of (questData.quests || [])) {
        if (q.frontmatter?.worldDate) {
          evts.push({ slug: q.slug, title: q.frontmatter.title || q.slug, worldDate: q.frontmatter.worldDate, kind: "quest", href: `${base}/quests/${q.slug}` });
        }
      }
      setEvents(evts);
    });
    // Holidays are injected from cal after cal loads — handled in the derived `allEvents` below.
  }, []);

  if (!cal) return <p className="muted">{message || "Loading calendar…"}</p>;
  const patch = (p: Partial<Calendar>) => setCal({ ...cal, ...p });
  const setDate = (d: WorldDate) => patch({ currentDate: clamp(d) });
  function clamp(d: WorldDate): WorldDate {
    const month = Math.min(cal!.months.length, Math.max(1, d.month));
    return { year: Math.max(1, d.year), month, day: Math.min(cal!.months[month - 1].days, Math.max(1, d.day)) };
  }
  const monthLen = cal.months[cal.currentDate.month - 1]?.days || 30;

  // Project holidays into current year ±1 for the timeline
  const holidayEvents: WorldEvent[] = (cal.holidays || []).flatMap((h) => {
    const y = cal.currentDate.year;
    return [y - 1, y, y + 1].map((year) => ({
      slug: `holiday-${h.name}-${year}`,
      title: h.name,
      worldDate: { year, month: h.month, day: h.day },
      kind: "holiday" as const,
      href: "",
      recurring: true
    }));
  });
  const allEvents = [...events, ...holidayEvents];

  async function save() {
    setBusy(true);
    setMessage("Saving…");
    const res = await fetch(`${api}/calendar`, { method: "PUT", body: JSON.stringify({ calendar: cal }) });
    const data = await res.json();
    setBusy(false);
    if (res.ok) { setCal(data.calendar); setMessage("Calendar saved to campaign.yaml."); }
    else setMessage(data.error || "Save failed.");
  }

  return (
    <section className="page-grid">
      <div className="page-sidebar">
        <div className="field-group">
          <h3>Current date</h3>
          <p className="tsheet-credits" style={{ margin: "0 0 8px" }}>{format(cal, cal.currentDate)}</p>
          <div className="mapper-grid">
            <label>Year<input type="number" min={1} value={cal.currentDate.year} onChange={(e) => setDate({ ...cal.currentDate, year: Number(e.target.value) })} /></label>
            <label>Day<input type="number" min={1} max={monthLen} value={cal.currentDate.day} onChange={(e) => setDate({ ...cal.currentDate, day: Number(e.target.value) })} /></label>
          </div>
          <label>Month
            <select value={cal.currentDate.month} onChange={(e) => setDate({ ...cal.currentDate, month: Number(e.target.value) })}>
              {cal.months.map((m, i) => <option key={i} value={i + 1}>{m.name}</option>)}
            </select>
          </label>
          <div className="badges">
            <button type="button" className="secondary" onClick={() => setDate(addDays(cal, cal.currentDate, -1))}>−1 day</button>
            <button type="button" className="secondary" onClick={() => setDate(addDays(cal, cal.currentDate, 1))}>+1 day</button>
            <button type="button" className="secondary" onClick={() => setDate(addDays(cal, cal.currentDate, cal.weekdays.length))}>+1 week</button>
            <button type="button" className="secondary" onClick={() => setDate(addDays(cal, cal.currentDate, monthLen))}>+1 month</button>
          </div>
        </div>

        <div className="field-group">
          <label>Era / suffix<input value={cal.eraName || ""} onChange={(e) => patch({ eraName: e.target.value })} placeholder="AR, Imperial, AC…" /></label>
          <label>Weekdays (comma-separated)
            <input value={cal.weekdays.join(", ")} onChange={(e) => patch({ weekdays: e.target.value.split(",").map((w) => w.trim()).filter(Boolean) })} />
          </label>
        </div>

        <div className="field-group">
          <button type="button" onClick={save} disabled={busy}>Save calendar</button>
        </div>
        {message && <p className="toast">{message}</p>}
      </div>

      <div className="workspace-main">
        <div className="panel">
          <h2>Months <span className="tsheet-count">{cal.months.length} · {daysInYear(cal)} days/year</span></h2>
          {cal.months.map((m, i) => (
            <div className="tsheet-skill-row" key={i} style={{ gridTemplateColumns: "minmax(0,1fr) 80px auto" }}>
              <input value={m.name} onChange={(e) => patch({ months: cal.months.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <input type="number" min={1} value={m.days} onChange={(e) => patch({ months: cal.months.map((x, j) => (j === i ? { ...x, days: Number(e.target.value) || 1 } : x)) })} />
              <button type="button" className="linklike" onClick={() => patch({ months: cal.months.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => patch({ months: [...cal.months, { name: `Month ${cal.months.length + 1}`, days: 30 }] })}>Add month</button>
        </div>

        <div className="panel">
          <h2>Holidays <span className="tsheet-count">{(cal.holidays || []).length}</span></h2>
          <p className="muted" style={{ marginBottom: "8px" }}>Named recurring days — festivals, solstices, holy days. Appear on the world timeline every year.</p>
          {(cal.holidays || []).map((h, i) => (
            <div className="tsheet-skill-row" key={i} style={{ gridTemplateColumns: "minmax(0,1fr) 100px 100px auto" }}>
              <input value={h.name} placeholder="Holiday name…" onChange={(e) => patch({ holidays: (cal.holidays || []).map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
              <select value={h.month} onChange={(e) => { const month = Number(e.target.value); const maxDay = cal.months[month - 1]?.days || 30; patch({ holidays: (cal.holidays || []).map((x, j) => j === i ? { ...x, month, day: Math.min(x.day, maxDay) } : x) }); }}>
                {cal.months.map((m, mi) => <option key={mi} value={mi + 1}>{m.name}</option>)}
              </select>
              <input type="number" min={1} max={cal.months[h.month - 1]?.days || 30} value={h.day} onChange={(e) => patch({ holidays: (cal.holidays || []).map((x, j) => j === i ? { ...x, day: Number(e.target.value) || 1 } : x) })} />
              <button type="button" className="linklike" onClick={() => patch({ holidays: (cal.holidays || []).filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => patch({ holidays: [...(cal.holidays || []), { name: "New holiday", month: 1, day: 1 }] })}>Add holiday</button>
        </div>

        {allEvents.length > 0 && <WorldTimeline cal={cal} events={allEvents} />}
      </div>
    </section>
  );
}

function WorldTimeline({ cal, events }: { cal: Calendar; events: WorldEvent[] }) {
  const nowAbs = toAbs(cal, cal.currentDate);
  const sorted = [...events].sort((a, b) => toAbs(cal, a.worldDate) - toAbs(cal, b.worldDate));
  const past = sorted.filter((e) => toAbs(cal, e.worldDate) < nowAbs);
  const future = sorted.filter((e) => toAbs(cal, e.worldDate) >= nowAbs);

  const nonHolidayCount = events.filter((e) => e.kind !== "holiday").length;
  const holidayCount = cal.holidays?.length ?? 0;
  const totalCount = nonHolidayCount + holidayCount;

  const yd = daysInYear(cal);
  const renderItem = (e: WorldEvent) => {
    const inner = e.recurring ? <span>{e.title} <span className="muted" style={{ fontSize: "11px" }}>↺ yearly</span></span> : (e.href ? <a href={e.href}>{e.title}</a> : <span>{e.title}</span>);
    const ageSuffix = e.kind === "born" ? (() => {
      const diff = nowAbs - toAbs(cal, e.worldDate);
      if (diff < 0) return null;
      const age = Math.floor(diff / yd);
      return <span className="muted" style={{ fontSize: "11px" }}> · age {age}</span>;
    })() : null;
    return (
      <li key={e.slug} className="world-timeline-item">
        <span className={`badge badge-${e.kind}`}>{e.kind === "born" ? "born" : e.kind}</span>
        {inner}{ageSuffix}
        <span className="muted">{shortDate(cal, e.worldDate)}</span>
      </li>
    );
  };

  return (
    <div className="panel">
      <h2>World timeline <span className="tsheet-count">{totalCount}</span></h2>
      <p className="muted" style={{ marginBottom: "12px" }}>Sessions, quests, event pages, and holidays sorted chronologically.</p>
      {past.length > 0 && (
        <>
          <h3 className="timeline-section-label">Past</h3>
          <ul className="world-timeline-list">
            {past.map(renderItem)}
          </ul>
        </>
      )}
      <div className="world-timeline-now">
        <span>Now: {shortDate(cal, cal.currentDate)}</span>
      </div>
      {future.length > 0 && (
        <>
          <h3 className="timeline-section-label">Upcoming</h3>
          <ul className="world-timeline-list">
            {future.map(renderItem)}
          </ul>
        </>
      )}
    </div>
  );
}

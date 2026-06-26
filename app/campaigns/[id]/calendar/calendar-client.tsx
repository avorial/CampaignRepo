"use client";

import { useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";

type Month = { name: string; days: number };
type WorldDate = { year: number; month: number; day: number };
type Calendar = { months: Month[]; weekdays: string[]; eraName?: string; currentDate: WorldDate };

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

export default function CalendarClient({ campaign }: { campaign: Campaign }) {
  const base = `/campaigns/${campaign.id}`;
  const api = `/api${base}`;
  const [cal, setCal] = useState<Calendar | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${api}/calendar`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setCal(d.calendar)).catch(() => setMessage("Could not load calendar."));
  }, []);

  if (!cal) return <p className="muted">{message || "Loading calendar…"}</p>;
  const patch = (p: Partial<Calendar>) => setCal({ ...cal, ...p });
  const setDate = (d: WorldDate) => patch({ currentDate: clamp(d) });
  function clamp(d: WorldDate): WorldDate {
    const month = Math.min(cal!.months.length, Math.max(1, d.month));
    return { year: Math.max(1, d.year), month, day: Math.min(cal!.months[month - 1].days, Math.max(1, d.day)) };
  }
  const monthLen = cal.months[cal.currentDate.month - 1]?.days || 30;

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
      </div>
    </section>
  );
}

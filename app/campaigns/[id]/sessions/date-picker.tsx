"use client";

import { useEffect, useRef, useState } from "react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateDisplay(ymd: string) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function DatePicker({ value, onChange, placeholder = "Pick a date (optional)" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
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
    onChange(toYMD(new Date(year, month, day)));
    setOpen(false);
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", textAlign: "left",
          background: "var(--input-bg, #1a1a1a)", border: "1px solid var(--border, #333)",
          borderRadius: "4px", padding: "0.45em 0.65em",
          color: value ? "var(--fg, #e0e0e0)" : "var(--muted, #666)",
          cursor: "pointer", fontSize: "inherit", fontFamily: "inherit"
        }}
      >
        {value ? formatDateDisplay(value) : placeholder}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          style={{
            position: "absolute", right: "0.5em", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", color: "var(--muted, #666)",
            cursor: "pointer", padding: "0 0.2em", fontSize: "0.9em", lineHeight: 1
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
            <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} style={{ background: "none", border: "none", color: "var(--fg, #e0e0e0)", cursor: "pointer", fontSize: "1em", padding: "0 0.3em" }}>‹</button>
            <span style={{ fontWeight: 600, color: "var(--fg, #e0e0e0)", fontSize: "0.9em" }}>{MONTHS[month]} {year}</span>
            <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} style={{ background: "none", border: "none", color: "var(--fg, #e0e0e0)", cursor: "pointer", fontSize: "1em", padding: "0 0.3em" }}>›</button>
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
                <button key={day} type="button" onClick={() => select(day)} style={{
                  background: isSelected ? "var(--accent, #7c5cfc)" : "none",
                  border: isToday && !isSelected ? "1px solid var(--accent, #7c5cfc)" : "1px solid transparent",
                  borderRadius: "4px", color: isSelected ? "#fff" : "var(--fg, #e0e0e0)",
                  cursor: "pointer", padding: "0.3em 0", fontSize: "0.82em", lineHeight: 1.4
                }}>
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

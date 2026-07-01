"use client";

import { useState, useEffect, useCallback } from "react";
import type { TravellerSheet as Sheet } from "@/lib/types";

const CHARS: { key: keyof Sheet["characteristics"]; label: string }[] = [
  { key: "STR", label: "Strength" },
  { key: "DEX", label: "Dexterity" },
  { key: "END", label: "Endurance" },
  { key: "INT", label: "Intellect" },
  { key: "EDU", label: "Education" },
  { key: "SOC", label: "Social Standing" }
];

/** Mongoose Traveller 2e characteristic DM. */
export function travellerDM(value: number): number {
  if (value <= 0) return -3;
  if (value <= 2) return -2;
  if (value <= 5) return -1;
  if (value <= 8) return 0;
  if (value <= 11) return 1;
  if (value <= 14) return 2;
  return 3;
}

const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const isFilled = (value: unknown) => value !== undefined && value !== null && value !== "";

function splitColumns<T>(items: T[], count: number) {
  const size = Math.ceil(items.length / count);
  return Array.from({ length: count }, (_, index) => items.slice(index * size, (index + 1) * size));
}

function detail(parts: unknown[]) {
  return parts.filter(isFilled).join(" - ");
}

type Roll = { label: string; d1: number; d2: number; mod: number; total: number };

function DiceToast({ roll, onDismiss }: { roll: Roll; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [roll, onDismiss]);

  const modStr = roll.mod === 0 ? "" : roll.mod > 0 ? ` + ${roll.mod}` : ` − ${Math.abs(roll.mod)}`;
  return (
    <div className="dice-toast" onClick={onDismiss} role="status">
      <span className="dice-toast-label">{roll.label}</span>
      <span className="dice-toast-sum">{roll.d1} + {roll.d2}{modStr} = <strong>{roll.total}</strong></span>
      <span className="dice-toast-dice">⚄ {roll.d1} · ⚄ {roll.d2}</span>
    </div>
  );
}

export default function TravellerSheet({ sheet, name }: { sheet: Sheet; name?: string }) {
  const [roll, setRoll] = useState<Roll | null>(null);
  const dismiss = useCallback(() => setRoll(null), []);

  function doRoll(label: string, mod: number) {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setRoll({ label, d1, d2, mod, total: d1 + d2 + mod });
  }

  const skills = [...(sheet.skills || [])].sort((a, b) => a.name.localeCompare(b.name) || (a.speciality || "").localeCompare(b.speciality || ""));
  const skillColumns = splitColumns(skills, 3);
  const dossier = sheet.dossier || detail([sheet.career, sheet.rank]) || "-";
  const status = sheet.status || "-";
  const weapons = sheet.weapons || [];
  const armour = sheet.armour || [];
  const equipment = sheet.equipment || [];
  const holdings = sheet.holdings || [];
  const contacts = sheet.contacts || [];
  const psionics = sheet.psionics || [];
  const header = sheet.header || ["", "", ""];
  const portrait = sheet.portrait
    ? (/^https?:\/\//i.test(sheet.portrait) || sheet.portrait.startsWith("/") ? sheet.portrait : `/wiki/media/${sheet.portrait}`)
    : "";

  return (
    <section className="tsheet">
      {roll && <DiceToast roll={roll} onDismiss={dismiss} />}

      <header className="tsheet-registry">
        {header.map((part, index) => <span key={index}>{part}</span>)}
      </header>

      <div className="tsheet-dossier">
        <div className="tsheet-upload">
          {portrait ? <img src={portrait} alt={name || "Traveller portrait"} loading="lazy" /> : (
            <>
              <strong>{sheet.rank || sheet.career ? String((sheet.rank || sheet.career || "").charAt(0)).toUpperCase() : "-"}</strong>
              <span>Upload</span>
            </>
          )}
        </div>
        <div className="tsheet-identity">
          <strong className="tsheet-name">{name || "Unnamed Traveller"}</strong>
          <div className="tsheet-facts">
            <span><b>Race / Species</b>{sheet.species || "-"}</span>
            <span><b>Age (Years)</b>{sheet.age ?? "-"}</span>
            <span><b>Homeworld</b>{sheet.homeworld || "-"}</span>
            <span><b>Dossier</b>{dossier}</span>
          </div>
        </div>
      </div>

      <section className="tsheet-panel">
        <h4>Characteristics <span>Click a value to roll 2D6 + that DM</span></h4>
        <div className="tsheet-chars">
          {CHARS.map(({ key, label }) => {
            const value = sheet.characteristics?.[key];
            const dm = value == null ? null : travellerDM(value);
            return (
              <div
                className={`tsheet-char${value != null ? " tsheet-char-rollable" : ""}`}
                key={key}
                onClick={value != null && dm != null ? () => doRoll(`${key} (${label})`, dm) : undefined}
                title={value != null ? `Roll 2D6 ${fmtMod(dm!)} for ${label}` : undefined}
              >
                <span className="tsheet-char-key">{key}</span>
                <span className="tsheet-char-label">{label}</span>
                <span className="tsheet-char-val">{value ?? "-"}</span>
                <span className="tsheet-char-mod">{value == null ? "Mod -" : `Mod ${fmtMod(travellerDM(value))}`}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="tsheet-panel tsheet-band">
        <h4>Status & Conditions <span>Wound status + active conditions</span></h4>
        <strong className="tsheet-status">{status}</strong>
        {sheet.conditions?.length ? <span>{sheet.conditions.join(", ")}</span> : <span className="muted">No active conditions</span>}
      </section>

      <section className="tsheet-panel tsheet-band">
        <h4>Species <span>{sheet.species || "-"}</span></h4>
        <div className="badges">
          {(sheet.speciesTraits?.length ? sheet.speciesTraits : (sheet.species ? [sheet.species] : [])).map((trait) => <span key={trait}>{trait}</span>)}
        </div>
      </section>

      <details className="tsheet-panel tsheet-skill-details">
        <summary><h4>Skills <span>Total levels: {skills.reduce((sum, skill) => sum + (skill.level ?? 0), 0)} · Click to roll</span></h4></summary>
        {skills.length === 0 ? (
          <p className="tsheet-empty">No skills recorded.</p>
        ) : (
          <div className="tsheet-skill-cols">
            {skillColumns.map((column, columnIndex) => (
              <ul className="tsheet-skills" key={columnIndex}>
                {column.map((s, i) => (
                  <li
                    key={`${s.name}-${s.speciality || ""}-${columnIndex}-${i}`}
                    className="tsheet-skill-rollable"
                    onClick={() => doRoll(`${s.name}${s.speciality ? ` (${s.speciality})` : ""}`, s.level ?? 0)}
                    title={`Roll 2D6+${s.level ?? 0} for ${s.name}`}
                  >
                    <span>{s.name}{s.speciality ? ` (${s.speciality})` : ""}</span>
                    <span className="tsheet-skill-lvl">{s.level ?? "−"}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
      </details>

      <section className="tsheet-panel">
        <div className="tsheet-cols">
          <div>
            <h4>Armour</h4>
            {armour.length ? (
              <ul className="tsheet-skills">
                {armour.map((item, index) => (
                  <li key={`${item.name}-${index}`}><span>{item.name}</span><span>{detail([item.protection, item.notes])}</span></li>
                ))}
              </ul>
            ) : <p className="tsheet-empty">No armour recorded.</p>}
            <h4>Weapons</h4>
            {weapons.length ? (
              <ul className="tsheet-skills">
                {weapons.map((weapon, index) => (
                  <li key={`${weapon.name}-${index}`}><span>{weapon.name}</span><span>{detail([weapon.damage, weapon.range, weapon.notes])}</span></li>
                ))}
              </ul>
            ) : <p className="tsheet-empty">No weapons recorded yet.</p>}
          </div>
          <div>
            <h4>Items & Holdings</h4>
            {equipment.length || holdings.length ? (
              <ul className="tsheet-skills">
                {equipment.map((e, i) => (
                  <li key={`${e.name}-${i}`}>
                    <span>{e.name}{e.notes ? ` - ${e.notes}` : ""}</span>
                    {e.quantity && e.quantity > 1 && <span className="tsheet-skill-lvl">x{e.quantity}</span>}
                  </li>
                ))}
                {holdings.map((item, i) => <li key={`${item.name}-${i}`}><span>{item.name}</span><span>{item.notes || ""}</span></li>)}
              </ul>
            ) : <p className="tsheet-empty">No items recorded.</p>}
            <h4>People & Notes</h4>
            {contacts.length || psionics.length || sheet.notes ? (
              <ul className="tsheet-skills">
                {contacts.map((item, i) => <li key={`${item.name}-${i}`}><span>{item.name}</span><span>{item.notes || ""}</span></li>)}
                {psionics.map((item, i) => <li key={`${item.name}-${i}`}><span>{item.name}</span><span>{detail([item.level, item.notes])}</span></li>)}
                {sheet.notes && <li><span>{sheet.notes}</span></li>}
              </ul>
            ) : <p className="tsheet-empty">No people or notes recorded.</p>}
            {sheet.credits != null && <p className="tsheet-credits">{sheet.credits.toLocaleString()} Cr</p>}
          </div>
        </div>
      </section>
    </section>
  );
}

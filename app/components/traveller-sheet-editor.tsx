"use client";

import type { TravellerSheet } from "@/lib/types";

const CHARS = ["STR", "DEX", "END", "INT", "EDU", "SOC"] as const;
const DEFAULT_SHEET: TravellerSheet = {
  system: "traveller",
  characteristics: { STR: 7, DEX: 7, END: 7, INT: 7, EDU: 7, SOC: 7 },
  skills: []
};

const numOrUndef = (v: string) => (v === "" ? undefined : Number.parseInt(v, 10) || 0);

export default function TravellerSheetEditor({ sheet, onChange }: { sheet?: TravellerSheet; onChange: (s: TravellerSheet | undefined) => void }) {
  if (!sheet) {
    return <button type="button" className="secondary" onClick={() => onChange(DEFAULT_SHEET)}>Add Traveller character sheet</button>;
  }
  const patch = (p: Partial<TravellerSheet>) => onChange({ ...sheet, ...p });
  const setChar = (k: (typeof CHARS)[number], v: number) => patch({ characteristics: { ...sheet.characteristics, [k]: Math.max(0, v || 0) } });
  const setSkill = (i: number, p: Partial<TravellerSheet["skills"][number]>) => patch({ skills: sheet.skills.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  return (
    <div className="tsheet-editor">
      <div className="tsheet-editor-chars">
        {CHARS.map((k) => (
          <label key={k}>{k}
            <input type="number" min={0} value={sheet.characteristics[k]} onChange={(e) => setChar(k, Number.parseInt(e.target.value, 10))} />
          </label>
        ))}
      </div>
      <label>Species<input value={sheet.species || ""} onChange={(e) => patch({ species: e.target.value || undefined })} placeholder="Imperial Human" /></label>
      <label>Age<input type="number" value={sheet.age ?? ""} onChange={(e) => patch({ age: numOrUndef(e.target.value) })} /></label>
      <label>Homeworld<input value={sheet.homeworld || ""} onChange={(e) => patch({ homeworld: e.target.value || undefined })} /></label>
      <label>UWP<input value={sheet.uwp || ""} onChange={(e) => patch({ uwp: e.target.value || undefined })} placeholder="A788899-C" /></label>
      <label>Credits<input type="number" value={sheet.credits ?? ""} onChange={(e) => patch({ credits: numOrUndef(e.target.value) })} /></label>

      <h4>Skills</h4>
      {sheet.skills.map((s, i) => (
        <div className="tsheet-skill-row" key={i}>
          <input value={s.name} placeholder="Skill" onChange={(e) => setSkill(i, { name: e.target.value })} />
          <input value={s.speciality || ""} placeholder="Speciality" onChange={(e) => setSkill(i, { speciality: e.target.value || undefined })} />
          <input type="number" min={0} value={s.level} onChange={(e) => setSkill(i, { level: Number.parseInt(e.target.value, 10) || 0 })} />
          <button type="button" className="linklike" onClick={() => patch({ skills: sheet.skills.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => patch({ skills: [...sheet.skills, { name: "", level: 0 }] })}>Add skill</button>

      <div className="field-group">
        <button type="button" className="secondary danger" onClick={() => onChange(undefined)}>Remove sheet</button>
      </div>
    </div>
  );
}

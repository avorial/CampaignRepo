"use client";

import type { TravellerSheet } from "@/lib/types";

const CHARS = ["STR", "DEX", "END", "INT", "EDU", "SOC"] as const;
const DEFAULT_SHEET: TravellerSheet = {
  system: "traveller",
  characteristics: { STR: 7, DEX: 7, END: 7, INT: 7, EDU: 7, SOC: 7 },
  skills: [],
  status: "Unwounded",
  speciesTraits: []
};

const numOrUndef = (v: string) => (v === "" ? undefined : Number.parseInt(v, 10) || 0);
const csv = (value?: string[]) => value?.join(", ") || "";
const csvList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export default function TravellerSheetEditor({ sheet, onChange }: { sheet?: TravellerSheet; onChange: (s: TravellerSheet | undefined) => void }) {
  if (!sheet) {
    return <button type="button" className="secondary" onClick={() => onChange(DEFAULT_SHEET)}>Add Traveller character sheet</button>;
  }
  const patch = (p: Partial<TravellerSheet>) => onChange({ ...sheet, ...p });
  const setChar = (k: (typeof CHARS)[number], v: number) => patch({ characteristics: { ...sheet.characteristics, [k]: Math.max(0, v || 0) } });
  const setSkill = (i: number, p: Partial<TravellerSheet["skills"][number]>) => patch({ skills: sheet.skills.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const setWeapon = (i: number, p: Partial<NonNullable<TravellerSheet["weapons"]>[number]>) => patch({ weapons: (sheet.weapons || []).map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const setArmour = (i: number, p: Partial<NonNullable<TravellerSheet["armour"]>[number]>) => patch({ armour: (sheet.armour || []).map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const setEquipment = (i: number, p: Partial<NonNullable<TravellerSheet["equipment"]>[number]>) => patch({ equipment: (sheet.equipment || []).map((s, j) => (j === i ? { ...s, ...p } : s)) });

  return (
    <div className="tsheet-editor">
      <div className="tsheet-editor-chars">
        {CHARS.map((k) => (
          <label key={k}>{k}
            <input type="number" min={0} value={sheet.characteristics[k]} onChange={(e) => setChar(k, Number.parseInt(e.target.value, 10))} />
          </label>
        ))}
      </div>

      <div className="tsheet-editor-grid">
        <label>Species<input value={sheet.species || ""} onChange={(e) => patch({ species: e.target.value || undefined })} placeholder="Racial Solomani" /></label>
        <label>Age<input type="number" value={sheet.age ?? ""} onChange={(e) => patch({ age: numOrUndef(e.target.value) })} /></label>
        <label>Homeworld<input value={sheet.homeworld || ""} onChange={(e) => patch({ homeworld: e.target.value || undefined })} /></label>
        <label>UWP<input value={sheet.uwp || ""} onChange={(e) => patch({ uwp: e.target.value || undefined })} placeholder="A788899-C" /></label>
        <label>Career<input value={sheet.career || ""} onChange={(e) => patch({ career: e.target.value || undefined })} placeholder="Scholar" /></label>
        <label>Rank<input value={sheet.rank || ""} onChange={(e) => patch({ rank: e.target.value || undefined })} placeholder="F" /></label>
        <label>Dossier<input value={sheet.dossier || ""} onChange={(e) => patch({ dossier: e.target.value || undefined })} placeholder="Travel" /></label>
        <label>Status<input value={sheet.status || ""} onChange={(e) => patch({ status: e.target.value || undefined })} placeholder="Unwounded" /></label>
        <label>Credits<input type="number" value={sheet.credits ?? ""} onChange={(e) => patch({ credits: numOrUndef(e.target.value) })} /></label>
        <label>Species traits<input value={csv(sheet.speciesTraits)} onChange={(e) => patch({ speciesTraits: csvList(e.target.value) })} placeholder="Racial Solomani, Party Patronage" /></label>
        <label>Conditions<input value={csv(sheet.conditions)} onChange={(e) => patch({ conditions: csvList(e.target.value) })} placeholder="Fatigued, Wounded" /></label>
      </div>

      <h4>Skills</h4>
      {sheet.skills.map((s, i) => (
        <div className="tsheet-skill-row" key={i}>
          <input value={s.name} placeholder="Skill" onChange={(e) => setSkill(i, { name: e.target.value })} />
          <input value={s.speciality || ""} placeholder="Speciality" onChange={(e) => setSkill(i, { speciality: e.target.value || undefined })} />
          <input type="number" value={s.level} onChange={(e) => setSkill(i, { level: Number.parseInt(e.target.value, 10) || 0 })} />
          <button type="button" className="linklike" onClick={() => patch({ skills: sheet.skills.filter((_, j) => j !== i) })}>x</button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => patch({ skills: [...sheet.skills, { name: "", level: 0 }] })}>Add skill</button>

      <h4>Combat</h4>
      {(sheet.armour || []).map((item, i) => (
        <div className="tsheet-skill-row" key={`armour-${i}`}>
          <input value={item.name} placeholder="Armour" onChange={(e) => setArmour(i, { name: e.target.value })} />
          <input value={item.protection || ""} placeholder="Protection" onChange={(e) => setArmour(i, { protection: e.target.value || undefined })} />
          <input value={item.notes || ""} placeholder="Notes" onChange={(e) => setArmour(i, { notes: e.target.value || undefined })} />
          <button type="button" className="linklike" onClick={() => patch({ armour: (sheet.armour || []).filter((_, j) => j !== i) })}>x</button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => patch({ armour: [...(sheet.armour || []), { name: "" }] })}>Add armour</button>
      {(sheet.weapons || []).map((item, i) => (
        <div className="tsheet-skill-row" key={`weapon-${i}`}>
          <input value={item.name} placeholder="Weapon" onChange={(e) => setWeapon(i, { name: e.target.value })} />
          <input value={item.damage || ""} placeholder="Damage" onChange={(e) => setWeapon(i, { damage: e.target.value || undefined })} />
          <input value={item.range || ""} placeholder="Range" onChange={(e) => setWeapon(i, { range: e.target.value || undefined })} />
          <button type="button" className="linklike" onClick={() => patch({ weapons: (sheet.weapons || []).filter((_, j) => j !== i) })}>x</button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => patch({ weapons: [...(sheet.weapons || []), { name: "" }] })}>Add weapon</button>

      <h4>Gear</h4>
      {(sheet.equipment || []).map((item, i) => (
        <div className="tsheet-skill-row" key={`gear-${i}`}>
          <input value={item.name} placeholder="Item" onChange={(e) => setEquipment(i, { name: e.target.value })} />
          <input value={item.notes || ""} placeholder="Notes" onChange={(e) => setEquipment(i, { notes: e.target.value || undefined })} />
          <input type="number" value={item.quantity ?? ""} placeholder="Qty" onChange={(e) => setEquipment(i, { quantity: numOrUndef(e.target.value) })} />
          <button type="button" className="linklike" onClick={() => patch({ equipment: (sheet.equipment || []).filter((_, j) => j !== i) })}>x</button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => patch({ equipment: [...(sheet.equipment || []), { name: "" }] })}>Add gear</button>

      <label>Notes<textarea value={sheet.notes || ""} onChange={(e) => patch({ notes: e.target.value || undefined })} rows={4} /></label>

      <div className="field-group">
        <button type="button" className="secondary danger" onClick={() => onChange(undefined)}>Remove sheet</button>
      </div>
    </div>
  );
}

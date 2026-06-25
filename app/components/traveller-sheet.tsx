import type { TravellerSheet as Sheet } from "@/lib/types";

const CHARS: { key: keyof Sheet["characteristics"]; label: string }[] = [
  { key: "STR", label: "Strength" },
  { key: "DEX", label: "Dexterity" },
  { key: "END", label: "Endurance" },
  { key: "INT", label: "Intellect" },
  { key: "EDU", label: "Education" },
  { key: "SOC", label: "Social" }
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

export default function TravellerSheet({ sheet, name }: { sheet: Sheet; name?: string }) {
  const skills = [...(sheet.skills || [])].sort((a, b) => a.name.localeCompare(b.name) || (a.speciality || "").localeCompare(b.speciality || ""));
  const meta = [
    sheet.species,
    sheet.age != null ? `Age ${sheet.age}` : null,
    sheet.homeworld ? `${sheet.homeworld}${sheet.uwp ? ` (${sheet.uwp})` : ""}` : sheet.uwp || null
  ].filter(Boolean);

  return (
    <section className="tsheet">
      <header className="tsheet-head">
        <div>
          <p className="eyebrow">Traveller · Mongoose 2e</p>
          {name && <strong className="tsheet-name">{name}</strong>}
        </div>
        {meta.length > 0 && <span className="tsheet-meta">{meta.join(" · ")}</span>}
      </header>

      <div className="tsheet-chars">
        {CHARS.map(({ key, label }) => {
          const value = sheet.characteristics?.[key] ?? 0;
          return (
            <div className="tsheet-char" key={key}>
              <span className="tsheet-char-key">{key}</span>
              <span className="tsheet-char-label">{label}</span>
              <span className="tsheet-char-val">{value}</span>
              <span className="tsheet-char-mod">DM {fmtMod(travellerDM(value))}</span>
            </div>
          );
        })}
      </div>

      <div className="tsheet-cols">
        <div>
          <h4>Skills <span className="tsheet-count">{skills.length}</span></h4>
          {skills.length === 0 ? (
            <p className="muted">No skills recorded.</p>
          ) : (
            <ul className="tsheet-skills">
              {skills.map((s, i) => (
                <li key={`${s.name}-${s.speciality || ""}-${i}`}>
                  <span>{s.name}{s.speciality ? ` (${s.speciality})` : ""}</span>
                  <span className="tsheet-skill-lvl">{s.level}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>Equipment</h4>
          {sheet.equipment && sheet.equipment.length > 0 ? (
            <ul className="tsheet-skills">
              {sheet.equipment.map((e, i) => (
                <li key={`${e.name}-${i}`}>
                  <span>{e.name}{e.notes ? ` — ${e.notes}` : ""}</span>
                  {e.quantity && e.quantity > 1 && <span className="tsheet-skill-lvl">×{e.quantity}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No equipment recorded.</p>
          )}
          {sheet.credits != null && <p className="tsheet-credits">{sheet.credits.toLocaleString()} Cr</p>}
        </div>
      </div>
    </section>
  );
}

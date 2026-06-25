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
  const columns: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => columns[index % count].push(item));
  return columns;
}

function detail(parts: unknown[]) {
  return parts.filter(isFilled).join(" - ");
}

export default function TravellerSheet({ sheet, name }: { sheet: Sheet; name?: string }) {
  const skills = [...(sheet.skills || [])].sort((a, b) => a.name.localeCompare(b.name) || (a.speciality || "").localeCompare(b.speciality || ""));
  const skillColumns = splitColumns(skills, 3);
  const dossier = sheet.dossier || detail([sheet.career, sheet.rank]) || "Travel";
  const status = sheet.status || "Unwounded";
  const weapons = sheet.weapons || [];
  const armour = sheet.armour || [];
  const equipment = sheet.equipment || [];
  const holdings = sheet.holdings || [];
  const contacts = sheet.contacts || [];
  const psionics = sheet.psionics || [];

  return (
    <section className="tsheet">
      <header className="tsheet-registry">
        <span>Solomani Confederation</span>
        <span>Genetic Record</span>
        <span>Form Sol-GR1 - Racial Registry</span>
      </header>

      <div className="tsheet-dossier">
        <div className="tsheet-upload">
          <strong>{String((sheet.rank || sheet.career || "F").charAt(0)).toUpperCase()}</strong>
          <span>Upload</span>
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

      <div className="tsheet-topgrid">
        <section className="tsheet-panel">
          <h4>Characteristics <span>Click a value to roll 2D6 + that DM</span></h4>
          <div className="tsheet-chars">
            {CHARS.map(({ key, label }) => {
              const value = sheet.characteristics?.[key] ?? 0;
              return (
                <div className="tsheet-char" key={key}>
                  <span className="tsheet-char-key">{key}</span>
                  <span className="tsheet-char-label">{label}</span>
                  <span className="tsheet-char-val">{value}</span>
                  <span className="tsheet-char-mod">Mod {fmtMod(travellerDM(value))}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="tsheet-panel">
          <h4>Wielded <span>Add weapons in the Combat tab</span></h4>
          {weapons.length ? (
            <ul className="tsheet-skills">
              {weapons.map((weapon, index) => (
                <li key={`${weapon.name}-${index}`}>
                  <span>{weapon.name}</span>
                  <span>{detail([weapon.damage, weapon.range, weapon.notes])}</span>
                </li>
              ))}
            </ul>
          ) : <p className="tsheet-empty">No weapons.</p>}
        </section>
      </div>

      <section className="tsheet-panel tsheet-band">
        <h4>Status & Conditions <span>Wound status + active conditions</span></h4>
        <strong className="tsheet-status">{status}</strong>
        {sheet.conditions?.length ? <span>{sheet.conditions.join(", ")}</span> : <span className="muted">No active conditions</span>}
      </section>

      <section className="tsheet-panel tsheet-band">
        <h4>Species <span>{sheet.species || "Traveller"}</span></h4>
        <div className="badges">
          {(sheet.speciesTraits?.length ? sheet.speciesTraits : [sheet.species || "Traveller"]).map((trait) => <span key={trait}>{trait}</span>)}
        </div>
      </section>

      <section className="tsheet-panel">
        <h4>Skills <span>Total levels: {skills.reduce((sum, skill) => sum + skill.level, 0)}</span></h4>
        {skills.length === 0 ? (
          <p className="tsheet-empty">No skills recorded.</p>
        ) : (
          <div className="tsheet-skill-cols">
            {skillColumns.map((column, columnIndex) => (
              <ul className="tsheet-skills" key={columnIndex}>
                {column.map((s, i) => (
                  <li key={`${s.name}-${s.speciality || ""}-${columnIndex}-${i}`}>
                    <span>{s.name}{s.speciality ? ` (${s.speciality})` : ""}</span>
                    <span className="tsheet-skill-lvl">{s.level}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
      </section>

      <section className="tsheet-panel">
        <div className="tsheet-tabs">
          <span>Combat</span>
          <span>Gear</span>
          <span>Holdings</span>
          <span>People</span>
          <span>Psionics</span>
          <span>Notes</span>
        </div>
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
            <h4>Gear & Holdings</h4>
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
            ) : <p className="tsheet-empty">No gear recorded.</p>}
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

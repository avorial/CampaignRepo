// Shared dice roller for clickable sheet elements. Rendered sheets carry
// `data-roll` (+ `data-mod` / `data-label`), and both the page editor preview
// and the public site reader resolve them through here.

export type DiceRollResult = { label: string; detail: string; total: number };

const d = (sides: number) => Math.floor(Math.random() * sides) + 1;
const modText = (mod: number) => (mod === 0 ? "" : mod > 0 ? ` + ${mod}` : ` − ${Math.abs(mod)}`);

/**
 * Roll from a `[data-roll]` element.
 * - `2d6`: Traveller — 2D6 + DM.
 * - anything else: d20 + modifier.
 */
export function rollFromElement(element: Element): DiceRollResult {
  const kind = element.getAttribute("data-roll") || "2d6";
  const mod = parseInt(element.getAttribute("data-mod") || "0", 10) || 0;
  const label = element.getAttribute("data-label") || "Roll";

  if (kind === "2d6") {
    const d1 = d(6);
    const d2 = d(6);
    const total = d1 + d2 + mod;
    return { label, detail: `${d1} + ${d2}${modText(mod)} = ${total}`, total };
  }

  const roll = d(20);
  const total = roll + mod;
  return { label, detail: `${roll}${modText(mod)} = ${total}`, total };
}

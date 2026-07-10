import { describe, it, expect, vi, afterEach } from "vitest";
import { rollFromElement } from "@/lib/dice";

/** Minimal stand-in for the DOM element the click handler passes in. */
function el(attrs: Record<string, string>) {
  return { getAttribute: (name: string) => attrs[name] ?? null } as unknown as Element;
}

/** Feed Math.random a fixed sequence so die faces are deterministic. */
function withRandom(values: number[], run: () => void) {
  const spy = vi.spyOn(Math, "random");
  values.forEach((value) => spy.mockReturnValueOnce(value));
  run();
}

afterEach(() => vi.restoreAllMocks());

// Math.floor(r * 6) + 1 -> face. 0=1, 0.2=2, 0.4=3, 0.6=4, 0.8=5, 0.99=6
const face = { 1: 0, 2: 0.2, 3: 0.4, 4: 0.6, 5: 0.8, 6: 0.99 } as const;

describe("shared sheet roller", () => {
  it("rolls 2d6 plus a DM for Traveller", () => {
    withRandom([face[4], face[5]], () => {
      const roll = rollFromElement(el({ "data-roll": "2d6", "data-mod": "2", "data-label": "DEX" }));
      expect(roll.total).toBe(11);
      expect(roll.detail).toBe("4 + 5 + 2 = 11");
    });
  });

  it("renders a negative modifier with a minus sign", () => {
    withRandom([face[3], face[3]], () => {
      const roll = rollFromElement(el({ "data-roll": "2d6", "data-mod": "-1" }));
      expect(roll.total).toBe(5);
      expect(roll.detail).toContain("− 1");
    });
  });

  it("falls back to d20 plus a modifier", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.5); // floor(0.5*20)+1 = 11
    const roll = rollFromElement(el({ "data-roll": "d20", "data-mod": "3" }));
    expect(roll.total).toBe(14);
  });
});

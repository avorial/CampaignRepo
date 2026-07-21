import { describe, expect, it } from "vitest";
import { isMutedByTags, isMutedPage, sanitizeMutedTags, MAX_MUTED_TAGS } from "@/lib/muted-tags";

describe("muted tags", () => {
  it("is inert by default so no campaign changes behavior", () => {
    expect(sanitizeMutedTags(undefined)).toEqual([]);
    expect(sanitizeMutedTags(null)).toEqual([]);
    expect(sanitizeMutedTags("generated")).toEqual([]);
    expect(isMutedByTags(["generated"], [])).toBe(false);
  });

  it("normalizes case, whitespace, and duplicates", () => {
    expect(sanitizeMutedTags([" Generated ", "GENERATED", "index"])).toEqual(["generated", "index"]);
    expect(sanitizeMutedTags(["", "   ", 7, {}])).toEqual([]);
  });

  it("caps the list so config cannot grow unbounded", () => {
    const many = Array.from({ length: MAX_MUTED_TAGS + 10 }, (_, i) => `tag${i}`);
    expect(sanitizeMutedTags(many)).toHaveLength(MAX_MUTED_TAGS);
  });

  it("matches a page carrying any muted tag, case-insensitively", () => {
    expect(isMutedByTags(["generated"], ["generated"])).toBe(true);
    expect(isMutedByTags(["Generated"], ["generated"])).toBe(true);
    expect(isMutedByTags(["item", "generated"], ["generated"])).toBe(true);
    expect(isMutedByTags(["npc", "major"], ["generated"])).toBe(false);
    expect(isMutedByTags(undefined, ["generated"])).toBe(false);
    expect(isMutedByTags([], ["generated"])).toBe(false);
  });

  it("mutes by category so a blanket import tag need not be used", () => {
    // Attackers tags all 2,019 imported pages "generated"; muting that tag would
    // hide the whole world. Category muting targets only the low-signal set.
    const muted = ["category:item"];
    expect(isMutedPage(["generated"], "item", muted)).toBe(true);
    expect(isMutedPage(["generated"], "npc", muted)).toBe(false);
    expect(isMutedPage(["generated"], "event", muted)).toBe(false);
    expect(isMutedPage(["generated"], undefined, muted)).toBe(false);
  });

  it("normalizes the category form", () => {
    expect(sanitizeMutedTags(["Category: Item", "category:item"])).toEqual(["category:item"]);
    expect(sanitizeMutedTags(["category:"])).toEqual([]);
    expect(isMutedPage([], "Item", sanitizeMutedTags(["Category: Item"]))).toBe(true);
  });
});

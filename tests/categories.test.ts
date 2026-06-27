import { describe, expect, it } from "vitest";
import { sanitizeCampaignCategories } from "@/lib/categories";

describe("campaign categories", () => {
  it("keeps default categories when config is missing", () => {
    expect(sanitizeCampaignCategories(undefined).map((category) => category.id)).toContain("character");
  });

  it("upgrades legacy label-only category lists to stable ids", () => {
    expect(sanitizeCampaignCategories(["Lore", "NPCs", "Custom Threat"])).toEqual([
      { id: "lore", label: "Lore" },
      { id: "npc", label: "NPCs" },
      { id: "custom_threat", label: "Custom Threat" }
    ]);
  });

  it("sanitizes editable id and label objects", () => {
    expect(sanitizeCampaignCategories([{ id: "Bad ID!!", label: "  Rumors  " }, { id: "bad_id", label: "Duplicate" }])).toEqual([
      { id: "bad_id", label: "Rumors" }
    ]);
  });
});

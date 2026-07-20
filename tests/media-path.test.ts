import { describe, expect, it } from "vitest";
import { cleanFileName, cleanFolder, mediaNameFromPath, mediaPathFor } from "@/lib/media-path";

describe("media path handling", () => {
  it("uploads with no folder land directly in wiki/media", () => {
    // Regression: slugify()'s "untitled" fallback ran on the empty folder, so
    // every upload was filed under wiki/media/untitled/ with broken markdown.
    expect(mediaPathFor("portrait.webp")).toBe("wiki/media/portrait.webp");
    expect(mediaPathFor("portrait.webp", "")).toBe("wiki/media/portrait.webp");
    expect(mediaPathFor("portrait.webp", "   ")).toBe("wiki/media/portrait.webp");
    expect(mediaPathFor("portrait.webp", "/")).toBe("wiki/media/portrait.webp");
  });

  it("keeps real folders, including nested and untidy ones", () => {
    expect(mediaPathFor("map.png", "maps")).toBe("wiki/media/maps/map.png");
    expect(mediaPathFor("map.png", "maps/region 1")).toBe("wiki/media/maps/region-1/map.png");
    expect(mediaPathFor("map.png", "/maps//sector 7/")).toBe("wiki/media/maps/sector-7/map.png");
  });

  it("does not rename a folder the user genuinely called untitled", () => {
    expect(cleanFolder("untitled")).toBe("untitled");
  });

  it("drops folder segments with no usable characters", () => {
    expect(cleanFolder("!!!")).toBe("");
    expect(cleanFolder("maps/???/city")).toBe("maps/city");
  });

  it("derives the wiki/media-relative name so nested media links correctly", () => {
    expect(mediaNameFromPath("wiki/media/portrait.webp")).toBe("portrait.webp");
    expect(mediaNameFromPath("wiki/media/maps/map.png")).toBe("maps/map.png");
  });

  it("sanitizes file names and lowercases the extension", () => {
    expect(cleanFileName("My Portrait.PNG")).toBe("My-Portrait.png");
    expect(cleanFileName("no-extension")).toBe("no-extension");
  });
});

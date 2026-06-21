import { describe, expect, it } from "vitest";
import { githubContentType } from "@/lib/validation";

describe("repo validation", () => {
  it("treats GitHub contents arrays as directories", () => {
    expect(githubContentType([{ name: "page.md", type: "file" }])).toBe("dir");
  });

  it("reads file content types from GitHub content objects", () => {
    expect(githubContentType({ type: "file", name: "README.md" })).toBe("file");
  });
});

import { describe, expect, it } from "vitest";
import { parseRepoInput } from "@/lib/repo";

describe("parseRepoInput", () => {
  it("accepts separate owner and repo values", () => {
    expect(parseRepoInput("avorial", "kdwiki")).toEqual({ owner: "avorial", repo: "kdwiki" });
  });

  it("accepts full GitHub repository URLs", () => {
    expect(parseRepoInput("", "https://github.com/avorial/kdwiki")).toEqual({ owner: "avorial", repo: "kdwiki" });
    expect(parseRepoInput("", "https://github.com/avorial/kdwiki.git")).toEqual({ owner: "avorial", repo: "kdwiki" });
  });
});

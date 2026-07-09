import { describe, expect, it } from "vitest";
import { parseRepoInput } from "@/lib/repo";

describe("parseRepoInput", () => {
  it("accepts separate owner and repo values", () => {
    expect(parseRepoInput("owner", "campaign-wiki")).toEqual({ owner: "owner", repo: "campaign-wiki" });
  });

  it("accepts full GitHub repository URLs", () => {
    expect(parseRepoInput("", "https://github.com/owner/campaign-wiki")).toEqual({ owner: "owner", repo: "campaign-wiki" });
    expect(parseRepoInput("", "https://github.com/owner/campaign-wiki.git")).toEqual({ owner: "owner", repo: "campaign-wiki" });
  });
});

import { describe, expect, it, vi } from "vitest";
import { mediaResponseHeaders } from "@/lib/media-response";

vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ id: 1 }) }));
vi.mock("@/lib/db", () => ({
  getCampaign: () => ({ id: 1 }),
  getPublicSiteCampaign: () => ({ id: 1 }),
  getCampaignByIdPublic: () => ({ id: 1 }),
  getPageShare: () => ({ campaignId: 1 })
}));
vi.mock("@/lib/storage", () => ({
  getStorageAdapter: () => ({ getRawFile: async () => ({ bytes: new ArrayBuffer(1), contentType: "application/octet-stream" }) }),
  isNotFoundError: () => false
}));
import { GET as campaignMedia } from "@/app/api/campaigns/[id]/media/[...path]/route";
import { GET as publicMedia } from "@/app/public-media/[slug]/[...path]/route";
import { GET as shareMedia } from "@/app/share/[token]/media/[...path]/route";

describe("image media responses", () => {
  it.each([["portrait.PNG", "image/png"], ["portrait.jpeg", "image/jpeg"], ["portrait.webp", "image/webp"], ["portrait.avif", "image/avif"], ["portrait.svg", "image/svg+xml"]])("serves %s inline despite generic upstream headers", (filename, mime) => {
    expect(mediaResponseHeaders(filename, "application/octet-stream", "private")).toMatchObject({ "Content-Type": mime, "Content-Disposition": "inline", "Cache-Control": "private" });
  });

  it("retains unknown-file types and does not change backup download behavior", () => {
    expect(mediaResponseHeaders("file.custom", "application/custom", "private")["Content-Type"]).toBe("application/custom");
    expect(mediaResponseHeaders("file.zip", undefined, "private")).not.toHaveProperty("Content-Disposition");
  });

  it("applies inline image headers in authenticated, public, and share media routes", async () => {
    const request = new Request("http://localhost/image.png");
    const responses = await Promise.all([
      campaignMedia(request, { params: Promise.resolve({ id: "1", path: ["portrait.png"] }) }),
      publicMedia(request, { params: Promise.resolve({ slug: "campaign", path: ["portrait.png"] }) }),
      shareMedia(request, { params: Promise.resolve({ token: "share", path: ["portrait.png"] }) })
    ]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("content-disposition")).toBe("inline");
    }
    expect(responses[0].headers.get("cache-control")).toContain("private");
  });
});

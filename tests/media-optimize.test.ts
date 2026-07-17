import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MAX_IMAGE_DIMENSION, optimizeImageUpload } from "@/lib/media-optimize";

async function noisyPng(width: number, height: number) {
  // Blurred noise approximates photographic content: heavy as lossless PNG,
  // highly compressible as lossy WebP — pure noise would be the one input
  // where WebP cannot win.
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251;
  return sharp(raw, { raw: { width, height, channels: 3 } }).blur(8).png().toBuffer();
}

describe("media upload optimization", () => {
  it("converts an oversized PNG to a dimension-capped WebP that is actually smaller", async () => {
    const png = await noisyPng(2400, 1200);
    const result = await optimizeImageUpload(png.toString("base64"), "portrait.png");

    expect(result.converted).toBe(true);
    expect(result.fileName).toBe("portrait.webp");
    expect(result.bytes).toBeLessThan(result.originalBytes);
    const out = Buffer.from(result.base64, "base64");
    const metadata = await sharp(out).metadata();
    expect(metadata.format).toBe("webp");
    expect(Math.max(metadata.width || 0, metadata.height || 0)).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
  });

  it("never upscales a small image", async () => {
    const png = await noisyPng(400, 300);
    const result = await optimizeImageUpload(png.toString("base64"), "icon.png");
    const out = Buffer.from(result.base64, "base64");
    const metadata = await sharp(out).metadata();
    expect(metadata.width).toBeLessThanOrEqual(400);
    expect(metadata.height).toBeLessThanOrEqual(300);
  });

  it("passes non-image files through untouched", async () => {
    const pdf = Buffer.from("%PDF-1.4 fake").toString("base64");
    const result = await optimizeImageUpload(pdf, "handout.pdf");
    expect(result.converted).toBe(false);
    expect(result.fileName).toBe("handout.pdf");
    expect(result.base64).toBe(pdf);
  });

  it("passes undecodable data with an image extension through untouched", async () => {
    const junk = Buffer.from("not actually an image").toString("base64");
    const result = await optimizeImageUpload(junk, "broken.png");
    expect(result.converted).toBe(false);
    expect(result.base64).toBe(junk);
  });
});

import sharp from "sharp";

// Media strategy rung 1: shrink images at the door. Campaign repos are ~85%
// media by size, and every 2 MB PNG uploaded today is repo history forever.
// Raster uploads are converted to WebP and capped in dimensions before they
// are committed; the repo only ever sees the small version.

export const MAX_IMAGE_DIMENSION = 1600;
export const WEBP_QUALITY = 82;
/** Small images within dimensions pass through untouched — not worth churning. */
const SMALL_BYTES = 150 * 1024;

const OPTIMIZABLE = /\.(png|jpe?g|webp)$/i;

export type OptimizedUpload = {
  base64: string;
  fileName: string;
  converted: boolean;
  originalBytes: number;
  bytes: number;
};

/**
 * Optimize a base64 image upload: resize to at most MAX_IMAGE_DIMENSION on the
 * longest edge (never upscaling), convert to WebP, and keep the original when
 * it is already small or when conversion would not actually shrink it.
 * Non-raster files (gif, svg, pdf, audio, ...) and undecodable inputs pass
 * through untouched.
 */
export async function optimizeImageUpload(base64: string, fileName: string): Promise<OptimizedUpload> {
  const input = Buffer.from(base64, "base64");
  const passthrough: OptimizedUpload = { base64, fileName, converted: false, originalBytes: input.length, bytes: input.length };
  if (!OPTIMIZABLE.test(fileName)) return passthrough;
  try {
    const metadata = await sharp(input).metadata();
    const longestEdge = Math.max(metadata.width || 0, metadata.height || 0);
    const alreadyWebp = /\.webp$/i.test(fileName);
    if (input.length <= SMALL_BYTES && longestEdge <= MAX_IMAGE_DIMENSION && alreadyWebp) return passthrough;
    if (input.length <= SMALL_BYTES && longestEdge <= MAX_IMAGE_DIMENSION) {
      // Small and within bounds: convert only if WebP actually wins.
      const converted = await sharp(input).rotate().webp({ quality: WEBP_QUALITY }).toBuffer();
      if (converted.length >= input.length) return passthrough;
      return { base64: converted.toString("base64"), fileName: webpName(fileName), converted: true, originalBytes: input.length, bytes: converted.length };
    }
    const converted = await sharp(input)
      .rotate() // honor EXIF orientation before it is stripped
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    if (converted.length >= input.length) return passthrough;
    return { base64: converted.toString("base64"), fileName: webpName(fileName), converted: true, originalBytes: input.length, bytes: converted.length };
  } catch {
    // Not a decodable raster image — store exactly what was uploaded.
    return passthrough;
  }
}

function webpName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, ".webp");
}

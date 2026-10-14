const contentTypes: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml", avif: "image/avif", bmp: "image/bmp",
  ico: "image/x-icon", pdf: "application/pdf", mp3: "audio/mpeg", wav: "audio/wav",
  ogg: "audio/ogg", m4a: "audio/mp4", flac: "audio/flac", mp4: "video/mp4", webm: "video/webm"
};

export function mediaResponseHeaders(fileName: string, upstreamType: string | undefined, cacheControl: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const type = contentTypes[extension] || upstreamType || "application/octet-stream";
  return {
    "Content-Type": type,
    "Cache-Control": cacheControl,
    ...(type.startsWith("image/") ? { "Content-Disposition": "inline" } : {})
  };
}

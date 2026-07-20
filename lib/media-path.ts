import { slugify } from "@/lib/slug";

/** Sanitize an uploaded file name, preserving a lowercase extension. */
export function cleanFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  const ext = lastDot >= 0 ? fileName.slice(lastDot).toLowerCase().replace(/[^.a-z0-9]/g, "") : "";
  const base = lastDot >= 0 ? fileName.slice(0, lastDot) : fileName;
  // "file" keeps a name like ".png" from losing its base entirely.
  return `${slugify(base, "file")}${ext}`;
}

/**
 * Sanitize an optional folder path under wiki/media.
 *
 * Segments with no usable characters are dropped before slugify() so an absent
 * or empty folder yields "" and the file lands directly in wiki/media.
 *
 * This previously produced a literal `wiki/media/untitled/` directory for every
 * upload: slugify() hard-coded an "untitled" fallback, which is truthy and so
 * survived the filter. The returned markdown still pointed at
 * `wiki/media/<file>`, so uploaded images rendered broken.
 */
export function cleanFolder(folder?: string) {
  return String(folder || "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => /[a-zA-Z0-9]/.test(part))
    .map((part) => slugify(part))
    .join("/");
}

/** Full repo path for a media file, optionally inside a folder. */
export function mediaPathFor(name: string, folder?: string) {
  const clean = cleanFolder(folder);
  return `wiki/media/${clean ? `${clean}/` : ""}${name}`;
}

/** The path relative to wiki/media — includes the folder, if any. */
export function mediaNameFromPath(path: string) {
  return path.replace(/^wiki\/media\//, "");
}

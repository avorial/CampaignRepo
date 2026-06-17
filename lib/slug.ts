export function slugify(value: string) {
  return value
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "untitled";
}

export function titleFromSlug(slug: string) {
  return slug.replace(/-/g, " ");
}

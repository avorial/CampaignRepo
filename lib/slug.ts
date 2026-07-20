/**
 * Slugify a value, returning `fallback` (empty by default) when the input has
 * no usable characters.
 *
 * This used to hard-code an "untitled" fallback, which silently defeated every
 * `slugify(x) || myFallback` guard in the codebase — "untitled" is truthy, so
 * the caller's fallback never ran. That turned distinct untitled records into
 * one colliding slug and filed media uploads under a literal "untitled" folder.
 * Callers now state their own fallback, so the intent is visible at the call
 * site and unusable input can be detected with a plain falsy check.
 */
export function slugify(value: string, fallback = "") {
  return value
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || fallback;
}

export function titleFromSlug(slug: string) {
  return slug.replace(/-/g, " ");
}

export function githubContentType(content: unknown) {
  if (Array.isArray(content)) return "dir";
  if (content && typeof content === "object" && "type" in content) return String(content.type);
  return "unknown";
}

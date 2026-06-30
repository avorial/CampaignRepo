import yaml from "yaml";
import type { StorageAdapter } from "@/lib/storage";

export type ManuscriptVisibility = "gm" | "players";

export type Manuscript = {
  slug: string;
  title: string;
  description?: string;
  visibility: ManuscriptVisibility;
  pages: string[]; // ordered page slugs
  sha?: string;
};

const DIR = "wiki/manuscripts";

function toSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "manuscript";
}

function path(slug: string) {
  return `${DIR}/${slug}.yaml`;
}

function parse(slug: string, text: string, sha?: string): Manuscript {
  const data = yaml.parse(text) || {};
  return {
    slug,
    title: String(data.title || slug),
    description: data.description ? String(data.description) : undefined,
    visibility: data.visibility === "players" ? "players" : "gm",
    pages: Array.isArray(data.pages) ? data.pages.map(String) : [],
    sha
  };
}

function serialize(m: Omit<Manuscript, "slug" | "sha">): string {
  return yaml.stringify({ title: m.title, description: m.description, visibility: m.visibility, pages: m.pages });
}

export async function listManuscripts(storage: StorageAdapter): Promise<Manuscript[]> {
  try {
    const entries = await storage.listDirectory(DIR);
    const yamlFiles = entries.filter((e) => e.type === "file" && e.name.endsWith(".yaml"));
    const results = await Promise.all(
      yamlFiles.map(async (e) => {
        const slug = e.name.replace(/\.yaml$/, "");
        try {
          const file = await storage.getTextFile(path(slug));
          return parse(slug, file.text, file.sha);
        } catch { return null; }
      })
    );
    return results.filter((m): m is Manuscript => m !== null);
  } catch { return []; }
}

export async function getManuscript(storage: StorageAdapter, slug: string): Promise<Manuscript | null> {
  try {
    const file = await storage.getTextFile(path(slug));
    return parse(slug, file.text, file.sha);
  } catch { return null; }
}

export async function saveManuscript(
  storage: StorageAdapter,
  slug: string,
  data: Omit<Manuscript, "slug" | "sha">,
  sha: string | undefined,
  commitMessage: string
): Promise<string> {
  const text = serialize(data);
  const result = await storage.putFile(path(slug), text, commitMessage, sha);
  return result?.sha || "";
}

export async function deleteManuscript(
  storage: StorageAdapter,
  slug: string,
  sha: string,
  commitMessage: string
): Promise<void> {
  await storage.deleteFile(path(slug), commitMessage, sha);
}

export { toSlug as manuscriptSlug };

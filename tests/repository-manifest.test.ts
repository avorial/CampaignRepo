import { describe, expect, it, vi } from "vitest";
import {
  readRepositoryManifestSnapshot,
  readRepositoryManifestText,
  removePageFromRepositoryManifest,
  repositoryManifestPath,
  serializeRepositoryManifest,
  upsertManifestPage,
  validateRepositoryManifest
} from "@/lib/repository-manifest";
import type { StorageAdapter } from "@/lib/storage";

function manifestText(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    generatedAt: "2026-07-13T18:00:00.000Z",
    pages: [
      {
        id: "npc-alain",
        title: "Alain",
        path: "wiki/pages/alain.md",
        type: "npc",
        tags: ["ally"],
        links: ["location-jardin"],
        visibility: "players",
        approvalStatus: "approved"
      },
      {
        id: "location-jardin",
        title: "Jardin",
        path: "wiki/pages/jardin.md",
        type: "location",
        tags: [],
        links: [],
        visibility: "players",
        approvalStatus: "approved"
      }
    ],
    ...overrides
  });
}

describe("repository manifest", () => {
  it("loads pages from the manifest without enumerating repository files", async () => {
    const storage = {
      getTextFile: vi.fn(async (path: string) => {
        expect(path).toBe(repositoryManifestPath);
        return { sha: "manifest-sha", text: manifestText() };
      }),
      listDirectory: vi.fn(),
      listDirectoryTextFiles: vi.fn()
    } as unknown as StorageAdapter;

    const snapshot = await readRepositoryManifestSnapshot(storage);

    expect(snapshot.pages).toHaveLength(2);
    expect(snapshot.pages[0].frontmatter.name).toBe("Alain");
    expect(snapshot.pages[1].backlinks).toEqual(["npc-alain"]);
    expect((storage as any).listDirectory).not.toHaveBeenCalled();
    expect((storage as any).listDirectoryTextFiles).not.toHaveBeenCalled();
  });

  it("rejects invalid duplicate page ids", () => {
    const manifest = JSON.parse(manifestText({
      pages: [
        { id: "same", title: "One", path: "wiki/pages/one.md", type: "lore", tags: [], links: [] },
        { id: "same", title: "Two", path: "wiki/pages/two.md", type: "lore", tags: [], links: [] }
      ]
    }));

    const result = validateRepositoryManifest(manifest);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("Duplicate page id");
    expect(() => readRepositoryManifestText(JSON.stringify(manifest))).toThrow(/invalid/i);
  });

  it("serializes only valid manifests", () => {
    const manifest = readRepositoryManifestText(manifestText());
    expect(serializeRepositoryManifest(manifest)).toContain("\"schemaVersion\": 1");
  });

  it("rewrites internal links when an upsert changes a page id", () => {
    const manifest = readRepositoryManifestText(manifestText());
    manifest.pages[1].links = ["npc-alain"];
    const next = upsertManifestPage(manifest, {
      id: "organization-alain",
      title: "Alain",
      path: "wiki/pages/alain.md",
      type: "organization",
      tags: ["ally"],
      links: ["location-jardin"],
      visibility: "players",
      approvalStatus: "approved"
    });

    expect(next.pages[0].id).toBe("organization-alain");
    expect(next.pages[1].links).toEqual(["organization-alain"]);
    expect(serializeRepositoryManifest(next)).toContain("organization-alain");
  });

  it("removes a deleted page from the manifest immediately", async () => {
    // Page lists prefer the manifest, so a delete must purge it right away —
    // waiting on the delayed rebuild would make the deleted page reappear.
    const putFile = vi.fn(async () => ({ sha: "next-sha" }));
    const storage = {
      getTextFile: vi.fn(async () => ({ sha: "manifest-sha", text: manifestText() })),
      putFile
    } as unknown as StorageAdapter;

    await removePageFromRepositoryManifest(storage, "alain");

    expect(putFile).toHaveBeenCalledOnce();
    const [path, content, , sha] = putFile.mock.calls[0] as unknown as [string, string, string, string];
    expect(path).toBe(repositoryManifestPath);
    expect(sha).toBe("manifest-sha");
    const written = readRepositoryManifestText(content);
    expect(written.pages.map((page) => page.id)).toEqual(["location-jardin"]);
  });

  it("degrades links into a removed page instead of leaving dangling ids", async () => {
    // alain links to jardin; deleting jardin must not leave a dangling id
    // (dangling ids fail validation and would silently skip the purge).
    const putFile = vi.fn(async () => ({ sha: "next-sha" }));
    const storage = {
      getTextFile: vi.fn(async () => ({ sha: "manifest-sha", text: manifestText() })),
      putFile
    } as unknown as StorageAdapter;

    await removePageFromRepositoryManifest(storage, "jardin");

    expect(putFile).toHaveBeenCalledOnce();
    const [, writtenText] = putFile.mock.calls[0] as unknown as [string, string];
    const written = readRepositoryManifestText(writtenText);
    expect(written.pages.map((page) => page.id)).toEqual(["npc-alain"]);
    expect(written.pages[0].links).toEqual(["unresolved:jardin"]);
  });

  it("treats a missing manifest as nothing to purge", async () => {
    const putFile = vi.fn();
    const storage = {
      getTextFile: vi.fn(async () => {
        throw new Error("Not found");
      }),
      putFile
    } as unknown as StorageAdapter;

    await expect(removePageFromRepositoryManifest(storage, "alain")).resolves.toBeUndefined();
    expect(putFile).not.toHaveBeenCalled();
  });

  it("skips the write when the slug is not in the manifest", async () => {
    const putFile = vi.fn();
    const storage = {
      getTextFile: vi.fn(async () => ({ sha: "manifest-sha", text: manifestText() })),
      putFile
    } as unknown as StorageAdapter;

    await removePageFromRepositoryManifest(storage, "never-existed");

    expect(putFile).not.toHaveBeenCalled();
  });
});

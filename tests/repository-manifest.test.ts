import { describe, expect, it, vi } from "vitest";
import {
  readRepositoryManifestSnapshot,
  readRepositoryManifestText,
  repositoryManifestPath,
  serializeRepositoryManifest,
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
});

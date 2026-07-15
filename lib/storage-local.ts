import fs from "node:fs/promises";
import nodePath from "node:path";
import crypto from "node:crypto";
import type { Campaign, GameType } from "@/lib/types";
import type { StorageAdapter, StorageCommit, StorageDirEntry, StorageTextEntry } from "@/lib/storage";
import { StorageError } from "@/lib/storage";
import { campaignYaml, repoReadme, starterPages } from "@/lib/templates";
import { packFor } from "@/lib/template-packs";
import { serializePage } from "@/lib/markdown";
import { emptyRepositoryManifestText, repositoryManifestPath } from "@/lib/repository-manifest";

function contentHash(data: string | Buffer): string {
  return crypto.createHash("sha1").update(data).digest("hex");
}

function mimeFromPath(p: string): string | undefined {
  const ext = nodePath.extname(p).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".pdf": "application/pdf", ".mp3": "audio/mpeg", ".wav": "audio/wav",
    ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".flac": "audio/flac",
    ".md": "text/markdown", ".json": "application/json",
    ".yaml": "application/yaml", ".txt": "text/plain"
  };
  return map[ext];
}

export class LocalFolderAdapter implements StorageAdapter {
  readonly isLocal = true;

  constructor(private readonly basePath: string) {}

  private resolve(filePath: string): string {
    const base = nodePath.resolve(this.basePath);
    const full = nodePath.resolve(base, filePath);
    if (!full.startsWith(base)) throw new StorageError("Invalid path", 400);
    return full;
  }

  async getContent(filePath: string): Promise<{ content: string; sha: string; type: string }> {
    const full = this.resolve(filePath);
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory()) return { content: "", sha: "", type: "dir" };
      const bytes = await fs.readFile(full);
      return { content: bytes.toString("base64"), sha: contentHash(bytes), type: "file" };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError(`Not found: ${filePath}`, 404);
      throw e;
    }
  }

  async getTextFile(filePath: string): Promise<{ sha: string; text: string }> {
    const full = this.resolve(filePath);
    try {
      const text = await fs.readFile(full, "utf-8");
      return { sha: contentHash(text), text };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError(`Not found: ${filePath}`, 404);
      throw e;
    }
  }

  async getRawFile(filePath: string): Promise<{ bytes: ArrayBuffer; contentType?: string }> {
    const full = this.resolve(filePath);
    try {
      const buffer = await fs.readFile(full);
      const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      return { bytes, contentType: mimeFromPath(filePath) };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new StorageError(`Not found: ${filePath}`, 404);
      throw e;
    }
  }

  async listDirectory(dir: string): Promise<StorageDirEntry[]> {
    const full = this.resolve(dir);
    try {
      const entries = await fs.readdir(full, { withFileTypes: true });
      return Promise.all(
        entries.map(async (entry) => {
          const entryPath = `${dir}/${entry.name}`;
          if (entry.isDirectory()) return { name: entry.name, path: entryPath, sha: "", type: "dir" };
          try {
            const bytes = await fs.readFile(this.resolve(entryPath));
            return { name: entry.name, path: entryPath, sha: contentHash(bytes), type: "file", size: bytes.length };
          } catch {
            return { name: entry.name, path: entryPath, sha: "", type: "file" };
          }
        })
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }

  async listDirectoryTextFiles(dir: string, extension = ".md"): Promise<StorageTextEntry[]> {
    const full = this.resolve(dir);
    try {
      const entries = await fs.readdir(full, { withFileTypes: true });
      return Promise.all(
        entries
          .filter((e) => e.isFile() && e.name.endsWith(extension))
          .map(async (entry) => {
            const filePath = `${dir}/${entry.name}`;
            try {
              const text = await fs.readFile(this.resolve(filePath), "utf-8");
              return { name: entry.name, path: filePath, sha: contentHash(text), text };
            } catch {
              return { name: entry.name, path: filePath, sha: "", text: null };
            }
          })
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }

  async putFile(filePath: string, content: string, _message: string, sha?: string): Promise<{ sha: string }> {
    const full = this.resolve(filePath);
    if (sha) {
      try {
        const existing = await fs.readFile(full, "utf-8");
        if (contentHash(existing) !== sha) throw new StorageError("File changed since last read — reload before saving.", 409);
      } catch (e) {
        if (e instanceof StorageError) throw e;
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    await fs.mkdir(nodePath.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf-8");
    return { sha: contentHash(content) };
  }

  async putBase64File(filePath: string, base64Content: string, _message: string, sha?: string): Promise<{ sha: string }> {
    const full = this.resolve(filePath);
    const bytes = Buffer.from(base64Content, "base64");
    if (sha) {
      try {
        const existing = await fs.readFile(full);
        if (contentHash(existing) !== sha) throw new StorageError("File changed since last read — reload before saving.", 409);
      } catch (e) {
        if (e instanceof StorageError) throw e;
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
    await fs.mkdir(nodePath.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return { sha: contentHash(bytes) };
  }

  async deleteFile(filePath: string, _message: string, _sha: string): Promise<void> {
    const full = this.resolve(filePath);
    try {
      await fs.unlink(full);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }

  async commitFiles(files: { path: string; content?: string; encoding?: "utf-8" | "base64"; delete?: boolean }[], _message: string): Promise<{ commit: string; files: number } | null> {
    if (!files.length) return null;
    for (const file of files) {
      const full = this.resolve(file.path);
      if (file.delete) {
        try {
          await fs.unlink(full);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
        continue;
      }
      await fs.mkdir(nodePath.dirname(full), { recursive: true });
      if (file.encoding === "base64") {
        await fs.writeFile(full, Buffer.from(file.content ?? "", "base64"));
      } else {
        await fs.writeFile(full, file.content ?? "", "utf-8");
      }
    }
    return { commit: "local", files: files.length };
  }

  async ensureFile(filePath: string, content: string, message: string): Promise<void> {
    const full = this.resolve(filePath);
    try {
      await fs.access(full);
    } catch {
      await this.putFile(filePath, content, message);
    }
  }

  async listFileCommits(_filePath: string, _perPage?: number): Promise<StorageCommit[]> {
    return [];
  }

  async listRecentCommits(_perPage?: number): Promise<StorageCommit[]> {
    return [];
  }

  async initializeRepo(campaign: Campaign): Promise<void> {
    await this.ensureFile("README.md", repoReadme(campaign.name), "");
    await this.ensureFile("wiki/campaign.yaml", campaignYaml(campaign.name, campaign.gameType as GameType), "");
    await this.ensureFile("wiki/pages/.gitkeep", "", "");
    await this.ensureFile("wiki/search/index.json", "[]\n", "");
    await this.ensureFile("wiki/media/.gitkeep", "", "");
    await this.ensureFile("wiki/media/media.json", "{}\n", "");
    await this.ensureFile("wiki/imports/characters/.gitkeep", "", "");
    for (const def of packFor(campaign.gameType)) {
      await this.ensureFile(
        `wiki/templates/${campaign.gameType}/${def.slug}.md`,
        serializePage(def.frontmatter, def.body),
        ""
      );
    }
    for (const page of starterPages(campaign.name)) {
      await this.ensureFile(
        `wiki/pages/${page.slug}.md`,
        serializePage(page.frontmatter, page.body),
        ""
      );
    }
  }
}

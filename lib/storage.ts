import type { Campaign } from "@/lib/types";
import { getCampaignRepositoryToken } from "@/lib/db";

export interface StorageDirEntry {
  name: string;
  path: string;
  sha: string;
  type: string;
  size?: number;
  downloadUrl?: string;
}

export interface StorageTextEntry {
  name: string;
  path: string;
  sha: string;
  text: string | null;
}

export interface StorageCommit {
  sha: string;
  url: string;
  message: string;
  author: string;
  date: string;
}

export interface StorageAdapter {
  readonly isLocal: boolean;

  getContent(filePath: string): Promise<{ content: string; sha: string; type: string }>;
  getTextFile(filePath: string): Promise<{ sha: string; text: string }>;
  getRawFile(filePath: string): Promise<{ bytes: ArrayBuffer; contentType?: string }>;
  listDirectory(dir: string): Promise<StorageDirEntry[]>;
  listDirectoryTextFiles(dir: string, extension?: string): Promise<StorageTextEntry[]>;

  putFile(filePath: string, content: string, message: string, sha?: string): Promise<{ sha: string }>;
  putBase64File(filePath: string, base64Content: string, message: string, sha?: string): Promise<{ sha: string }>;
  deleteFile(filePath: string, message: string, sha: string): Promise<void>;
  commitFiles(files: { path: string; content: string; encoding?: "utf-8" | "base64" }[], message: string): Promise<{ commit: string; files: number } | null>;
  ensureFile(filePath: string, content: string, message: string): Promise<void>;

  listFileCommits(filePath: string, perPage?: number): Promise<StorageCommit[]>;
  listRecentCommits(perPage?: number): Promise<StorageCommit[]>;

  initializeRepo(campaign: Campaign): Promise<void>;
}

export class StorageError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StorageError";
    this.status = status;
  }
}

export function isNotFoundError(e: unknown): boolean {
  if (e instanceof StorageError && e.status === 404) return true;
  const ge = e as any;
  if (ge && typeof ge.status === "number" && ge.status === 404) return true;
  return false;
}

export function isConflictError(e: unknown): boolean {
  if (e instanceof StorageError && e.status === 409) return true;
  const ge = e as any;
  if (ge && typeof ge.status === "number" && ge.status === 409) return true;
  return false;
}

export function getStorageAdapter(campaign: Campaign, userToken?: string | null): StorageAdapter | null {
  if (campaign.storageBackend === "local") {
    if (!campaign.localPath) return null;
    // Lazy require to avoid pulling node:fs into client bundles.
    const { LocalFolderAdapter } = require("./storage-local") as typeof import("./storage-local");
    return new LocalFolderAdapter(campaign.localPath);
  }
  const token = userToken ?? getCampaignRepositoryToken(campaign.id);
  if (!token) return null;
  const { GitHubAdapter } = require("./storage-github") as typeof import("./storage-github");
  return new GitHubAdapter(token, campaign);
}

import type { Campaign } from "@/lib/types";
import type { StorageAdapter, StorageCommit, StorageDirEntry, StorageTextEntry } from "@/lib/storage";
import {
  getContent, getTextFile, getRawFile, putFile, putBase64File, deleteFile,
  listDirectory, listDirectoryTextFiles, commitFiles, ensureFile,
  listFileCommits, listRecentCommits, initializeRepo,
  type CommitFile
} from "@/lib/github";

export class GitHubAdapter implements StorageAdapter {
  readonly isLocal = false;

  constructor(private readonly token: string, private readonly campaign: Campaign) {}

  async getContent(filePath: string) {
    return getContent(this.token, this.campaign, filePath);
  }

  async getTextFile(filePath: string) {
    return getTextFile(this.token, this.campaign, filePath);
  }

  async getRawFile(filePath: string) {
    return getRawFile(this.token, this.campaign, filePath);
  }

  async listDirectory(dir: string): Promise<StorageDirEntry[]> {
    const entries = await listDirectory(this.token, this.campaign, dir);
    return entries.map((e) => ({ name: e.name, path: e.path, sha: e.sha, type: e.type }));
  }

  async listDirectoryTextFiles(dir: string, extension = ".md"): Promise<StorageTextEntry[]> {
    return listDirectoryTextFiles(this.token, this.campaign, dir, extension);
  }

  async putFile(filePath: string, content: string, message: string, sha?: string): Promise<{ sha: string }> {
    const result = (await putFile(this.token, this.campaign, filePath, content, message, sha)) as any;
    return { sha: result?.content?.sha || "" };
  }

  async putBase64File(filePath: string, base64Content: string, message: string, sha?: string): Promise<{ sha: string }> {
    const result = (await putBase64File(this.token, this.campaign, filePath, base64Content, message, sha)) as any;
    return { sha: result?.content?.sha || "" };
  }

  async deleteFile(filePath: string, message: string, sha: string): Promise<void> {
    await deleteFile(this.token, this.campaign, filePath, message, sha);
  }

  async commitFiles(files: CommitFile[], message: string) {
    return commitFiles(this.token, this.campaign, files, message);
  }

  async ensureFile(filePath: string, content: string, message: string): Promise<void> {
    await ensureFile(this.token, this.campaign, filePath, content, message);
  }

  async listFileCommits(filePath: string, perPage = 20): Promise<StorageCommit[]> {
    const commits = await listFileCommits(this.token, this.campaign, filePath, perPage);
    return commits.map((c) => ({
      sha: c.sha,
      url: c.html_url,
      message: c.commit.message.split("\n")[0],
      author: c.commit.author.name,
      date: c.commit.author.date
    }));
  }

  async listRecentCommits(perPage = 30): Promise<StorageCommit[]> {
    const commits = await listRecentCommits(this.token, this.campaign, perPage);
    return commits.map((c) => ({
      sha: c.sha,
      url: c.html_url,
      message: c.commit.message.split("\n")[0],
      author: c.commit.author.name,
      date: c.commit.author.date
    }));
  }

  async initializeRepo(campaign: Campaign): Promise<void> {
    await initializeRepo(this.token, campaign);
  }
}

import crypto from "node:crypto";
import { getAppSetting } from "@/lib/db";
import type { Campaign, GameType } from "@/lib/types";
import { campaignYaml, repoReadme, starterPages, templateDirName } from "@/lib/templates";
import { packFor } from "@/lib/template-packs";
import { serializePage } from "@/lib/markdown";
import { emptyRepositoryManifestText, repositoryManifestPath } from "@/lib/repository-manifest";

const apiBase = "https://api.github.com";
const appTokenPrefix = "github-app:";

type InstallationToken = {
  token: string;
  expiresAt: number;
};

export type GitHubAppManifestConversion = {
  id: number;
  slug: string;
  pem: string;
  webhook_secret?: string;
};

const installationTokenCache = new Map<string, InstallationToken>();

export class GitHubError extends Error {
  constructor(message: string, public status?: number, public rateLimit?: GitHubRateLimit) {
    super(message);
  }
}

export type GitHubRateLimit = {
  limit?: string | null;
  remaining?: string | null;
  reset?: string | null;
};

type GitTreeEntry = {
  path: string;
  mode?: string;
  type: string;
  sha: string;
  size?: number;
  url?: string;
};

type GitTreeResponse = {
  sha: string;
  url?: string;
  tree: GitTreeEntry[];
  truncated: boolean;
};

const repositoryTreeCache = new Map<string, GitTreeEntry[]>();

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function githubAppConfig() {
  const appId = process.env.GITHUB_APP_ID || getAppSetting("github_app_id");
  const slug = process.env.GITHUB_APP_SLUG || getAppSetting("github_app_slug");
  const privateKey = (process.env.GITHUB_APP_PRIVATE_KEY || getAppSetting("github_app_private_key"))?.replace(/\\n/g, "\n");
  if (!appId || !slug || !privateKey) return null;
  return { appId, slug, privateKey };
}

function githubAppJwt() {
  const config = githubAppConfig();
  if (!config) throw new GitHubError("GitHub App is not configured.", 400);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: config.appId }));
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${payload}`).sign(config.privateKey, "base64url");
  return `${header}.${payload}.${signature}`;
}

function installationId(token: string) {
  return token.startsWith(appTokenPrefix) ? token.slice(appTokenPrefix.length) : "";
}

export function isGitHubAppConnection(token?: string | null) {
  return Boolean(token?.startsWith(appTokenPrefix));
}

export function isGitHubAppConfigured() {
  return Boolean(githubAppConfig());
}

export function githubAppInstallUrl(state: string) {
  const config = githubAppConfig();
  if (!config) return null;
  return `https://github.com/apps/${config.slug}/installations/new?state=${encodeURIComponent(state)}`;
}

export function githubAppConnectionToken(installation: string | number) {
  return `${appTokenPrefix}${installation}`;
}

export async function convertGitHubAppManifest(code: string) {
  return gh<GitHubAppManifestConversion>("", `/app-manifests/${encodeURIComponent(code)}/conversions`, { method: "POST" }, false);
}

async function appInstallationAccessToken(token: string) {
  const id = installationId(token);
  if (!id) return token;
  const cached = installationTokenCache.get(id);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const jwt = githubAppJwt();
  const response = await gh<{ token: string; expires_at: string }>(jwt, `/app/installations/${id}/access_tokens`, { method: "POST" }, false);
  installationTokenCache.set(id, { token: response.token, expiresAt: new Date(response.expires_at).getTime() });
  return response.token;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function gh<T>(token: string, path: string, init: RequestInit = {}, resolveAppToken = true): Promise<T> {
  const authToken = resolveAppToken ? await appInstallationAccessToken(token) : token;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...((init.headers as Record<string, string> | undefined) || {})
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  // GitHub's secondary rate limit is burst/concurrency based and comes back as
  // 429 (or 403 with a "secondary rate limit" body). Honor Retry-After when
  // present, otherwise back off exponentially with jitter. Each wait is capped
  // so a request never hangs for long; the real fix for bulk work is batching.
  const maxRetries = 4;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${apiBase}${path}`, {
      ...init,
      headers,
      // Never let Next's Data Cache serve a stale repo read: in a production
      // build a cached directory/file listing would hide a just-saved page.
      cache: "no-store"
    });
    if (res.ok) {
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    }
    const text = await res.text();
    const rateLimit: GitHubRateLimit = {
      limit: res.headers.get("x-ratelimit-limit"),
      remaining: res.headers.get("x-ratelimit-remaining"),
      reset: res.headers.get("x-ratelimit-reset")
    };
    const retryAfter = Number(res.headers.get("retry-after"));
    const remaining = rateLimit.remaining;
    const rateLimited =
      res.status === 429 ||
      (res.status === 403 && (retryAfter > 0 || remaining === "0" || /secondary rate limit|rate limit/i.test(text)));
    if (rateLimited && attempt < maxRetries) {
      const backoff = Math.min(30_000, 1000 * 2 ** attempt);
      const waitMs = (retryAfter > 0 ? Math.min(retryAfter * 1000, 30_000) : backoff) + Math.floor(Math.random() * 1000);
      await sleep(waitMs);
      continue;
    }
    throw new GitHubError(text || res.statusText, res.status, rateLimit);
  }
}

async function ghGraphql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const result = await gh<{ data?: T; errors?: Array<{ message: string }> }>(token, "/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables })
  });
  if (result.errors?.length) throw new GitHubError(result.errors.map((error) => error.message).join("; "), 400);
  if (!result.data) throw new GitHubError("GitHub GraphQL returned no data.", 502);
  return result.data;
}

export async function getViewer(token: string) {
  if (isGitHubAppConnection(token)) {
    const id = installationId(token);
    return { login: `GitHub App installation ${id}` };
  }
  return gh<{ login: string }>(token, "/user");
}

export async function getInstallationRepositories(token: string) {
  return gh<{ repositories: Array<{ full_name: string }> }>(token, "/installation/repositories");
}

export async function createRepo(token: string, name: string, isPrivate = true) {
  if (isGitHubAppConnection(token)) {
    throw new GitHubError("GitHub App connections can connect existing repos, but creating a new repo still requires a GitHub token.", 400);
  }
  return gh<{ name: string; owner: { login: string }; default_branch: string }>(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({ name, private: isPrivate, auto_init: true })
  });
}

export async function getContent(token: string, campaign: Pick<Campaign, "owner" | "repo" | "branch">, filePath: string) {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  return gh<{ content: string; sha: string; type: string }>(token, `/repos/${campaign.owner}/${campaign.repo}/contents/${encoded}?ref=${campaign.branch}`);
}

export async function getContentAtRef(token: string, campaign: Pick<Campaign, "owner" | "repo">, filePath: string, ref: string) {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  return gh<{ content: string; sha: string; type: string }>(token, `/repos/${campaign.owner}/${campaign.repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`);
}

export async function getRawFile(token: string, campaign: Pick<Campaign, "owner" | "repo" | "branch">, filePath: string) {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  const authToken = await appInstallationAccessToken(token);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${apiBase}/repos/${campaign.owner}/${campaign.repo}/contents/${encoded}?ref=${campaign.branch}`, {
    headers,
    cache: "no-store"
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GitHubError(text || res.statusText, res.status);
  }
  return {
    bytes: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") || undefined
  };
}

export async function getTextFile(token: string, campaign: Campaign, filePath: string) {
  const item = await getContent(token, campaign, filePath);
  if (!item.content) {
    const raw = await getRawFile(token, campaign, filePath);
    return {
      sha: item.sha,
      text: Buffer.from(raw.bytes).toString("utf8")
    };
  }
  return {
    sha: item.sha,
    text: Buffer.from(item.content, "base64").toString("utf8")
  };
}

function normalizeDir(dir: string) {
  return dir.replace(/^\/+|\/+$/g, "");
}

function treeCacheKey(campaign: Pick<Campaign, "owner" | "repo" | "branch">, treeSha: string) {
  return `${campaign.owner}/${campaign.repo}:${campaign.branch}:${treeSha}`;
}

async function getBranchTreeSha(token: string, campaign: Pick<Campaign, "owner" | "repo" | "branch">) {
  const branch = encodeURIComponent(campaign.branch);
  const data = await gh<{ commit: { sha: string; commit: { tree: { sha: string } } } }>(
    token,
    `/repos/${campaign.owner}/${campaign.repo}/branches/${branch}`
  );
  return {
    commitSha: data.commit.sha,
    treeSha: data.commit.commit.tree.sha
  };
}

async function getGitTree(token: string, campaign: Pick<Campaign, "owner" | "repo">, treeSha: string, recursive = false) {
  const query = recursive ? "?recursive=1" : "";
  return gh<GitTreeResponse>(token, `/repos/${campaign.owner}/${campaign.repo}/git/trees/${encodeURIComponent(treeSha)}${query}`);
}

async function walkSubtrees(
  token: string,
  campaign: Pick<Campaign, "owner" | "repo">,
  treeSha: string,
  prefix = "",
  seen = new Set<string>()
): Promise<GitTreeEntry[]> {
  if (seen.has(treeSha)) return [];
  seen.add(treeSha);

  const response = await getGitTree(token, campaign, treeSha, false);
  if (response.truncated) {
    throw new GitHubError(
      "This repository is too large to index safely. CampaignRepo received a truncated Git tree while walking repository subtrees.",
      502
    );
  }

  const entries: GitTreeEntry[] = [];
  for (const entry of response.tree) {
    const fullPath = `${prefix}${entry.path}`;
    const normalized = { ...entry, path: fullPath };
    entries.push(normalized);
    if (entry.type === "tree") {
      entries.push(...(await walkSubtrees(token, campaign, entry.sha, `${fullPath}/`, seen)));
    }
  }
  return entries;
}

export async function getRepositoryTreeEntries(token: string, campaign: Pick<Campaign, "owner" | "repo" | "branch">) {
  const { treeSha } = await getBranchTreeSha(token, campaign);
  const key = treeCacheKey(campaign, treeSha);
  const cached = repositoryTreeCache.get(key);
  if (cached) return cached;

  const response = await getGitTree(token, campaign, treeSha, true);
  const entries = response.truncated ? await walkSubtrees(token, campaign, treeSha) : response.tree;
  repositoryTreeCache.set(key, entries);
  return entries;
}

export function clearRepositoryTreeCacheForTests() {
  repositoryTreeCache.clear();
}

export function clearRepositoryTreeCache(campaign: Pick<Campaign, "owner" | "repo" | "branch">) {
  const prefix = `${campaign.owner}/${campaign.repo}:${campaign.branch}:`;
  for (const key of repositoryTreeCache.keys()) {
    if (key.startsWith(prefix)) repositoryTreeCache.delete(key);
  }
}

export async function putFile(token: string, campaign: Pick<Campaign, "owner" | "repo" | "branch">, filePath: string, content: string, message: string, sha?: string) {
  return putBase64File(token, campaign, filePath, Buffer.from(content, "utf8").toString("base64"), message, sha);
}

export async function putBase64File(token: string, campaign: Pick<Campaign, "owner" | "repo" | "branch">, filePath: string, base64Content: string, message: string, sha?: string) {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  return gh(token, `/repos/${campaign.owner}/${campaign.repo}/contents/${encoded}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: base64Content,
      branch: campaign.branch,
      sha
    })
  });
}

export async function deleteFile(token: string, campaign: Pick<Campaign, "owner" | "repo" | "branch">, filePath: string, message: string, sha: string) {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  return gh(token, `/repos/${campaign.owner}/${campaign.repo}/contents/${encoded}`, {
    method: "DELETE",
    body: JSON.stringify({
      message,
      branch: campaign.branch,
      sha
    })
  });
}

export async function listDirectory(token: string, campaign: Campaign, dir: string) {
  const directory = normalizeDir(dir);
  const prefix = directory ? `${directory}/` : "";
  const entries = await getRepositoryTreeEntries(token, campaign);
  return entries
    .filter((entry) => {
      if (!entry.path.startsWith(prefix)) return false;
      const rest = entry.path.slice(prefix.length);
      return Boolean(rest) && !rest.includes("/");
    })
    .map((entry) => ({
      name: entry.path.slice(prefix.length),
      path: entry.path,
      sha: entry.sha,
      type: entry.type === "blob" ? "file" : entry.type === "tree" ? "dir" : entry.type,
      size: entry.size
    }));
}

export async function listDirectoryTextFiles(token: string, campaign: Campaign, dir: string, extension = ".md") {
  const directory = normalizeDir(dir);
  const prefix = directory ? `${directory}/` : "";
  const entries = await getRepositoryTreeEntries(token, campaign);
  return entries
    .filter((entry) => {
      if (entry.type !== "blob" || !entry.path.endsWith(extension) || !entry.path.startsWith(prefix)) return false;
      const rest = entry.path.slice(prefix.length);
      return Boolean(rest) && !rest.includes("/");
    })
    .map((entry) => ({
      name: entry.path.slice(prefix.length),
      path: entry.path,
      sha: entry.sha,
      text: null
    }));
}

/** Run an async map with a bounded number of in-flight tasks (keeps bursts of
 *  concurrent GitHub reads/writes from tripping the secondary rate limit). */
export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, worker));
  return results;
}

export type CommitFile = { path: string; content?: string; encoding?: "utf-8" | "base64"; delete?: boolean };

/**
 * Write many files in a SINGLE commit via the Git Data API
 * (blobs → tree → commit → ref). This replaces one Contents-API commit per
 * file — the pattern that trips GitHub's secondary rate limit on bulk imports.
 * Blob creation is concurrency-limited; everything else is a handful of calls.
 */
export async function commitFiles(
  token: string,
  campaign: Pick<Campaign, "owner" | "repo" | "branch">,
  files: CommitFile[],
  message: string
) {
  if (!files.length) return null;
  const repoBase = `/repos/${campaign.owner}/${campaign.repo}`;
  const branch = encodeURIComponent(campaign.branch);

  const ref = await gh<{ object: { sha: string } }>(token, `${repoBase}/git/ref/heads/${branch}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await gh<{ tree: { sha: string } }>(token, `${repoBase}/git/commits/${baseCommitSha}`);

  const tree = await mapWithConcurrency(files, 5, async (file) => {
    if (file.delete) {
      return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: null };
    }
    const blob = await gh<{ sha: string }>(token, `${repoBase}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: file.content ?? "", encoding: file.encoding === "base64" ? "base64" : "utf-8" })
    });
    return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: blob.sha };
  });

  const newTree = await gh<{ sha: string }>(token, `${repoBase}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree })
  });
  const commit = await gh<{ sha: string }>(token, `${repoBase}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] })
  });
  await gh(token, `${repoBase}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha })
  });
  return { commit: commit.sha, files: files.length };
}

export async function ensureFile(token: string, campaign: Campaign, filePath: string, content: string, message: string) {
  try {
    const existing = await getContent(token, campaign, filePath);
    return existing;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) {
      return putFile(token, campaign, filePath, content, message);
    }
    throw error;
  }
}

export type GitHubCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } };
};

export async function listFileCommits(
  token: string,
  campaign: Pick<Campaign, "owner" | "repo" | "branch">,
  filePath: string,
  perPage = 20
): Promise<GitHubCommit[]> {
  const path = `/repos/${campaign.owner}/${campaign.repo}/commits?path=${encodeURIComponent(filePath)}&sha=${encodeURIComponent(campaign.branch)}&per_page=${perPage}`;
  return gh<GitHubCommit[]>(token, path);
}

export async function listRecentCommits(
  token: string,
  campaign: Pick<Campaign, "owner" | "repo" | "branch">,
  perPage = 30
): Promise<GitHubCommit[]> {
  const path = `/repos/${campaign.owner}/${campaign.repo}/commits?sha=${encodeURIComponent(campaign.branch)}&per_page=${perPage}`;
  return gh<GitHubCommit[]>(token, path);
}

export async function getFileAtCommit(
  token: string,
  campaign: Pick<Campaign, "owner" | "repo">,
  filePath: string,
  sha: string
): Promise<string> {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  const authToken = await appInstallationAccessToken(token);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${apiBase}/repos/${campaign.owner}/${campaign.repo}/contents/${encoded}?ref=${encodeURIComponent(sha)}`, {
    headers,
    cache: "no-store"
  });
  if (!res.ok) throw new GitHubError(await res.text(), res.status);
  return res.text();
}

export async function initializeRepo(token: string, campaign: Campaign) {
  await ensureFile(token, campaign, "README.md", repoReadme(campaign.name), "CampaignRepo: add README");
  await ensureFile(token, campaign, "wiki/campaign.yaml", campaignYaml(campaign.name, campaign.gameType as GameType), "CampaignRepo: add campaign config");
  await ensureFile(token, campaign, "wiki/pages/.gitkeep", "", "CampaignRepo: add pages folder");
  await ensureFile(token, campaign, "wiki/search/index.json", "[]\n", "CampaignRepo: add search snapshot");
  // New repos start with a valid (empty) navigation manifest, so the indexed
  // path works from the first page onward.
  await ensureFile(token, campaign, repositoryManifestPath, emptyRepositoryManifestText(), "CampaignRepo: add repository index");
  await ensureFile(token, campaign, "wiki/media/.gitkeep", "", "CampaignRepo: add media folder");
  await ensureFile(token, campaign, "wiki/media/media.json", "{}\n", "CampaignRepo: add media metadata");
  await ensureFile(token, campaign, "wiki/imports/characters/.gitkeep", "", "CampaignRepo: add imports folder");
  for (const def of packFor(campaign.gameType)) {
    await ensureFile(
      token,
      campaign,
      `wiki/templates/${templateDirName(campaign.gameType)}/${def.slug}.md`,
      serializePage(def.frontmatter, def.body),
      `CampaignRepo: add ${campaign.gameType} ${def.slug} template`
    );
  }
  for (const page of starterPages(campaign.name)) {
    await ensureFile(
      token,
      campaign,
      `wiki/pages/${page.slug}.md`,
      serializePage(page.frontmatter, page.body),
      `CampaignRepo: add getting-started page`
    );
  }
}

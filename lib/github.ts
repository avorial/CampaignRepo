import crypto from "node:crypto";
import { getAppSetting } from "@/lib/db";
import type { Campaign, GameType } from "@/lib/types";
import { campaignYaml, repoReadme, starterPages } from "@/lib/templates";
import { packFor } from "@/lib/template-packs";
import { serializePage } from "@/lib/markdown";

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
  constructor(message: string, public status?: number) {
    super(message);
  }
}

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
    const retryAfter = Number(res.headers.get("retry-after"));
    const remaining = res.headers.get("x-ratelimit-remaining");
    const rateLimited =
      res.status === 429 ||
      (res.status === 403 && (retryAfter > 0 || remaining === "0" || /secondary rate limit|rate limit/i.test(text)));
    if (rateLimited && attempt < maxRetries) {
      const backoff = Math.min(30_000, 1000 * 2 ** attempt);
      const waitMs = (retryAfter > 0 ? Math.min(retryAfter * 1000, 30_000) : backoff) + Math.floor(Math.random() * 1000);
      await sleep(waitMs);
      continue;
    }
    throw new GitHubError(text || res.statusText, res.status);
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
  return {
    sha: item.sha,
    text: Buffer.from(item.content, "base64").toString("utf8")
  };
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
  const encoded = dir.split("/").map(encodeURIComponent).join("/");
  try {
    return await gh<Array<{ name: string; path: string; sha: string; type: string }>>(token, `/repos/${campaign.owner}/${campaign.repo}/contents/${encoded}?ref=${campaign.branch}`);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return [];
    throw error;
  }
}

/**
 * Read every text file in one directory with a single GraphQL request.
 * This avoids one REST request per wiki page when warming the local cache.
 */
export async function listDirectoryTextFiles(token: string, campaign: Campaign, dir: string, extension = ".md") {
  type TreeResult = {
    repository: {
      object: {
        entries: Array<{
          name: string;
          type: string;
          oid: string;
          object?: { text?: string | null } | null;
        }>;
      } | null;
    } | null;
  };
  const data = await ghGraphql<TreeResult>(
    token,
    `query DirectoryTextFiles($owner: String!, $repo: String!, $expression: String!) {
      repository(owner: $owner, name: $repo) {
        object(expression: $expression) {
          ... on Tree {
            entries {
              name
              type
              oid
              object { ... on Blob { text } }
            }
          }
        }
      }
    }`,
    { owner: campaign.owner, repo: campaign.repo, expression: `${campaign.branch}:${dir}` }
  );
  const entries = data.repository?.object?.entries || [];
  return entries
    .filter((entry) => entry.type === "blob" && entry.name.endsWith(extension))
    .map((entry) => ({
      name: entry.name,
      path: `${dir}/${entry.name}`,
      sha: entry.oid,
      text: entry.object?.text ?? null
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

export type CommitFile = { path: string; content: string; encoding?: "utf-8" | "base64" };

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
    const blob = await gh<{ sha: string }>(token, `${repoBase}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: file.content, encoding: file.encoding === "base64" ? "base64" : "utf-8" })
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
  await ensureFile(token, campaign, "wiki/media/.gitkeep", "", "CampaignRepo: add media folder");
  await ensureFile(token, campaign, "wiki/media/media.json", "{}\n", "CampaignRepo: add media metadata");
  await ensureFile(token, campaign, "wiki/imports/characters/.gitkeep", "", "CampaignRepo: add imports folder");
  for (const def of packFor(campaign.gameType)) {
    await ensureFile(
      token,
      campaign,
      `wiki/templates/${campaign.gameType}/${def.slug}.md`,
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

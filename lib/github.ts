import crypto from "node:crypto";
import { getAppSetting } from "@/lib/db";
import type { Campaign, GameType } from "@/lib/types";
import { campaignYaml, repoReadme } from "@/lib/templates";
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
  webhook_secret: string;
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

async function gh<T>(token: string, path: string, init: RequestInit = {}, resolveAppToken = true): Promise<T> {
  const authToken = resolveAppToken ? await appInstallationAccessToken(token) : token;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...((init.headers as Record<string, string> | undefined) || {})
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GitHubError(text || res.statusText, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
}

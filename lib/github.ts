import type { Campaign, GameType } from "@/lib/types";
import { campaignYaml, repoReadme } from "@/lib/templates";
import { packFor } from "@/lib/template-packs";
import { serializePage } from "@/lib/markdown";

const apiBase = "https://api.github.com";

export class GitHubError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GitHubError(text || res.statusText, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function getViewer(token: string) {
  return gh<{ login: string }>(token, "/user");
}

export async function createRepo(token: string, name: string, isPrivate = true) {
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
  await ensureFile(token, campaign, "wiki/search/index.json", "[]\n", "CampaignRepo: add search snapshot");
  await ensureFile(token, campaign, "wiki/media/.gitkeep", "", "CampaignRepo: add media folder");
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

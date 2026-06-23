"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import type { ApiToken, Campaign, GameType, User } from "@/lib/types";

// Third-party game-system marks (cleaned, transparent) shown on a light plate;
// Custom has no logo and falls back to its gold initial.
const gameLogos: Record<string, string> = {
  "Sword Chronicle": "/brand/sword-chronicle.png",
  "Dungeons & Dragons": "/brand/dungeons-and-dragons.png",
  "World of Darkness": "/brand/world-of-darkness.png",
  Traveller: "/brand/traveller.png"
};

export default function DashboardClient({
  user,
  campaigns,
  gameTypes,
  githubAppConfigured
}: {
  user: User;
  campaigns: Campaign[];
  gameTypes: GameType[];
  categories: { id: string; label: string }[];
  githubAppConfigured: boolean;
}) {
  const [message, setMessage] = useState("");
  const [repos, setRepos] = useState<Campaign[]>(campaigns);
  const isGitHubApp = Boolean(user.githubToken?.startsWith("github-app:"));
  const [mode, setMode] = useState<"create" | "connect">(isGitHubApp ? "connect" : "create");
  const [buildError, setBuildError] = useState("");
  const [search, setSearch] = useState<any[]>([]);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newToken, setNewToken] = useState("");
  const [reviewGroups, setReviewGroups] = useState<any[]>([]);
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";
  const githubConnection = user.githubToken?.startsWith("github-app:") ? "GitHub App" : user.githubToken ? "Manual token" : "Not connected";
  const githubConnected = Boolean(user.githubToken);
  const githubUser = user.githubToken?.startsWith("github-app:") ? "Avorial" : user.githubToken ? "GitHub token user" : "";

  useEffect(() => {
    fetch("/api/tokens")
      .then((res) => res.json())
      .then((data) => setTokens(data.tokens || []));
    fetch("/api/reviews")
      .then((res) => res.json())
      .then((data) => setReviewGroups(data.campaigns || []));
  }, []);

  async function mintToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = new FormData(form).get("tokenName");
    const res = await fetch("/api/tokens", { method: "POST", body: JSON.stringify({ name }) });
    const data = await res.json();
    if (res.ok) {
      setTokens(data.tokens || []);
      setNewToken(data.token?.token || "");
      form.reset();
    } else {
      setMessage(data.error || "Could not create token.");
    }
  }

  async function revokeToken(id: number) {
    const res = await fetch("/api/tokens", { method: "DELETE", body: JSON.stringify({ id }) });
    const data = await res.json();
    if (res.ok) setTokens(data.tokens || []);
  }

  async function connectGithub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = new FormData(event.currentTarget).get("token");
    const res = await fetch("/api/github/connect", { method: "POST", body: JSON.stringify({ token }) });
    const data = await res.json();
    setMessage(res.ok ? `Connected GitHub as ${data.login}.` : data.error || "GitHub connection failed.");
  }

  async function buildRepo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      body: JSON.stringify({
        mode,
        name: form.get("name"),
        owner: form.get("owner") || undefined,
        repo: form.get("repo"),
        branch: form.get("branch") || "main",
        gameType: form.get("gameType"),
        private: form.get("private") === "on"
      })
    });
    const data = await res.json();
    if (res.ok) window.location.href = `/campaigns/${data.campaign.id}`;
    else setBuildError(data.error || "Could not build repo.");
  }

  async function removeRepo(id: number, name: string) {
    if (!confirm(`Remove "${name}" from CampaignRepo? This disconnects the repo here — the GitHub repository is not deleted.`)) return;
    const res = await fetch("/api/campaigns", { method: "DELETE", body: JSON.stringify({ id }) });
    const data = await res.json();
    if (res.ok) {
      setRepos((current) => current.filter((campaign) => campaign.id !== id));
      setMessage(`Removed ${name}.`);
    } else {
      setMessage(data.error || "Could not remove campaign.");
    }
  }

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    const res = await fetch(`/api/search?q=${encodeURIComponent(String(q || ""))}`);
    const data = await res.json();
    setSearch(data.results || []);
  }

  return (
    <>
      <section className="band repos-band">
        <h2>Connected repos</h2>
        <div className="repo-grid">
          {repos.map((campaign) => {
            const logo = gameLogos[campaign.gameType];
            return (
              <div className="repo-card" key={campaign.id}>
                <Link className="repo-card-link" href={`/campaigns/${campaign.id}`}>
                  <div className="repo-head">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <span className="repo-logo-plate"><img src={logo} alt={campaign.gameType} /></span>
                    ) : (
                      <span className="repo-logo-plate repo-logo-initial" aria-hidden>{campaign.gameType.charAt(0).toUpperCase()}</span>
                    )}
                    <strong>{campaign.name}</strong>
                  </div>
                  <span>{campaign.owner}/{campaign.repo}</span>
                  <small>{campaign.gameType} · {campaign.branch} · {campaign.role}</small>
                </Link>
                {campaign.role === "owner" && (
                  <button type="button" className="repo-remove danger" onClick={() => removeRepo(campaign.id, campaign.name)}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
          {!repos.length && <p className="muted">No campaign repos connected yet.</p>}
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <h2>GitHub connection</h2>
          {githubConnected ? (
            <div className="connection-status">
              <strong>Currently connected</strong>
              <span>User {githubUser}</span>
              <small>{githubConnection} access active for {user.email}</small>
            </div>
          ) : (
            <p className="muted">Signed in as {user.email}. GitHub is not connected yet.</p>
          )}
          {!githubConnected && (
            githubAppConfigured ? (
              <div className="stack">
                <p className="muted">Install the GitHub App on the repos CampaignRepo can manage. This avoids storing a personal SSH key or broad personal token.</p>
                <a className="button" href="/api/github/app/start">Install GitHub App access</a>
              </div>
            ) : (
              <div className="setup-callout">
                <strong>Connect GitHub with a GitHub App.</strong>
                <span>This creates a CampaignRepo GitHub App, stores its generated credentials in this server, then lets you choose the repos it can access.</span>
                <a className="button" href="/api/github/app/manifest/start">
                  Connect GitHub
                </a>
              </div>
            )
          )}
          <details className="troubleshooting">
            <summary>Connection troubleshooting</summary>
            {githubAppConfigured ? (
              <a className="button secondary" href="/api/github/app/start">Install or update GitHub App access</a>
            ) : (
              <a className="button secondary" href="/api/github/app/manifest/start">Rebuild GitHub App connection</a>
            )}
            <form onSubmit={connectGithub} className="stack">
              <label>Manual GitHub token fallback<input name="token" type="password" placeholder="github_pat_..." /></label>
              <button>Connect token</button>
            </form>
            <p className="muted">Token needs repository contents read/write access. Use this only for testing, repo creation, or repairing the GitHub App connection.</p>
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
              Create token instead
            </a>
          </details>
        </div>

        <div className="panel">
          <h2>Build Campaign Repo</h2>
          <div className="segmented">
            <button
              type="button"
              className={mode === "create" ? "active" : ""}
              disabled={isGitHubApp}
              title={isGitHubApp ? "GitHub App access can't create repos — add a manual token to enable this" : undefined}
              onClick={() => { setMode("create"); setBuildError(""); }}
            >
              {isGitHubApp && <Lock size={11} aria-hidden style={{ marginRight: 5 }} />}Create repo
            </button>
            <button type="button" className={mode === "connect" ? "active" : ""} onClick={() => { setMode("connect"); setBuildError(""); }}>Connect repo</button>
          </div>
          {isGitHubApp && (
            <div className="setup-callout callout-warn">
              <strong><Lock size={13} aria-hidden style={{ marginRight: 6, verticalAlign: "-2px" }} />Creating repos is locked</strong>
              <span>You&apos;re connected via the <strong>GitHub App</strong>, which can <strong>connect existing repos</strong> but can&apos;t create new ones. Make the repo at <a href="https://github.com/new" target="_blank" rel="noreferrer">github.com/new</a>, then use <button type="button" className="linklike" onClick={() => { setMode("connect"); setBuildError(""); }}>Connect repo</button> — or add a manual GitHub token under <em>Connection troubleshooting</em> to unlock creation.</span>
            </div>
          )}
          <form onSubmit={buildRepo} className="stack">
            <label>Campaign name<input name="name" required placeholder="The Jardin File" /></label>
            {mode === "connect" && <label>Owner<input name="owner" placeholder="avorial (optional if pasting URL)" /></label>}
            <label>{mode === "connect" ? "Repo name or URL" : "Repo name"}<input name="repo" required placeholder={mode === "connect" ? "kdwiki or https://github.com/avorial/kdwiki" : "jardin-campaign"} /></label>
            <label>Branch<input name="branch" defaultValue="main" /></label>
            <label>Game template pack<select name="gameType">{gameTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            {mode === "create" && <label className="check"><input type="checkbox" name="private" defaultChecked /> Private repo</label>}
            <button disabled={isGitHubApp && mode === "create"}>{mode === "create" ? "Create and initialize" : "Connect and repair"}</button>
            {buildError && <p className="error">{buildError}</p>}
          </form>
        </div>

        <div className="panel">
          <h2>MCP access tokens</h2>
          <p className="muted">Connect an external AI/MCP client to <code>{mcpUrl}</code> with an <code>Authorization: Bearer</code> token.</p>
          <form onSubmit={mintToken} className="inline-form">
            <input name="tokenName" placeholder="Claude Desktop" />
            <button>Mint token</button>
          </form>
          {newToken && (
            <p className="muted">Copy now (shown once): <code>{newToken}</code></p>
          )}
          <div className="results">
            {tokens.map((token) => (
              <div key={token.id} className="token-row">
                <span><strong>{token.name}</strong> · last used {token.lastUsedAt || "never"}</span>
                <button type="button" onClick={() => revokeToken(token.id)}>Revoke</button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Search all repos</h2>
          <form onSubmit={runSearch} className="inline-form">
            <input name="q" placeholder="Jardin, SolSec, rumor..." />
            <button>Search</button>
          </form>
          <div className="results">
            {search.map((row) => (
              <a key={row.id} href={row.category === "media" ? `/campaigns/${row.campaignId}#media` : `/campaigns/${row.campaignId}/pages/${row.slug}`}>
                <strong>{row.title}</strong><span>{row.campaignName} · {row.category}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {reviewGroups.length > 0 && (
        <section className="band">
          <h2>Review unapproved changes</h2>
          <p className="muted">AI- and import-generated pages awaiting GM approval across your campaigns.</p>
          {reviewGroups.map((group) => (
            <div key={group.campaignId} className="review-group">
              <h3>{group.campaignName} <a href={`/campaigns/${group.campaignId}/admin`}>Open review queue</a></h3>
              <div className="results">
                {group.reviews.map((review: any) => (
                  <a key={review.slug} href={`/campaigns/${group.campaignId}/pages/${review.slug}`}>
                    <strong>{review.name}</strong>
                    <span>{review.category} · {review.approvalStatus}{review.sourceImport ? ` · ${review.sourceImport}` : ""}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="band instructions">
        <h2>GitHub repo instructions</h2>
        <p>CampaignRepo can create a repo for you, or connect to one you already made at <a href="https://github.com/new">github.com/new</a>.</p>
        <p>Required structure: <code>/wiki/pages</code>, <code>/wiki/media</code>, <code>/wiki/templates</code>, <code>/wiki/imports/characters</code>, <code>/wiki/search/index.json</code>, and <code>/wiki/campaign.yaml</code>.</p>
        <p>Use <code>[[Page Name]]</code> links, <code>:::gm</code> blocks for secrets, and keep frontmatter intact when editing manually.</p>
      </section>
      {message && <p className="toast">{message}</p>}
    </>
  );
}

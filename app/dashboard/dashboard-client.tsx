"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import type { AiConfig, ApiToken, Campaign, User } from "@/lib/types";
import { gameTypeGroups } from "@/lib/templates";
import { darkPlatePacks, gamePackLogos } from "@/lib/game-pack-branding";
import DemoBrowser from "./demo-browser";

type DashboardPanelState = {
  github: boolean;
  build: boolean;
  ai: boolean;
  mcp: boolean;
};

function defaultPanelState(githubConnected: boolean, repoCount: number): DashboardPanelState {
  return {
    github: false,
    build: !githubConnected && repoCount === 0,
    ai: false,
    mcp: false
  };
}

function orderCampaigns(campaigns: Campaign[], savedOrder: number[]): Campaign[] {
  if (!savedOrder.length) return campaigns;
  const rank = new Map(savedOrder.map((id, index) => [id, index]));
  return [...campaigns].sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}

export default function DashboardClient({
  user,
  campaigns,
  githubAppConfigured,
  suggestedBasePath = ""
}: {
  user: User;
  campaigns: Campaign[];
  categories: { id: string; label: string }[];
  githubAppConfigured: boolean;
  suggestedBasePath?: string;
}) {
  const githubConnected = Boolean(user.githubToken);
  const isGitHubApp = Boolean(user.githubToken?.startsWith("github-app:"));
  const defaultMode: "create" | "connect" | "local" = "local";
  const repoOrderStorageKey = `campaignrepo.dashboard.repoOrder.${user.id}`;
  const panelStorageKey = `campaignrepo.dashboard.panels.${user.id}`;
  const [message, setMessage] = useState("");
  const [repos, setRepos] = useState<Campaign[]>(() => {
    if (typeof window === "undefined") return campaigns;
    try {
      const saved = JSON.parse(localStorage.getItem(repoOrderStorageKey) || "[]") as number[];
      return orderCampaigns(campaigns, saved);
    } catch {
      return campaigns;
    }
  });
  const [mode, setMode] = useState<"create" | "connect" | "local">(defaultMode);
  const [campaignName, setCampaignName] = useState("");
  const [buildError, setBuildError] = useState("");
  const [search, setSearch] = useState<any[]>([]);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newToken, setNewToken] = useState("");
  const [reviewGroups, setReviewGroups] = useState<any[]>([]);
  const [repoView, setRepoView] = useState<"grid" | "marquee">("grid");
  const [personalAi, setPersonalAi] = useState<AiConfig>({});
  const [aiEndpoint, setAiEndpoint] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSavingSeconds, setAiSavingSeconds] = useState(0);
  const [aiDiscovering, setAiDiscovering] = useState(false);
  const [aiModels, setAiModels] = useState<string[]>([]);
  const [draggedRepoId, setDraggedRepoId] = useState<number | null>(null);
  const [dragOverRepoId, setDragOverRepoId] = useState<number | null>(null);
  const [expandedPanels, setExpandedPanels] = useState<DashboardPanelState>(() => {
    const fallback = defaultPanelState(githubConnected, campaigns.length);
    if (typeof window === "undefined") return fallback;
    try {
      const saved = JSON.parse(localStorage.getItem(panelStorageKey) || "{}") as Partial<DashboardPanelState>;
      return { ...fallback, ...saved };
    } catch {
      return fallback;
    }
  });
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";
  const githubConnection = user.githubToken?.startsWith("github-app:") ? "GitHub App" : user.githubToken ? "Manual token" : "Not connected";
  const githubUser = user.githubToken?.startsWith("github-app:") ? "Avorial" : user.githubToken ? "GitHub token user" : "";
  const suggestedLocalPath = suggestedBasePath && campaignName.trim()
    ? `${suggestedBasePath}/${campaignName.trim().replace(/[<>:"/\\|?*]/g, "-")}`
    : suggestedBasePath || "";

  const setPanelOpen = (panel: keyof typeof expandedPanels, open: boolean) => {
    setExpandedPanels((current) => {
      const next = { ...current, [panel]: open };
      try { localStorage.setItem(panelStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const persistRepoOrder = (nextRepos: Campaign[]) => {
    try { localStorage.setItem(repoOrderStorageKey, JSON.stringify(nextRepos.map((campaign) => campaign.id))); } catch { /* ignore */ }
  };

  const reorderRepo = (draggedId: number, targetId: number) => {
    if (!draggedId || draggedId === targetId) return;
    setRepos((current) => {
      const from = current.findIndex((campaign) => campaign.id === draggedId);
      const to = current.findIndex((campaign) => campaign.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persistRepoOrder(next);
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/tokens")
      .then((res) => res.json())
      .then((data) => setTokens(data.tokens || []));
    fetch("/api/reviews")
      .then((res) => res.json())
      .then((data) => setReviewGroups(data.campaigns || []));
    fetch("/api/ai-settings")
      .then((res) => res.json())
      .then((data) => {
        const config = data.config || {};
        setPersonalAi(config);
        setAiEndpoint(config.endpoint || "");
        setAiModel(config.model || "");
        setAiKey(config.apiKey || "");
      });
  }, []);

  useEffect(() => {
    if (!aiSaving) {
      setAiSavingSeconds(0);
      return;
    }
    const timer = window.setInterval(() => setAiSavingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [aiSaving]);

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
    let body: Record<string, unknown>;
    if (mode === "local") {
      body = { mode: "local", name: form.get("name"), localPath: form.get("localPath") || suggestedLocalPath, gameType: form.get("gameType") };
    } else {
      body = { mode, name: form.get("name"), owner: form.get("owner") || undefined, repo: form.get("repo"), branch: form.get("branch") || "main", gameType: form.get("gameType"), private: form.get("private") === "on" };
    }
    const res = await fetch("/api/campaigns", { method: "POST", body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) window.location.href = `/campaigns/${data.campaign.id}`;
    else setBuildError(data.error || "Could not build repo.");
  }

  async function removeRepo(id: number, name: string) {
    if (!confirm(`Remove "${name}" from CampaignRepo? The underlying files are not deleted.`)) return;
    const res = await fetch("/api/campaigns", { method: "DELETE", body: JSON.stringify({ id }) });
    const data = await res.json();
    if (res.ok) {
      setRepos((current) => {
        const next = current.filter((campaign) => campaign.id !== id);
        persistRepoOrder(next);
        return next;
      });
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

  async function savePersonalAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAiSaving(true);
    const res = await fetch("/api/ai-settings", {
      method: "PUT",
      body: JSON.stringify({ endpoint: aiEndpoint, model: aiModel, apiKey: aiKey })
    });
    const data = await res.json();
    setAiSaving(false);
    if (res.ok) {
      setPersonalAi(data.config || {});
      setAiKey(data.config?.apiKey || "");
      setMessage("Personal AI endpoint tested and saved.");
      setPanelOpen("ai", false);
    } else {
      setMessage(data.error || "Could not save personal AI endpoint.");
    }
  }

  async function discoverAiModels() {
    if (!aiEndpoint.trim()) {
      setMessage("Enter an AI address first.");
      return;
    }
    setAiDiscovering(true);
    setAiModels([]);
    const params = new URLSearchParams({ endpoint: aiEndpoint });
    if (aiKey && !aiKey.startsWith("••")) params.set("apiKey", aiKey);
    const res = await fetch(`/api/ai-settings/models?${params.toString()}`);
    const data = await res.json();
    setAiDiscovering(false);
    if (res.ok) {
      setAiEndpoint(data.endpoint || aiEndpoint);
      setAiModels(data.models || []);
      if (!aiModel && data.models?.[0]) setAiModel(data.models[0]);
      setMessage(data.models?.length ? `Found ${data.models.length} local model${data.models.length === 1 ? "" : "s"}.` : "No models were reported by that endpoint.");
    } else {
      setMessage(data.error || "Could not find models at that address.");
    }
  }

  return (
    <>
      <section className="dashboard-search-bar" aria-label="Search all campaign repositories">
        <form onSubmit={runSearch} className="dashboard-search-form">
          <input name="q" placeholder="Search all repos: Jardin, SolSec, rumor..." />
          <button>Search</button>
        </form>
        {search.length > 0 && (
          <div className="dashboard-search-results">
            {search.map((row) => (
              <a key={row.id} href={row.category === "media" ? `/campaigns/${row.campaignId}#media` : `/campaigns/${row.campaignId}/pages/${row.slug}`}>
                <strong>{row.title}</strong><span>{row.campaignName} - {row.category}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="band repos-band">
        <div className="repos-band-head">
          <h2>Connected repos</h2>
          {repos.length > 0 && (
            <div className="segmented">
              <button type="button" className={repoView === "grid" ? "active" : ""} onClick={() => setRepoView("grid")} title="Grid view" aria-pressed={repoView === "grid"}>Grid</button>
              <button type="button" className={repoView === "marquee" ? "active" : ""} onClick={() => setRepoView("marquee")} title="Marquee view" aria-pressed={repoView === "marquee"}>Marquee</button>
            </div>
          )}
        </div>
        {repoView === "marquee" && repos.length > 0 ? (
          <div className="repo-marquee">
            <div className="repo-marquee-track">
              {[...repos, ...repos].map((campaign, i) => {
                const logo = gamePackLogos[campaign.gameType];
                const plateClass = darkPlatePacks.has(campaign.gameType) ? " repo-logo-plate-dark" : "";
                const slug = campaign.storageBackend === "local" ? (campaign.localPath || "local") : `${campaign.owner}/${campaign.repo}`;
                const meta = [campaign.gameType, campaign.storageBackend !== "local" ? campaign.branch : null, campaign.role].filter(Boolean).join(" · ");
                return (
                  <div className="campaign-card" key={`${campaign.id}-${i}`}>
                    <Link className="campaign-card-link" href={`/campaigns/${campaign.id}`}>
                      <div className="campaign-card-logo">
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <span className={`repo-logo-plate${plateClass}`}><img src={logo} alt={campaign.gameType} /></span>
                        ) : (
                          <span className="repo-logo-plate repo-logo-initial" aria-hidden>{campaign.gameType.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <p className="campaign-card-name">{campaign.name}</p>
                      <span className="campaign-card-slug">{slug}</span>
                      <small className="campaign-card-meta">{meta}</small>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
        <div className="repo-grid">
          {repos.map((campaign) => {
            const logo = gamePackLogos[campaign.gameType];
            const plateClass = darkPlatePacks.has(campaign.gameType) ? " repo-logo-plate-dark" : "";
            const slug = campaign.storageBackend === "local" ? (campaign.localPath || "local") : `${campaign.owner}/${campaign.repo}`;
            const meta = [campaign.gameType, campaign.storageBackend !== "local" ? campaign.branch : null, campaign.role].filter(Boolean).join(" · ");
            return (
              <div
                className={`campaign-card${draggedRepoId === campaign.id ? " dragging" : ""}${dragOverRepoId === campaign.id ? " drag-over" : ""}`}
                key={campaign.id}
                draggable
                onDragStart={(event) => {
                  setDraggedRepoId(campaign.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(campaign.id));
                }}
                onDragEnter={() => setDragOverRepoId(campaign.id)}
                onDragOver={(event) => {
                  if (draggedRepoId !== campaign.id) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const draggedId = Number(event.dataTransfer.getData("text/plain") || draggedRepoId);
                  reorderRepo(draggedId, campaign.id);
                  setDraggedRepoId(null);
                  setDragOverRepoId(null);
                }}
                onDragEnd={() => {
                  setDraggedRepoId(null);
                  setDragOverRepoId(null);
                }}
                title="Drag to reorder"
              >
                <Link className="campaign-card-link" href={`/campaigns/${campaign.id}`}>
                  <div className="campaign-card-logo">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <span className={`repo-logo-plate${plateClass}`}><img src={logo} alt={campaign.gameType} /></span>
                    ) : (
                      <span className="repo-logo-plate repo-logo-initial" aria-hidden>{campaign.gameType.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <p className="campaign-card-name">{campaign.name}</p>
                  <span className="campaign-card-slug">{slug}</span>
                  <small className="campaign-card-meta">{meta}</small>
                </Link>
                {campaign.role === "owner" && (
                  <button type="button" className="campaign-card-remove" onClick={() => removeRepo(campaign.id, campaign.name)} aria-label={`Remove ${campaign.name}`}>✕</button>
                )}
              </div>
            );
          })}
          {!repos.length && (
            <div className="onboarding-hero">
              <div className="onboarding-hero-icon">📖</div>
              <h3>Your first campaign is one click away</h3>
              <p>No installs, no accounts required. CampaignRepo stores your world in a plain folder — pages, maps, sessions, and media — so you own everything and can open files anywhere.</p>
              <button type="button" onClick={() => setPanelOpen("build", true)} className="button">
                Create your first campaign ↓
              </button>
              <ul className="onboarding-feature-list">
                <li>Wiki pages with rich markdown, images, and relationships</li>
                <li>Session planning, quests, and in-world calendar</li>
                <li>Traveller, WoD, and D&amp;D character sheets</li>
                <li>Optional GitHub sync for history and multi-device access</li>
              </ul>
            </div>
          )}
        </div>
        )}
      </section>

      <DemoBrowser />

      <section className="dashboard-grid">
        <details className="panel dashboard-toggle-panel" open={expandedPanels.github} onToggle={(event) => setPanelOpen("github", event.currentTarget.open)}>
          <summary>
            <span>GitHub connection</span>
            <small>{githubConnected ? `${githubConnection} connected` : "Connect access"}</small>
          </summary>
          <div className="dashboard-toggle-body">
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
                  <a className="button" href="/api/github/app/manifest/start">Connect GitHub</a>
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
              <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Create token instead</a>
            </details>
          </div>
        </details>

        <details className="panel dashboard-toggle-panel" open={expandedPanels.build} onToggle={(event) => setPanelOpen("build", event.currentTarget.open)}>
          <summary>
            <span>New campaign</span>
            <small>{mode === "local" ? "Local folder" : mode === "create" ? "GitHub (new)" : "GitHub (connect)"}</small>
          </summary>
          <div className="dashboard-toggle-body">
            <form onSubmit={buildRepo} className="stack" style={{ marginTop: 4 }}>
              <label>Campaign name<input name="name" required placeholder="The Jardin File" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} /></label>
              <label>Game system<select name="gameType">{gameTypeGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>{group.types.map((type) => <option key={type}>{type}</option>)}</optgroup>
              ))}</select></label>
              <details onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open && mode === "local") setBuildError(""); }}>
                <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--muted)", padding: "4px 0" }}>Advanced options</summary>
                <div className="stack" style={{ marginTop: 8, paddingLeft: 4 }}>
                  <p className="muted" style={{ fontSize: "12px", margin: "0 0 8px" }}>Storage: choose where campaign files live.</p>
                  <div className="segmented" style={{ marginBottom: 8 }}>
                    <button type="button" className={mode === "local" ? "active" : ""} onClick={() => { setMode("local"); setBuildError(""); }}>Local folder</button>
                    <button
                      type="button"
                      className={mode === "create" ? "active" : ""}
                      disabled={isGitHubApp}
                      title={isGitHubApp ? "GitHub App can't create repos — add a manual token to enable this" : undefined}
                      onClick={() => { setMode("create"); setBuildError(""); }}
                    >
                      {isGitHubApp && <Lock size={11} aria-hidden style={{ marginRight: 5 }} />}GitHub (new repo)
                    </button>
                    <button type="button" className={mode === "connect" ? "active" : ""} onClick={() => { setMode("connect"); setBuildError(""); }}>GitHub (connect)</button>
                  </div>
                  {mode === "local" && (
                    <>
                      <label>
                        Folder path <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
                        <input name="localPath" placeholder={suggestedLocalPath || "Leave blank for default location"} />
                        {suggestedLocalPath && <small className="muted">Default: {suggestedLocalPath}</small>}
                      </label>
                    </>
                  )}
                  {isGitHubApp && mode !== "local" && (
                    <div className="setup-callout callout-warn">
                      <strong><Lock size={13} aria-hidden style={{ marginRight: 6, verticalAlign: "-2px" }} />Creating new repos is locked</strong>
                      <span>GitHub App can connect existing repos but can&apos;t create new ones. Make the repo at <a href="https://github.com/new" target="_blank" rel="noreferrer">github.com/new</a>, then use <button type="button" className="linklike" onClick={() => { setMode("connect"); setBuildError(""); }}>Connect existing</button>.</span>
                    </div>
                  )}
                  {(mode === "create" || mode === "connect") && !githubConnected && (
                    <div className="setup-callout callout-warn">
                      <strong>GitHub not connected</strong>
                      <span>Connect GitHub above, or keep <button type="button" className="linklike" onClick={() => { setMode("local"); setBuildError(""); }}>Local folder</button> to start without any account.</span>
                    </div>
                  )}
                  {mode === "connect" && <label>Owner<input name="owner" placeholder="avorial (optional if pasting URL)" /></label>}
                  {mode !== "local" && <label>{mode === "connect" ? "Repo name or URL" : "Repo name"}<input name="repo" required placeholder={mode === "connect" ? "kdwiki or https://github.com/avorial/kdwiki" : "jardin-campaign"} /></label>}
                  {mode !== "local" && <label>Branch<input name="branch" defaultValue="main" /></label>}
                  {mode === "create" && <label className="check"><input type="checkbox" name="private" defaultChecked /> Private repo</label>}
                </div>
              </details>
              <button disabled={isGitHubApp && mode === "create"}>
                {mode === "create" ? "Create and initialize" : mode === "local" ? "Create campaign" : "Connect and initialize"}
              </button>
              {buildError && <p className="error">{buildError}</p>}
            </form>
          </div>
        </details>

        <details className="panel dashboard-toggle-panel" open={expandedPanels.ai} onToggle={(event) => setPanelOpen("ai", event.currentTarget.open)}>
          <summary>
            <span>Personal AI</span>
            <small>{personalAi.endpoint ? `Local AI ready · ${personalAi.model || "llama3.2"}` : "Local project AI"}</small>
          </summary>
          <div className="dashboard-toggle-body">
            <p className="muted">
              Set your default OpenAI-compatible endpoint for every project. Campaign-specific AI settings can still override this.
            </p>
            <form onSubmit={savePersonalAi} className="stack" style={{ marginTop: 4 }}>
              <label>
                Endpoint
                <input value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)} placeholder="http://localhost:11434/v1" />
              </label>
              <button type="button" className="secondary" onClick={discoverAiModels} disabled={aiDiscovering}>
                {aiDiscovering ? "Finding..." : "Find models"}
              </button>
              {aiModels.length > 0 && (
                <div className="ai-model-list" aria-label="Detected local AI models">
                  {aiModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      className={aiModel === model ? "active" : "secondary"}
                      onClick={() => setAiModel(model)}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              )}
              <label>
                Model
                <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="llama3.2" />
              </label>
              <label>
                API key <span className="muted" style={{ fontWeight: 400 }}>(leave blank for Ollama / local endpoints)</span>
                <input value={aiKey} onChange={(e) => setAiKey(e.target.value)} type="password" placeholder="optional" />
              </label>
              <div className="setup-callout">
                <strong>Local AI examples</strong>
                <span>Ollama: <code>http://localhost:11434/v1</code>. LM Studio: use its OpenAI-compatible server URL.</span>
              </div>
              <button disabled={aiSaving}>
                {aiSaving ? `Testing / warming... ${aiSavingSeconds}s` : "Test and save personal AI"}
              </button>
            </form>
          </div>
        </details>

        <details className="panel dashboard-toggle-panel" open={expandedPanels.mcp} onToggle={(event) => setPanelOpen("mcp", event.currentTarget.open)}>
          <summary>
            <span>MCP access tokens</span>
            <small>{tokens.length} token{tokens.length === 1 ? "" : "s"}</small>
          </summary>
          <div className="dashboard-toggle-body">
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
                  <span><strong>{token.name}</strong> - last used {token.lastUsedAt || "never"}</span>
                  <button type="button" onClick={() => revokeToken(token.id)}>Revoke</button>
                </div>
              ))}
            </div>
          </div>
        </details>
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
                    <span>{review.category} - {review.approvalStatus}{review.sourceImport ? ` - ${review.sourceImport}` : ""}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="band instructions">
        <h2>Editing outside CampaignRepo</h2>
        <p>Every campaign is a folder of plain Markdown files. Edit pages in any text editor or IDE — the same way you&apos;d edit a README. Campaign files live under <code>wiki/pages/</code>, media under <code>wiki/media/</code>.</p>
        <p>In page content, <code>[[Page Name]]</code> creates a wiki link, <code>:::gm</code> blocks are GM-only secrets, and frontmatter (the YAML between <code>---</code> lines) controls category, visibility, and approval.</p>
        <details>
          <summary style={{ cursor: "pointer", fontSize: "13px" }}>GitHub / technical details</summary>
          <p>Required folder structure: <code>wiki/pages</code>, <code>wiki/media</code>, <code>wiki/templates</code>, <code>wiki/imports/characters</code>, <code>wiki/search/index.json</code>, and <code>wiki/campaign.yaml</code>. CampaignRepo initializes this automatically when you create a campaign. To connect an existing GitHub repo, use &quot;GitHub (connect existing)&quot; — it will repair missing structure on first connect.</p>
        </details>
      </section>
      {message && <p className="toast">{message}</p>}
    </>
  );
}

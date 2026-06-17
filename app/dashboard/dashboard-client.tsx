"use client";

import { FormEvent, useState } from "react";
import type { Campaign, GameType, User } from "@/lib/types";

export default function DashboardClient({
  user,
  campaigns,
  gameTypes
}: {
  user: User;
  campaigns: Campaign[];
  gameTypes: GameType[];
  categories: { id: string; label: string }[];
}) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"create" | "connect">("create");
  const [search, setSearch] = useState<any[]>([]);

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
    else setMessage(data.error || "Could not build repo.");
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
      <section className="dashboard-grid">
        <div className="panel">
          <h2>GitHub connection</h2>
          <p className="muted">Signed in as {user.email}. Add a GitHub token with repo contents read/write access to create or connect campaign repos.</p>
          <form onSubmit={connectGithub} className="stack">
            <label>GitHub token<input name="token" type="password" placeholder="ghp_..." /></label>
            <button>Connect GitHub</button>
          </form>
        </div>

        <div className="panel">
          <h2>Build Campaign Repo</h2>
          <div className="segmented">
            <button type="button" className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>Create repo</button>
            <button type="button" className={mode === "connect" ? "active" : ""} onClick={() => setMode("connect")}>Connect repo</button>
          </div>
          <form onSubmit={buildRepo} className="stack">
            <label>Campaign name<input name="name" required placeholder="The Jardin File" /></label>
            {mode === "connect" && <label>Owner<input name="owner" placeholder="github-owner" /></label>}
            <label>Repo name<input name="repo" required placeholder="jardin-campaign" /></label>
            <label>Branch<input name="branch" defaultValue="main" /></label>
            <label>Game template pack<select name="gameType">{gameTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            {mode === "create" && <label className="check"><input type="checkbox" name="private" defaultChecked /> Private repo</label>}
            <button>{mode === "create" ? "Create and initialize" : "Connect and repair"}</button>
          </form>
        </div>

        <div className="panel">
          <h2>Search all repos</h2>
          <form onSubmit={runSearch} className="inline-form">
            <input name="q" placeholder="Jardin, SolSec, rumor..." />
            <button>Search</button>
          </form>
          <div className="results">
            {search.map((row) => (
              <a key={row.id} href={`/campaigns/${row.campaignId}/pages/${row.slug}`}>
                <strong>{row.title}</strong><span>{row.campaignName} · {row.category}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

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

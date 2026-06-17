"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { Campaign, WikiPage } from "@/lib/types";

export default function CampaignClient({ campaign, categories }: { campaign: Campaign; categories: { id: string; label: string }[] }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [setup, setSetup] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState<any[]>([]);
  const pendingReviews = pages.filter((page) => page.frontmatter.approvalStatus !== "approved").length;

  async function load() {
    const [pagesRes, setupRes] = await Promise.all([
      fetch(`/api/campaigns/${campaign.id}/pages`),
      fetch(`/api/campaigns/${campaign.id}/setup`)
    ]);
    const pagesData = await pagesRes.json();
    const setupData = await setupRes.json();
    setPages(pagesData.pages || []);
    setSetup(setupData.markdown || "");
  }

  useEffect(() => { load(); }, []);

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch(`/api/campaigns/${campaign.id}/pages`, {
      method: "POST",
      body: JSON.stringify({ name: form.get("name"), category: form.get("category"), visibility: form.get("visibility") })
    });
    const data = await res.json();
    if (res.ok) window.location.href = `/campaigns/${campaign.id}/pages/${data.slug}`;
    else setMessage(data.error || "Could not create page.");
  }

  async function importCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let sourceJson: unknown;
    try {
      sourceJson = JSON.parse(String(form.get("json") || "{}"));
    } catch {
      setMessage("Import JSON is invalid.");
      return;
    }
    const res = await fetch(`/api/campaigns/${campaign.id}/imports/characters`, {
      method: "POST",
      body: JSON.stringify({
        source: form.get("source"),
        visibility: form.get("visibility"),
        approvalStatus: form.get("approvalStatus"),
        sourceJson
      })
    });
    const data = await res.json();
    if (res.ok) window.location.href = `/campaigns/${campaign.id}/pages/${data.slug}`;
    else setMessage(data.error || "Import failed.");
  }

  async function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    const res = await fetch(`/api/search?campaignId=${campaign.id}&q=${encodeURIComponent(String(q || ""))}`);
    const data = await res.json();
    setSearch(data.results || []);
  }

  const grouped = categories.map((cat) => ({ ...cat, pages: pages.filter((page) => page.frontmatter.category === cat.id) }));
  const canManage = campaign.role === "owner" || campaign.role === "gm";

  return (
    <section className="workspace">
      <aside className="side-nav">
        <form onSubmit={runSearch} className="stack">
          <input name="q" placeholder="Search this repo" />
          <button>Search</button>
        </form>
        {search.map((row) => (
          <Link key={row.id} href={`/campaigns/${campaign.id}/pages/${row.slug}`} className="nav-link">
            {row.title}
          </Link>
        ))}
        {grouped.map((group) => (
          <div key={group.id} className="nav-group">
            <h3>{group.label}</h3>
            {group.pages.map((page) => (
              <Link className="nav-link" key={page.slug} href={`/campaigns/${campaign.id}/pages/${page.slug}`}>
                {page.frontmatter.name}
              </Link>
            ))}
          </div>
        ))}
        {canManage && pendingReviews > 0 && (
          <Link href={`/campaigns/${campaign.id}/admin`} className="review-callout">
            {pendingReviews} review{pendingReviews === 1 ? "" : "s"} waiting
          </Link>
        )}
      </aside>

      <div className="workspace-main">
        {canManage && (
          <section className="dashboard-grid">
            <div className="panel">
              <h2>Create page</h2>
              <form onSubmit={createPage} className="stack">
                <label>Name<input name="name" required placeholder="Victor Mendes" /></label>
                <label>Category<select name="category">{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}</select></label>
                <label>Visibility<select name="visibility"><option value="gm">GM only</option><option value="players">Player visible</option></select></label>
                <button>Create page</button>
              </form>
            </div>

            <div className="panel">
              <h2>Import character JSON</h2>
              <form onSubmit={importCharacter} className="stack">
                <label>Source<select name="source"><option value="foundry">Foundry Actor JSON</option><option value="generic">Generic JSON</option></select></label>
                <label>Visibility<select name="visibility"><option value="gm">GM only</option><option value="players">Player visible</option></select></label>
                <label>Approval<select name="approvalStatus"><option value="approved">Approved</option><option value="unapproved">Unapproved</option></select></label>
                <textarea name="json" rows={8} placeholder='{"name":"Victor Mendes","type":"npc"}' />
                <button>Import character</button>
              </form>
            </div>
          </section>
        )}

        {canManage && (
          <section className="panel">
            <h2>Setup instructions</h2>
            <textarea readOnly rows={10} value={setup} />
            <button onClick={() => navigator.clipboard.writeText(setup)}>Copy setup instructions</button>
          </section>
        )}
      </div>
      {message && <p className="toast">{message}</p>}
    </section>
  );
}

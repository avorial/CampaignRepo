"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { Campaign, CampaignMedia, GameType, WikiPage, WikiTemplate } from "@/lib/types";

const gameTypes: GameType[] = ["Traveller", "Fantasy", "Modern", "Horror", "Sci-Fi", "Custom"];

export default function CampaignClient({ campaign, categories }: { campaign: Campaign; categories: { id: string; label: string }[] }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [templates, setTemplates] = useState<WikiTemplate[]>([]);
  const [media, setMedia] = useState<CampaignMedia[]>([]);
  const [setup, setSetup] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState<any[]>([]);
  const pendingReviews = pages.filter((page) => page.frontmatter.approvalStatus !== "approved").length;

  async function load() {
    const canManage = campaign.role === "owner" || campaign.role === "gm";
    const [pagesRes, setupRes, templatesRes, mediaRes] = await Promise.all([
      fetch(`/api/campaigns/${campaign.id}/pages`),
      fetch(`/api/campaigns/${campaign.id}/setup`),
      canManage ? fetch(`/api/campaigns/${campaign.id}/templates`) : Promise.resolve(null),
      canManage ? fetch(`/api/campaigns/${campaign.id}/media`) : Promise.resolve(null)
    ]);
    const pagesData = await pagesRes.json();
    const setupData = setupRes.ok ? await setupRes.json() : { markdown: "" };
    const templatesData = templatesRes && templatesRes.ok ? await templatesRes.json() : { templates: [] };
    const mediaData = mediaRes && mediaRes.ok ? await mediaRes.json() : { media: [] };
    setPages(pagesData.pages || []);
    setSetup(setupData.markdown || "");
    setTemplates(templatesData.templates || []);
    setMedia(mediaData.media || []);
  }

  useEffect(() => { load(); }, []);

  async function createPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const res = await fetch(`/api/campaigns/${campaign.id}/pages`, {
      method: "POST",
      body: JSON.stringify({ name: form.get("name"), category: form.get("category"), visibility: form.get("visibility"), templatePath: form.get("templatePath") || undefined })
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

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tags = String(form.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const res = await fetch(`/api/campaigns/${campaign.id}/templates`, {
      method: "POST",
      body: JSON.stringify({
        name: form.get("templateName"),
        gameType: form.get("gameType"),
        category: form.get("templateCategory"),
        summary: form.get("summary"),
        tags,
        content: form.get("content")
      })
    });
    const data = await res.json();
    if (res.ok) {
      setTemplates((current) => [...current, data.template].sort((a, b) => `${a.gameType}:${a.category}:${a.name}`.localeCompare(`${b.gameType}:${b.category}:${b.name}`)));
      setMessage("Template saved to the campaign repo.");
      event.currentTarget.reset();
    } else {
      setMessage(data.error || "Could not create template.");
    }
  }

  async function uploadMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) {
      setMessage("Choose a media file first.");
      return;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
    const res = await fetch(`/api/campaigns/${campaign.id}/media`, {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        base64,
        alt: form.get("alt")
      })
    });
    const data = await res.json();
    if (res.ok) {
      setMedia((current) => [data.media, ...current.filter((item) => item.path !== data.media.path)]);
      setMessage("Media uploaded to the campaign repo.");
      event.currentTarget.reset();
    } else {
      setMessage(data.error || "Could not upload media.");
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("Copied Markdown link.");
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
  const templatesByGame = gameTypes.map((gameType) => ({ gameType, templates: templates.filter((template) => template.gameType === gameType) }));

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
                <label>Template<select name="templatePath"><option value="">Starter default</option>{templates.map((template) => <option key={template.path} value={template.path}>{template.gameType} · {template.category} · {template.name}</option>)}</select></label>
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
          <section className="dashboard-grid media-grid">
            <div className="panel">
              <h2>Media Manager</h2>
              <form onSubmit={uploadMedia} className="stack">
                <label>Media file<input name="file" type="file" accept="image/*,application/pdf,audio/*" required /></label>
                <label>Alt text or link label<input name="alt" placeholder="Jardin subsector map" /></label>
                <button>Upload to /wiki/media</button>
              </form>
            </div>

            <div className="panel media-library">
              <h2>Media Library</h2>
              <div className="media-list">
                {media.map((item) => (
                  <article key={item.path} className="media-row">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.mediaType} · {item.path}</span>
                      <code>{item.markdown}</code>
                    </div>
                    <div className="member-actions">
                      <button type="button" className="secondary" onClick={() => copyText(item.markdown)}>Copy Markdown</button>
                      {item.downloadUrl && <a className="button secondary" href={item.downloadUrl}>Open</a>}
                    </div>
                  </article>
                ))}
                {!media.length && <p className="muted">No media uploaded yet.</p>}
              </div>
            </div>
          </section>
        )}

        {canManage && (
          <section className="dashboard-grid">
            <div className="panel">
              <h2>Template Creator</h2>
              <form onSubmit={createTemplate} className="stack">
                <label>Template name<input name="templateName" required placeholder="Solomani Patron" /></label>
                <label>Game type<select name="gameType" defaultValue={campaign.gameType}>{gameTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label>Content type<select name="templateCategory">{categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}</select></label>
                <label>Summary<input name="summary" placeholder="Reusable structure for..." /></label>
                <label>Tags<input name="tags" placeholder="traveller, patron, navy" /></label>
                <label>Markdown body<textarea name="content" rows={10} placeholder={"# {{name}}\n\n## Overview\n\n\n:::gm\nSecret notes.\n::: "} /></label>
                <button>Save template</button>
              </form>
            </div>

            <div className="panel template-library">
              <h2>Template Library</h2>
              {templatesByGame.map((group) => (
                <div key={group.gameType} className="template-group">
                  <h3>{group.gameType}</h3>
                  {group.templates.map((template) => (
                    <article key={template.path} className="template-row">
                      <strong>{template.name}</strong>
                      <span>{template.category} · {template.path}</span>
                      {template.summary && <p>{template.summary}</p>}
                    </article>
                  ))}
                  {!group.templates.length && <p className="muted">No templates yet.</p>}
                </div>
              ))}
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

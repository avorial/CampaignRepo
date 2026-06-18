"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { Campaign, CampaignGraphEdge, CampaignGraphNode, CampaignMedia, CampaignTimelineItem, WikiPage, WikiTemplate } from "@/lib/types";
import { gameTypes } from "@/lib/templates";

type RepoValidationCheck = {
  label: string;
  path: string;
  ok: boolean;
  status: "ok" | "missing" | "wrong-type" | "error";
  actualType?: string;
  error?: string;
};

type RepoValidation = {
  ok: boolean;
  checks: RepoValidationCheck[];
};

export default function CampaignClient({ campaign, categories }: { campaign: Campaign; categories: { id: string; label: string }[] }) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [templates, setTemplates] = useState<WikiTemplate[]>([]);
  const [media, setMedia] = useState<CampaignMedia[]>([]);
  const [graph, setGraph] = useState<{ nodes: CampaignGraphNode[]; edges: CampaignGraphEdge[]; timeline: CampaignTimelineItem[] }>({ nodes: [], edges: [], timeline: [] });
  const [validation, setValidation] = useState<RepoValidation | null>(null);
  const [setup, setSetup] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState<any[]>([]);
  const pendingReviews = pages.filter((page) => page.frontmatter.approvalStatus !== "approved").length;

  async function load() {
    const canManage = campaign.role === "owner" || campaign.role === "gm";
    const [pagesRes, graphRes, setupRes, templatesRes, mediaRes, validationRes] = await Promise.all([
      fetch(`/api/campaigns/${campaign.id}/pages`),
      fetch(`/api/campaigns/${campaign.id}/graph`),
      fetch(`/api/campaigns/${campaign.id}/setup`),
      canManage ? fetch(`/api/campaigns/${campaign.id}/templates`) : Promise.resolve(null),
      canManage ? fetch(`/api/campaigns/${campaign.id}/media`) : Promise.resolve(null),
      canManage ? fetch(`/api/campaigns/${campaign.id}/validation`) : Promise.resolve(null)
    ]);
    const pagesData = await pagesRes.json();
    const graphData = graphRes.ok ? await graphRes.json() : { nodes: [], edges: [], timeline: [] };
    const setupData = setupRes.ok ? await setupRes.json() : { markdown: "" };
    const templatesData = templatesRes && templatesRes.ok ? await templatesRes.json() : { templates: [] };
    const mediaData = mediaRes && mediaRes.ok ? await mediaRes.json() : { media: [] };
    const validationData = validationRes && validationRes.ok ? await validationRes.json() : null;
    setPages(pagesData.pages || []);
    setGraph({ nodes: graphData.nodes || [], edges: graphData.edges || [], timeline: graphData.timeline || [] });
    setSetup(setupData.markdown || "");
    setTemplates(templatesData.templates || []);
    setMedia(mediaData.media || []);
    setValidation(validationData);
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
        mapping: {
          name: form.get("mapName"),
          biography: form.get("mapBiography"),
          items: form.get("mapItems"),
          category: form.get("mapCategory"),
          summary: form.get("mapSummary"),
          tags: form.get("mapTags")
        },
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
        alt: form.get("alt"),
        caption: form.get("caption"),
        tags: String(form.get("tags") || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
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

  async function deleteMedia(item: CampaignMedia) {
    if (!window.confirm(`Delete ${item.name} from the campaign repo?`)) return;
    const res = await fetch(`/api/campaigns/${campaign.id}/media`, {
      method: "DELETE",
      body: JSON.stringify({ path: item.path })
    });
    const data = await res.json();
    if (res.ok) {
      setMedia((current) => current.filter((mediaItem) => mediaItem.path !== item.path));
      setMessage("Media deleted from the campaign repo.");
    } else {
      setMessage(data.error || "Could not delete media.");
    }
  }

  async function renameMedia(item: CampaignMedia) {
    const nextName = window.prompt("Rename media file", item.name);
    if (!nextName || nextName === item.name) return;
    const res = await fetch(`/api/campaigns/${campaign.id}/media`, {
      method: "PATCH",
      body: JSON.stringify({ path: item.path, fileName: nextName })
    });
    const data = await res.json();
    if (res.ok) {
      setMedia((current) => [data.media, ...current.filter((mediaItem) => mediaItem.path !== item.path)]);
      setMessage("Media renamed in the campaign repo.");
    } else {
      setMessage(data.error || "Could not rename media.");
    }
  }

  async function editMediaMetadata(item: CampaignMedia) {
    const alt = window.prompt("Alt text or link label", item.alt || item.name);
    if (alt === null) return;
    const caption = window.prompt("Caption", item.caption || "");
    if (caption === null) return;
    const tagsInput = window.prompt("Tags, comma separated", item.tags?.join(", ") || "");
    if (tagsInput === null) return;
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const res = await fetch(`/api/campaigns/${campaign.id}/media`, {
      method: "PATCH",
      body: JSON.stringify({ path: item.path, alt, caption, tags })
    });
    const data = await res.json();
    if (res.ok) {
      setMedia((current) => [data.media, ...current.filter((mediaItem) => mediaItem.path !== item.path)]);
      setMessage("Media metadata updated.");
    } else {
      setMessage(data.error || "Could not update media metadata.");
    }
  }

  async function repairRepo() {
    const res = await fetch(`/api/campaigns/${campaign.id}/validation`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setValidation(data);
      setMessage(data.ok ? "Repo structure is healthy." : "Repair ran, but some checks still need attention.");
    } else {
      setMessage(data.error || "Could not repair repo structure.");
    }
  }

  async function rebuildIndex() {
    const res = await fetch(`/api/campaigns/${campaign.id}/search-index`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Search rebuilt for ${data.count} page${data.count === 1 ? "" : "s"}.`);
      await load();
    } else {
      setMessage(data.error || "Could not rebuild search.");
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
  const linkedNodes = graph.nodes
    .map((node) => ({
      ...node,
      linkCount: node.outgoingLinks.length + node.backlinks.length + node.keyLinks.length,
      missingLinks: graph.edges.filter((edge) => edge.source === node.slug && edge.missing).length
    }))
    .filter((node) => node.linkCount > 0 || node.missingLinks > 0)
    .sort((a, b) => b.linkCount - a.linkCount || a.name.localeCompare(b.name))
    .slice(0, 12);
  const graphMapNodes = linkedNodes.slice(0, 10).map((node, index, list) => {
    const angle = list.length === 1 ? -Math.PI / 2 : (index / list.length) * Math.PI * 2 - Math.PI / 2;
    const rx = 220;
    const ry = 105;
    return {
      ...node,
      x: 260 + Math.cos(angle) * rx,
      y: 145 + Math.sin(angle) * ry
    };
  });
  const graphMapNodeLookup = new Map(graphMapNodes.map((node) => [node.slug, node]));
  const graphMapEdges = graph.edges
    .filter((edge) => !edge.missing && graphMapNodeLookup.has(edge.source) && graphMapNodeLookup.has(edge.target))
    .slice(0, 28);
  const shortLabel = (value: string) => (value.length > 18 ? `${value.slice(0, 16)}...` : value);

  return (
    <section className="workspace">
      <aside className="side-nav">
        <form onSubmit={runSearch} className="stack">
          <input name="q" placeholder="Search this repo" />
          <button>Search</button>
        </form>
        {search.map((row) => (
          <Link key={row.id} href={row.category === "media" ? `/campaigns/${campaign.id}#media` : `/campaigns/${campaign.id}/pages/${row.slug}`} className="nav-link">
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
            <div className="panel" id="media">
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
                <div className="mapper-grid">
                  <label>Name path<input name="mapName" placeholder="name" /></label>
                  <label>Biography path<input name="mapBiography" placeholder="bio or system.biography.value" /></label>
                  <label>Items path<input name="mapItems" placeholder="items" /></label>
                  <label>Category path<input name="mapCategory" placeholder="type" /></label>
                  <label>Summary path<input name="mapSummary" placeholder="summary" /></label>
                  <label>Tags path<input name="mapTags" placeholder="tags" /></label>
                </div>
                <textarea name="json" rows={8} placeholder='{"name":"Victor Mendes","type":"npc"}' />
                <button>Import character</button>
              </form>
            </div>
          </section>
        )}

        <section className="dashboard-grid lore-grid">
          <div className="panel relationship-map-panel">
            <h2>Relationship Map</h2>
            {graphMapNodes.length > 1 ? (
              <svg className="relationship-map" viewBox="0 0 520 290" role="img" aria-label="Campaign relationship map">
                {graphMapEdges.map((edge, index) => {
                  const source = graphMapNodeLookup.get(edge.source)!;
                  const target = graphMapNodeLookup.get(edge.target)!;
                  return (
                    <line
                      key={`${edge.source}-${edge.target}-${index}`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      className={edge.label === "key link" ? "key-edge" : ""}
                    />
                  );
                })}
                {graphMapNodes.map((node) => (
                  <a key={node.slug} href={`/campaigns/${campaign.id}/pages/${node.slug}`}>
                    <g className={`graph-node graph-node-${node.category}`}>
                      <circle cx={node.x} cy={node.y} r="25" />
                      <text x={node.x} y={node.y + 43} textAnchor="middle">{shortLabel(node.name)}</text>
                    </g>
                  </a>
                ))}
              </svg>
            ) : (
              <p className="muted">Add wiki links or key links to draw the relationship map.</p>
            )}
          </div>

          <div className="panel">
            <h2>Timeline</h2>
            <div className="timeline-list">
              {graph.timeline.map((item) => (
                <Link key={item.slug} href={`/campaigns/${campaign.id}/pages/${item.slug}`} className="timeline-row">
                  <span>{item.eventDate || "Undated"}</span>
                  <strong>{item.name}</strong>
                  <small>{item.summary || item.tags.join(", ") || item.visibility}</small>
                </Link>
              ))}
              {!graph.timeline.length && <p className="muted">Create Event pages to build the campaign timeline.</p>}
            </div>
          </div>

          <div className="panel">
            <h2>Relationships</h2>
            <div className="relationship-list">
              {linkedNodes.map((node) => (
                <article key={node.slug} className="relationship-row">
                  <div>
                    <Link href={`/campaigns/${campaign.id}/pages/${node.slug}`}><strong>{node.name}</strong></Link>
                    <span>{node.category} · {node.linkCount} links{node.missingLinks ? ` · ${node.missingLinks} missing` : ""}</span>
                  </div>
                  <p>
                    Out: {node.outgoingLinks.length} · Back: {node.backlinks.length} · Key: {node.keyLinks.length}
                  </p>
                </article>
              ))}
              {!linkedNodes.length && <p className="muted">Use wiki links like [[Jardin]] to grow relationships.</p>}
            </div>
          </div>
        </section>

        {canManage && (
          <section className="dashboard-grid media-grid">
            <div className="panel">
              <h2>Media Manager</h2>
              <form onSubmit={uploadMedia} className="stack">
                <label>Media file<input name="file" type="file" accept="image/*,application/pdf,audio/*" required /></label>
                <label>Alt text or link label<input name="alt" placeholder="Jardin subsector map" /></label>
                <label>Caption<input name="caption" placeholder="Player-facing map of Jardin highport" /></label>
                <label>Tags<input name="tags" placeholder="map, handout, jardin" /></label>
                <button>Upload to /wiki/media</button>
              </form>
            </div>

            <div className="panel media-library">
              <h2>Media Library</h2>
              <div className="media-list">
                {media.map((item) => (
                  <article key={item.path} className="media-row">
                    <div className={`media-preview media-preview-${item.mediaType}`}>
                      {item.downloadUrl && item.mediaType === "image" && <img src={item.downloadUrl} alt={item.alt || item.name} />}
                      {item.downloadUrl && item.mediaType === "pdf" && <iframe title={item.alt || item.name} src={item.downloadUrl} />}
                      {item.downloadUrl && item.mediaType === "audio" && <audio controls src={item.downloadUrl} />}
                      {(!item.downloadUrl || item.mediaType === "other") && <span>{item.mediaType}</span>}
                    </div>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.mediaType} · {item.path}</span>
                      {item.caption && <span>{item.caption}</span>}
                      {Boolean(item.tags?.length) && <span>{item.tags?.join(", ")}</span>}
                      <code>{item.markdown}</code>
                    </div>
                    <div className="member-actions">
                      <button type="button" className="secondary" onClick={() => copyText(item.markdown)}>Copy Markdown</button>
                      <button type="button" className="secondary" onClick={() => editMediaMetadata(item)}>Edit Metadata</button>
                      <button type="button" className="secondary" onClick={() => renameMedia(item)}>Rename</button>
                      {item.downloadUrl && <a className="button secondary" href={item.downloadUrl}>Open</a>}
                      <button type="button" className="danger" onClick={() => deleteMedia(item)}>Delete</button>
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
            <div className="section-heading">
              <div>
                <h2>Repo validation</h2>
                <p className="muted">Checks the GitHub repo for the required CampaignRepo folders and starter files.</p>
              </div>
              <div className="member-actions">
                <button type="button" className="secondary" onClick={rebuildIndex}>Rebuild search</button>
                <button type="button" className="secondary" onClick={repairRepo}>Repair structure</button>
              </div>
            </div>
            <div className="validation-list">
              {validation?.checks.map((check) => (
                <article key={check.path} className={`validation-row ${check.ok ? "ok" : "needs-work"}`}>
                  <div>
                    <strong>{check.label}</strong>
                    <span>{check.path}</span>
                  </div>
                  <code>{check.status}{check.actualType && check.status !== "ok" ? `: ${check.actualType}` : ""}</code>
                  {check.error && <p className="error">{check.error}</p>}
                </article>
              ))}
              {!validation && <p className="muted">Connect GitHub to run repo validation.</p>}
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

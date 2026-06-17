"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Campaign, WikiPage } from "@/lib/types";

function render(content: string, mode: "gm" | "player" | "handout") {
  let html = mode === "player" || mode === "handout" ? content.replace(/:::gm[\s\S]*?:::/g, "") : content.replace(/:::gm/g, '<section class="gm-block"><strong>GM</strong>').replace(/:::/g, "</section>");
  html = html
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<a class="wiki-link">$2</a>')
    .replace(/\[\[([^\]]+)\]\]/g, '<a class="wiki-link">$1</a>')
    .split(/\n{2,}/)
    .map((block) => (block.startsWith("<") ? block : `<p>${block.replace(/\n/g, "<br />")}</p>`))
    .join("");
  return html;
}

export default function PageEditor({ campaign, slug }: { campaign: Campaign; slug: string }) {
  const [page, setPage] = useState<WikiPage | null>(null);
  const [content, setContent] = useState("");
  const [frontmatter, setFrontmatter] = useState<any>({});
  const canManage = campaign.role === "owner" || campaign.role === "gm";
  const [mode, setMode] = useState<"gm" | "player" | "handout">(canManage ? "gm" : "player");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}/pages/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        setPage(data.page);
        setContent(data.page.content);
        setFrontmatter(data.page.frontmatter);
      });
  }, [campaign.id, slug]);

  const preview = useMemo(() => render(content, mode), [content, mode]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const res = await fetch(`/api/campaigns/${campaign.id}/pages/${slug}`, {
      method: "PUT",
      body: JSON.stringify({ frontmatter, content, sha: page?.sha })
    });
    setMessage(res.ok ? "Saved and committed to GitHub." : "Save failed.");
  }

  function updateField(field: string, value: unknown) {
    setFrontmatter((current: any) => ({ ...current, [field]: value }));
  }

  if (!page) return <p className="muted">Loading page...</p>;
  const keyLinks = Array.isArray(frontmatter.keyLinks) ? frontmatter.keyLinks : [];
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const tradeCodes = Array.isArray(frontmatter.tradeCodes) ? frontmatter.tradeCodes : [];
  const isTraveller = campaign.gameType === "Traveller";
  const isEvent = frontmatter.category === "event";

  return (
    <form onSubmit={save} className="page-grid">
      <aside className="page-sidebar">
        <h2>{frontmatter.name}</h2>
        <p>{frontmatter.summary || "No summary yet."}</p>
        <div className="badges">
          <span>{frontmatter.category}</span>
          <span>{frontmatter.visibility}</span>
          <span>{frontmatter.approvalStatus}</span>
          {frontmatter.knownToPlayers && <span>known</span>}
        </div>

        <div className="field-group">
          <h3>Page</h3>
          <label>Name<input value={frontmatter.name || ""} onChange={(e) => updateField("name", e.target.value)} readOnly={!canManage} /></label>
          <label>Summary<textarea value={frontmatter.summary || ""} onChange={(e) => updateField("summary", e.target.value)} readOnly={!canManage} /></label>
          <label>Status<input value={frontmatter.status || ""} onChange={(e) => updateField("status", e.target.value)} readOnly={!canManage} placeholder="alive, active, destroyed..." /></label>
          <label>Tags<input value={tags.join(", ")} onChange={(e) => updateField("tags", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!canManage} /></label>
          <label>Aliases<input value={(frontmatter.aliases || []).join(", ")} onChange={(e) => updateField("aliases", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!canManage} /></label>
        </div>

        <div className="field-group">
          <h3>Visibility</h3>
          <label>Visibility<select value={frontmatter.visibility} onChange={(e) => updateField("visibility", e.target.value)} disabled={!canManage}><option value="gm">GM only</option><option value="players">Players</option></select></label>
          <label>Approval<select value={frontmatter.approvalStatus} onChange={(e) => updateField("approvalStatus", e.target.value)} disabled={!canManage}><option value="approved">Approved</option><option value="unapproved">Unapproved</option><option value="rejected">Rejected</option></select></label>
          <label className="check"><input type="checkbox" checked={Boolean(frontmatter.knownToPlayers)} onChange={(e) => updateField("knownToPlayers", e.target.checked)} disabled={!canManage} /> Known to players</label>
        </div>

        <div className="field-group">
          <h3>Links</h3>
          <label>Key links<input value={keyLinks.join(", ")} onChange={(e) => updateField("keyLinks", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!canManage} /></label>
          <label>Foundry link<input value={frontmatter.foundryLink || ""} onChange={(e) => updateField("foundryLink", e.target.value)} readOnly={!canManage} placeholder="Actor UUID or scene URL" /></label>
        </div>

        {isEvent && (
          <div className="field-group">
            <h3>Timeline</h3>
            <label>Event date<input value={frontmatter.eventDate || ""} onChange={(e) => updateField("eventDate", e.target.value)} readOnly={!canManage} placeholder="1105-123 or 2026-06-17" /></label>
            <label>Timeline date<input value={frontmatter.timelineDate || ""} onChange={(e) => updateField("timelineDate", e.target.value)} readOnly={!canManage} /></label>
          </div>
        )}

        {isTraveller && (
          <div className="field-group">
            <h3>Traveller</h3>
            <label>UWP<input value={frontmatter.uwp || ""} onChange={(e) => updateField("uwp", e.target.value)} readOnly={!canManage} placeholder="A867A74-C" /></label>
            <label>Allegiance<input value={frontmatter.allegiance || ""} onChange={(e) => updateField("allegiance", e.target.value)} readOnly={!canManage} placeholder="Solomani Confederation" /></label>
            <label>Trade codes<input value={tradeCodes.join(", ")} onChange={(e) => updateField("tradeCodes", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} readOnly={!canManage} /></label>
            <label>Subsector<input value={frontmatter.subsector || ""} onChange={(e) => updateField("subsector", e.target.value)} readOnly={!canManage} /></label>
            <label>Patron<input value={frontmatter.patron || ""} onChange={(e) => updateField("patron", e.target.value)} readOnly={!canManage} /></label>
            <label>Tech level<input value={frontmatter.techLevel || ""} onChange={(e) => updateField("techLevel", e.target.value)} readOnly={!canManage} /></label>
          </div>
        )}

        {frontmatter.sourceImport && <p className="muted">Source: {frontmatter.sourceImport}</p>}
        <h3>Key links</h3>
        {keyLinks.map((link: string) => <a key={link} className="nav-link" href={`/campaigns/${campaign.id}/pages/${link}`}>{link}</a>)}
        <h3>Backlinks</h3>
        {(page.backlinks || []).map((link) => <a key={link} className="nav-link" href={`/campaigns/${campaign.id}/pages/${link}`}>{link}</a>)}
      </aside>

      <section className="editor-panel">
        <div className="editor-toolbar">
          {canManage && <button type="button" className={mode === "gm" ? "active" : ""} onClick={() => setMode("gm")}>GM preview</button>}
          <button type="button" className={mode === "player" ? "active" : ""} onClick={() => setMode("player")}>Player preview</button>
          <button type="button" className={mode === "handout" ? "active" : ""} onClick={() => setMode("handout")}>Handout</button>
          {canManage && <button type="submit">Save commit</button>}
        </div>
        <div className="editor-split">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} readOnly={!canManage} />
          <article className={mode === "handout" ? "preview handout-preview" : "preview"}>
            {mode === "handout" && (
              <header className="handout-header">
                <p>Player Handout</p>
                <h1>{frontmatter.name}</h1>
                {frontmatter.summary && <span>{frontmatter.summary}</span>}
              </header>
            )}
            <div dangerouslySetInnerHTML={{ __html: preview }} />
          </article>
        </div>
        {message && <p className="toast">{message}</p>}
      </section>
    </form>
  );
}

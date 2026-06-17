"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Campaign, WikiPage } from "@/lib/types";

function render(content: string, mode: "gm" | "player") {
  let html = mode === "player" ? content.replace(/:::gm[\s\S]*?:::/g, "") : content.replace(/:::gm/g, '<section class="gm-block"><strong>GM</strong>').replace(/:::/g, "</section>");
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
  const [mode, setMode] = useState<"gm" | "player">("gm");
  const [message, setMessage] = useState("");
  const canManage = campaign.role === "owner" || campaign.role === "gm";

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

  return (
    <form onSubmit={save} className="page-grid">
      <aside className="page-sidebar">
        <h2>{frontmatter.name}</h2>
        <p>{frontmatter.summary || "No summary yet."}</p>
        <div className="badges">
          <span>{frontmatter.category}</span>
          <span>{frontmatter.visibility}</span>
          <span>{frontmatter.approvalStatus}</span>
        </div>
        <label>Summary<textarea value={frontmatter.summary || ""} onChange={(e) => updateField("summary", e.target.value)} /></label>
        <label>Tags<input value={tags.join(", ")} onChange={(e) => updateField("tags", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label>
        <label>Key links<input value={keyLinks.join(", ")} onChange={(e) => updateField("keyLinks", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label>
        <label>Aliases<input value={(frontmatter.aliases || []).join(", ")} onChange={(e) => updateField("aliases", e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} /></label>
        <label>Visibility<select value={frontmatter.visibility} onChange={(e) => updateField("visibility", e.target.value)}><option value="gm">GM only</option><option value="players">Players</option></select></label>
        <label>Approval<select value={frontmatter.approvalStatus} onChange={(e) => updateField("approvalStatus", e.target.value)}><option value="approved">Approved</option><option value="unapproved">Unapproved</option><option value="rejected">Rejected</option></select></label>
        {frontmatter.sourceImport && <p className="muted">Source: {frontmatter.sourceImport}</p>}
        <h3>Key links</h3>
        {keyLinks.map((link: string) => <a key={link} className="nav-link" href={`/campaigns/${campaign.id}/pages/${link}`}>{link}</a>)}
        <h3>Backlinks</h3>
        {(page.backlinks || []).map((link) => <a key={link} className="nav-link" href={`/campaigns/${campaign.id}/pages/${link}`}>{link}</a>)}
      </aside>

      <section className="editor-panel">
        <div className="editor-toolbar">
          <button type="button" className={mode === "gm" ? "active" : ""} onClick={() => setMode("gm")}>GM preview</button>
          <button type="button" className={mode === "player" ? "active" : ""} onClick={() => setMode("player")}>Player preview</button>
          {canManage && <button type="submit">Save commit</button>}
        </div>
        <div className="editor-split">
          <textarea value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} readOnly={!canManage} />
          <article className="preview" dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
        {message && <p className="toast">{message}</p>}
      </section>
    </form>
  );
}

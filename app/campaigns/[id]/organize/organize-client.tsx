"use client";

import { useEffect, useMemo, useState } from "react";
import type { Campaign, WikiPage, CampaignMedia } from "@/lib/types";

type CategoryOption = { id: string; label: string };

const VISIBILITY = [
  { id: "gm", label: "GM only" },
  { id: "players", label: "Players" }
];
const APPROVAL = [
  { id: "approved", label: "Approved" },
  { id: "unapproved", label: "Unapproved" },
  { id: "rejected", label: "Rejected" }
];

const MEDIA_TYPES = ["image", "pdf", "audio", "other"] as const;

function fmtBytes(n?: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function OrganizeClient({ campaign, categories }: { campaign: Campaign; categories: CategoryOption[] }) {
  const [tab, setTab] = useState<"pages" | "media">("pages");

  // ── Pages tab state ──────────────────────────────────────────────
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [setCategory, setSetCategory] = useState("");
  const [setVisibility, setSetVisibility] = useState("");
  const [setApproval, setSetApproval] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // ── Media tab state ───────────────────────────────────────────────
  const [media, setMedia] = useState<CampaignMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaFilter, setMediaFilter] = useState("");
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>("all");
  const [mediaTagFilter, setMediaTagFilter] = useState("");
  const [mediaSelected, setMediaSelected] = useState<Set<string>>(new Set());
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaMessage, setMediaMessage] = useState("");
  const [bulkTagInput, setBulkTagInput] = useState("");

  const catLabel = useMemo(() => new Map(categories.map((c) => [c.id, c.label])), [categories]);

  // ── Pages loading ─────────────────────────────────────────────────
  async function load() {
    setLoading(true);
    const res = await fetch(`/api/campaigns/${campaign.id}/pages?refresh=wait`);
    const data = await res.json();
    setPages(data.pages || []);
    setSelected(new Set());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // ── Media loading (lazy) ──────────────────────────────────────────
  async function loadMedia() {
    setMediaLoading(true);
    const res = await fetch(`/api/campaigns/${campaign.id}/media`);
    const data = await res.json();
    setMedia(data.media || []);
    setMediaSelected(new Set());
    setMediaLoading(false);
    setMediaLoaded(true);
  }
  function switchTab(t: "pages" | "media") {
    setTab(t);
    if (t === "media" && !mediaLoaded) loadMedia();
  }

  // ── Pages filtered ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return pages
      .filter((p) => (catFilter === "all" ? true : p.frontmatter.category === catFilter))
      .filter((p) => (f ? p.frontmatter.name.toLowerCase().includes(f) : true))
      .sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
  }, [pages, filter, catFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.slug));

  // ── Media filtered ────────────────────────────────────────────────
  const filteredMedia = useMemo(() => {
    const f = mediaFilter.trim().toLowerCase();
    const tag = mediaTagFilter.trim().toLowerCase();
    return media
      .filter((m) => (mediaTypeFilter === "all" ? true : m.mediaType === mediaTypeFilter))
      .filter((m) => (f ? m.name.toLowerCase().includes(f) : true))
      .filter((m) => (tag ? (m.tags || []).some((t) => t.toLowerCase().includes(tag)) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [media, mediaFilter, mediaTypeFilter, mediaTagFilter]);

  const allMediaVisible = filteredMedia.length > 0 && filteredMedia.every((m) => mediaSelected.has(m.path));

  const allMediaTags = useMemo(() => {
    const set = new Set<string>();
    media.forEach((m) => (m.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [media]);

  // ── Pages selection ───────────────────────────────────────────────
  function toggle(slug: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(slug) ? next.delete(slug) : next.add(slug); return next; });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (filtered.every((p) => prev.has(p.slug))) filtered.forEach((p) => next.delete(p.slug));
      else filtered.forEach((p) => next.add(p.slug));
      return next;
    });
  }

  // ── Media selection ───────────────────────────────────────────────
  function toggleMedia(path: string) {
    setMediaSelected((prev) => { const next = new Set(prev); next.has(path) ? next.delete(path) : next.add(path); return next; });
  }
  function toggleAllMedia() {
    setMediaSelected((prev) => {
      const next = new Set(prev);
      if (filteredMedia.every((m) => prev.has(m.path))) filteredMedia.forEach((m) => next.delete(m.path));
      else filteredMedia.forEach((m) => next.add(m.path));
      return next;
    });
  }

  // ── Pages bulk apply ──────────────────────────────────────────────
  async function apply() {
    const set: Record<string, string> = {};
    if (setCategory) set.category = setCategory;
    if (setVisibility) set.visibility = setVisibility;
    if (setApproval) set.approvalStatus = setApproval;
    if (!selected.size || !Object.keys(set).length) return;

    const parts: string[] = [];
    if (set.category) parts.push(`category → ${catLabel.get(set.category) || set.category}`);
    if (set.visibility) parts.push(`visibility → ${set.visibility === "players" ? "Players" : "GM only"}`);
    if (set.approvalStatus) parts.push(`approval → ${set.approvalStatus}`);
    if (!window.confirm(`Apply ${parts.join(", ")} to ${selected.size} page${selected.size === 1 ? "" : "s"}?\n\nThis writes a single commit.`)) return;

    setBusy(true);
    setMessage("Applying…");
    const res = await fetch(`/api/campaigns/${campaign.id}/pages/bulk`, {
      method: "PATCH",
      body: JSON.stringify({ slugs: [...selected], set })
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setSetCategory(""); setSetVisibility(""); setSetApproval("");
      setMessage(`Updated ${data.updated} page${data.updated === 1 ? "" : "s"} in one commit.`);
      await load();
    } else {
      setMessage(data.error || "Bulk edit failed.");
    }
  }

  // ── Media bulk delete ─────────────────────────────────────────────
  async function bulkDeleteMedia() {
    if (!mediaSelected.size) return;
    if (!window.confirm(`Permanently delete ${mediaSelected.size} file${mediaSelected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setMediaBusy(true);
    setMediaMessage(`Deleting ${mediaSelected.size} files…`);
    const paths = [...mediaSelected];
    const results = await Promise.all(paths.map((path) =>
      fetch(`/api/campaigns/${campaign.id}/media`, { method: "DELETE", body: JSON.stringify({ path }) })
        .then((r) => r.ok)
    ));
    const deleted = results.filter(Boolean).length;
    setMediaBusy(false);
    setMediaMessage(`Deleted ${deleted} of ${paths.length} files.`);
    await loadMedia();
  }

  // ── Media bulk tag ────────────────────────────────────────────────
  async function bulkAddTag() {
    const tag = bulkTagInput.trim();
    if (!tag || !mediaSelected.size) return;
    setMediaBusy(true);
    setMediaMessage(`Adding tag "${tag}" to ${mediaSelected.size} files…`);
    const paths = [...mediaSelected];
    await Promise.all(paths.map((path) => {
      const m = media.find((x) => x.path === path);
      const tags = [...new Set([...(m?.tags || []), tag])];
      return fetch(`/api/campaigns/${campaign.id}/media`, { method: "PATCH", body: JSON.stringify({ path, tags }) });
    }));
    setBulkTagInput("");
    setMediaBusy(false);
    setMediaMessage(`Tag "${tag}" added to ${paths.length} files.`);
    await loadMedia();
  }

  async function bulkRemoveTag(tag: string) {
    if (!mediaSelected.size) return;
    if (!window.confirm(`Remove tag "${tag}" from ${mediaSelected.size} selected file(s)?`)) return;
    setMediaBusy(true);
    setMediaMessage(`Removing tag "${tag}"…`);
    const paths = [...mediaSelected];
    await Promise.all(paths.map((path) => {
      const m = media.find((x) => x.path === path);
      const tags = (m?.tags || []).filter((t) => t !== tag);
      return fetch(`/api/campaigns/${campaign.id}/media`, { method: "PATCH", body: JSON.stringify({ path, tags }) });
    }));
    setMediaBusy(false);
    setMediaMessage(`Tag "${tag}" removed from ${paths.length} files.`);
    await loadMedia();
  }

  const pendingChange = Boolean(setCategory || setVisibility || setApproval);

  return (
    <section className="organize">
      <div className="tab-row" style={{ marginBottom: "16px" }}>
        <button type="button" className={tab === "pages" ? "tab-btn active" : "tab-btn"} onClick={() => switchTab("pages")}>Pages</button>
        <button type="button" className={tab === "media" ? "tab-btn active" : "tab-btn"} onClick={() => switchTab("media")}>Media</button>
      </div>

      {tab === "pages" && (
        <>
          <div className="organize-toolbar">
            <input placeholder="Filter by name…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <span className="organize-count">{filtered.length} shown · {selected.size} selected</span>
          </div>

          {selected.size > 0 && (
            <div className="bulk-bar">
              <strong>{selected.size} selected</strong>
              <label>Category
                <select value={setCategory} onChange={(e) => setSetCategory(e.target.value)}>
                  <option value="">— keep —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label>Visibility
                <select value={setVisibility} onChange={(e) => setSetVisibility(e.target.value)}>
                  <option value="">— keep —</option>
                  {VISIBILITY.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </label>
              <label>Approval
                <select value={setApproval} onChange={(e) => setSetApproval(e.target.value)}>
                  <option value="">— keep —</option>
                  {APPROVAL.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </label>
              <button type="button" onClick={apply} disabled={busy || !pendingChange}>Apply (1 commit)</button>
              <button type="button" className="secondary" onClick={() => setSelected(new Set())} disabled={busy}>Clear</button>
            </div>
          )}

          {loading ? (
            <p className="muted">Loading pages…</p>
          ) : (
            <div className="organize-table-wrap">
              <table className="organize-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all" /></th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Visibility</th>
                    <th>Approval</th>
                    <th>Parent</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.slug} className={selected.has(p.slug) ? "row-selected" : ""}>
                      <td><input type="checkbox" checked={selected.has(p.slug)} onChange={() => toggle(p.slug)} aria-label={`Select ${p.frontmatter.name}`} /></td>
                      <td><a href={`/campaigns/${campaign.id}/pages/${p.slug}`}>{p.frontmatter.name}</a></td>
                      <td>{catLabel.get(p.frontmatter.category) || p.frontmatter.category}</td>
                      <td>{p.frontmatter.visibility === "players" ? "Players" : "GM only"}</td>
                      <td>{p.frontmatter.approvalStatus}</td>
                      <td>{p.frontmatter.parent || "—"}</td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={6} className="muted">No pages match.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {message && <p className="toast">{message}</p>}
        </>
      )}

      {tab === "media" && (
        <>
          <div className="organize-toolbar">
            <input placeholder="Filter by name…" value={mediaFilter} onChange={(e) => setMediaFilter(e.target.value)} />
            <select value={mediaTypeFilter} onChange={(e) => setMediaTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {MEDIA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Filter by tag…" value={mediaTagFilter} onChange={(e) => setMediaTagFilter(e.target.value)} style={{ width: "140px" }} />
            <span className="organize-count">{filteredMedia.length} shown · {mediaSelected.size} selected</span>
          </div>

          {mediaSelected.size > 0 && (
            <div className="bulk-bar">
              <strong>{mediaSelected.size} selected</strong>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                Add tag
                <input value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)} placeholder="tag name" style={{ width: "120px" }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); bulkAddTag(); } }} />
                <button type="button" onClick={bulkAddTag} disabled={mediaBusy || !bulkTagInput.trim()}>Add</button>
              </label>
              {allMediaTags.filter((t) => [...mediaSelected].some((path) => {
                const m = media.find((x) => x.path === path);
                return (m?.tags || []).includes(t);
              })).slice(0, 8).map((t) => (
                <button key={t} type="button" className="secondary" style={{ fontSize: "11px" }} disabled={mediaBusy}
                  onClick={() => bulkRemoveTag(t)} title={`Remove tag "${t}" from selected`}>✕ {t}</button>
              ))}
              <button type="button" className="danger" onClick={bulkDeleteMedia} disabled={mediaBusy}>Delete {mediaSelected.size} file{mediaSelected.size === 1 ? "" : "s"}</button>
              <button type="button" className="secondary" onClick={() => setMediaSelected(new Set())} disabled={mediaBusy}>Clear</button>
            </div>
          )}

          {mediaLoading ? (
            <p className="muted">Loading media…</p>
          ) : (
            <div className="organize-table-wrap">
              <table className="organize-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" checked={allMediaVisible} onChange={toggleAllMedia} aria-label="Select all media" /></th>
                    <th>Preview</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Tags</th>
                    <th>Alt</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMedia.map((m) => (
                    <tr key={m.path} className={mediaSelected.has(m.path) ? "row-selected" : ""}>
                      <td><input type="checkbox" checked={mediaSelected.has(m.path)} onChange={() => toggleMedia(m.path)} aria-label={`Select ${m.name}`} /></td>
                      <td style={{ width: "48px" }}>
                        {m.mediaType === "image"
                          ? <img src={m.downloadUrl} alt={m.alt || m.name} style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "3px" }} />
                          : <span style={{ fontSize: "20px" }}>{m.mediaType === "pdf" ? "📄" : m.mediaType === "audio" ? "🎵" : "📎"}</span>}
                      </td>
                      <td>
                        <a href={m.downloadUrl} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", fontSize: "13px" }}>{m.name}</a>
                      </td>
                      <td>{m.mediaType}</td>
                      <td>{fmtBytes(m.size)}</td>
                      <td>
                        {(m.tags || []).map((t) => (
                          <span key={t} className="tag-chip">{t}</span>
                        ))}
                      </td>
                      <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)", fontSize: "12px" }}>{m.alt || "—"}</td>
                    </tr>
                  ))}
                  {!filteredMedia.length && <tr><td colSpan={7} className="muted">No media match.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {mediaMessage && <p className="toast">{mediaMessage}</p>}
        </>
      )}
    </section>
  );
}

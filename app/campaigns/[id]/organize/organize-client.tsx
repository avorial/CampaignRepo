"use client";

import { useEffect, useMemo, useState } from "react";
import type { Campaign, WikiPage } from "@/lib/types";

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

export default function OrganizeClient({ campaign, categories }: { campaign: Campaign; categories: CategoryOption[] }) {
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

  const catLabel = useMemo(() => new Map(categories.map((c) => [c.id, c.label])), [categories]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/campaigns/${campaign.id}/pages?refresh=wait`);
    const data = await res.json();
    setPages(data.pages || []);
    setSelected(new Set());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return pages
      .filter((p) => (catFilter === "all" ? true : p.frontmatter.category === catFilter))
      .filter((p) => (f ? p.frontmatter.name.toLowerCase().includes(f) : true))
      .sort((a, b) => a.frontmatter.name.localeCompare(b.frontmatter.name));
  }, [pages, filter, catFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.slug));

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (filtered.every((p) => prev.has(p.slug))) {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.slug));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((p) => next.add(p.slug));
      return next;
    });
  }

  async function apply() {
    const set: Record<string, string> = {};
    if (setCategory) set.category = setCategory;
    if (setVisibility) set.visibility = setVisibility;
    if (setApproval) set.approvalStatus = setApproval;
    const changeCount = Object.keys(set).length;
    if (!selected.size || !changeCount) return;

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
      setSetCategory("");
      setSetVisibility("");
      setSetApproval("");
      setMessage(`Updated ${data.updated} page${data.updated === 1 ? "" : "s"} in one commit.`);
      await load();
    } else {
      setMessage(data.error || "Bulk edit failed.");
    }
  }

  const pendingChange = Boolean(setCategory || setVisibility || setApproval);

  return (
    <section className="organize">
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
    </section>
  );
}

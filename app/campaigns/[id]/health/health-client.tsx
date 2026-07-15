"use client";

import { useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";

type Finding = { type: string; severity: "error" | "warn" | "info"; slug?: string; title: string; detail: string };
type Generated = {
  pageFiles: number;
  manifestPages: number | null;
  searchDocs: number | null;
  cacheRows: number;
  cacheRefreshedAt: string | null;
  cacheRefreshError: string | null;
};
type Health = { pageCount: number; mediaCount?: number; findings: Finding[]; counts: Record<string, number>; generated?: Generated };
type RepairReport = {
  ok: boolean;
  steps: { step: string; ok: boolean; detail: string; error?: string }[];
  counts: { pageFiles: number; cacheRows: number; manifestPages: number; searchDocs: number; emptySourcePages: number; emptyCacheBodies: number };
  emptySourceSlugs: string[];
};

// Display order + friendly labels for each finding type.
const GROUPS: { type: string; label: string }[] = [
  { type: "page-conflict", label: "Page conflicts (local vs remote)" },
  { type: "unsynced-local-edits", label: "Unsynced local edits" },
  { type: "empty-cache-body", label: "Cached pages missing their body" },
  { type: "invalid-manifest", label: "Invalid repository manifest" },
  { type: "stale-manifest", label: "Repository manifest drift" },
  { type: "stale-search-index", label: "Search snapshot drift" },
  { type: "missing-manifest", label: "Missing repository manifest" },
  { type: "missing-search-index", label: "Missing search snapshot" },
  { type: "cache-refresh-error", label: "Page cache refresh errors" },
  { type: "broken-link", label: "Broken wiki links" },
  { type: "invalid-parent", label: "Invalid parents" },
  { type: "parent-mismatch", label: "Parent category mismatch" },
  { type: "missing-media", label: "Missing media" },
  { type: "duplicate-alias", label: "Duplicate aliases" },
  { type: "empty-name", label: "Pages without a name" },
  { type: "unapproved", label: "Unapproved pages" },
  { type: "orphaned-page", label: "Orphaned pages" },
  { type: "broken-relationship", label: "Broken relationship targets" },
  { type: "unknown-relationship-type", label: "Unknown relationship types" },
  { type: "self-relationship", label: "Self relationships" },
  { type: "oversized-file", label: "Oversized media files" },
  { type: "unused-media", label: "Unused media files" },
  { type: "broken-map-pin", label: "Broken map pins" },
  { type: "broken-map-route", label: "Broken map routes" },
  { type: "broken-map-image", label: "Missing map backgrounds" }
];

export default function HealthClient({ campaign }: { campaign: Campaign }) {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [repairing, setRepairing] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/campaigns/${campaign.id}/health`);
    if (res.ok) setData(await res.json());
    else setError((await res.json().catch(() => ({})))?.error || "Could not run health checks.");
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function repairIndexes() {
    setMessage("Rebuilding indexes from page source…");
    const res = await fetch(`/api/campaigns/${campaign.id}/repair`, { method: "POST" });
    const report = (await res.json().catch(() => null)) as RepairReport | null;
    if (!report || !Array.isArray(report.steps)) {
      setMessage("Repair failed to run.");
      return;
    }
    const summary = report.steps.map((step) => `${step.ok ? "✓" : "✕"} ${step.detail}${step.error && !step.ok ? ` (${step.error})` : ""}`).join(" ");
    const empties = report.counts.emptySourcePages
      ? ` ${report.counts.emptySourcePages} page${report.counts.emptySourcePages === 1 ? " is" : "s are"} genuinely empty in source: ${report.emptySourceSlugs.slice(0, 5).join(", ")}${report.emptySourceSlugs.length > 5 ? "…" : ""}.`
      : "";
    setMessage(`${summary}${empties} Re-scanning…`);
    await load();
    setMessage(`${summary}${empties}`);
  }

  async function syncNow() {
    setMessage("Flushing unsynced edits to Git…");
    const res = await fetch(`/api/campaigns/${campaign.id}/sync`, { method: "POST" });
    const result = await res.json().catch(() => null);
    if (result?.error) setMessage(`Sync failed: ${result.error} — edits are still saved locally.`);
    else if (result?.conflicts?.length) setMessage(`Synced ${result.committed} pages; ${result.conflicts.length} conflict${result.conflicts.length === 1 ? "" : "s"} need resolution below.`);
    else setMessage(`Synced ${result?.committed ?? 0} page${result?.committed === 1 ? "" : "s"} to Git.`);
    await load();
  }

  async function resolveConflict(slug: string, resolution: "local" | "remote") {
    setMessage(`Resolving ${slug} (${resolution === "local" ? "keep local" : "take remote"})…`);
    const res = await fetch(`/api/campaigns/${campaign.id}/sync`, {
      method: "PATCH",
      body: JSON.stringify({ slug, resolution })
    });
    const result = await res.json().catch(() => null);
    setMessage(result?.ok ? `Resolved ${slug}.` : result?.error || "Could not resolve conflict.");
    await load();
  }

  async function bulkRepair(slugs: string[], set: Record<string, string>, label: string) {
    setRepairing((prev) => new Set([...prev, ...slugs]));
    setMessage(`${label}…`);
    const res = await fetch(`/api/campaigns/${campaign.id}/pages/bulk`, {
      method: "PATCH",
      body: JSON.stringify({ slugs, set })
    });
    setRepairing(new Set());
    if (res.ok) {
      const out = await res.json();
      setMessage(`Fixed ${out.updated} pages. Re-scanning…`);
      await load();
      setMessage("");
    } else {
      setMessage((await res.json().catch(() => ({})))?.error || "Repair failed.");
    }
  }

  if (loading) return <p className="muted">Scanning every page…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const total = data.findings.length;
  const groupsWithFindings = GROUPS.filter((g) => (data.counts[g.type] || 0) > 0);

  return (
    <section className="health">
      <div className="health-summary">
        {total === 0 ? (
          <p className="health-clean">✓ No issues found across {data.pageCount} pages{data.mediaCount ? ` and ${data.mediaCount} media files` : ""}.</p>
        ) : (
          <p className="muted">{total} finding{total === 1 ? "" : "s"} across {data.pageCount} pages{data.mediaCount ? ` and ${data.mediaCount} media files` : ""}.</p>
        )}
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="secondary" onClick={repairIndexes} title="Rebuild the repository manifest, search snapshot, and page cache from the Markdown page source">Repair indexes</button>
          <button type="button" className="secondary" onClick={load}>Re-scan</button>
        </div>
      </div>
      {data.generated && (
        <p className="muted">
          Generated state: {data.generated.pageFiles} page files · manifest {data.generated.manifestPages ?? "—"} · search {data.generated.searchDocs ?? "—"} · cache {data.generated.cacheRows}
          {data.generated.cacheRefreshedAt ? ` (refreshed ${data.generated.cacheRefreshedAt})` : ""}
        </p>
      )}
      {message && <p className="toast">{message}</p>}

      {groupsWithFindings.map((group) => {
        const items = data.findings.filter((f) => f.type === group.type);
        const severity = items[0]?.severity || "info";
        const slugsWithParent = items.filter((f) => f.slug).map((f) => f.slug as string);
        return (
          <section className="band" key={group.type}>
            <div className="section-heading">
              <h2>{group.label}</h2>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {group.type === "unsynced-local-edits" && (
                  <button type="button" className="secondary" onClick={syncNow}>Sync now</button>
                )}
                {group.type === "unapproved" && (
                  <button type="button" className="secondary"
                    disabled={repairing.size > 0}
                    onClick={() => bulkRepair(slugsWithParent, { approvalStatus: "approved" }, "Approving all")}>
                    Approve all
                  </button>
                )}
                {(group.type === "invalid-parent" || group.type === "parent-mismatch") && (
                  <button type="button" className="secondary"
                    disabled={repairing.size > 0}
                    onClick={() => bulkRepair(slugsWithParent, { parent: "" }, "Clearing parents")}>
                    Clear all parents
                  </button>
                )}
                <span className={`health-badge sev-${severity}`}>{items.length}</span>
              </div>
            </div>
            {group.type === "orphaned-page" && (
              <p className="muted">These pages have no incoming links and no parent. They can&apos;t be discovered through navigation — add a link or set a parent.</p>
            )}
            <div className="review-list">
              {items.map((f, i) => (
                <article className="review-row" key={`${f.type}-${f.slug || ""}-${i}`}>
                  <div>
                    {f.slug ? (
                      <a href={`/campaigns/${campaign.id}/pages/${f.slug}`}><strong>{f.title}</strong></a>
                    ) : (
                      <strong>{f.title}</strong>
                    )}
                    <p>{f.detail}</p>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                    {group.type === "page-conflict" && f.slug && (
                      <>
                        <button type="button" className="secondary" style={{ fontSize: "11px", padding: "2px 8px" }}
                          onClick={() => resolveConflict(f.slug!, "local")}>Keep local</button>
                        <button type="button" className="secondary" style={{ fontSize: "11px", padding: "2px 8px" }}
                          onClick={() => resolveConflict(f.slug!, "remote")}>Take remote</button>
                      </>
                    )}
                    {(group.type === "invalid-parent" || group.type === "parent-mismatch") && f.slug && (
                      <button type="button" className="secondary"
                        style={{ fontSize: "11px", padding: "2px 8px" }}
                        disabled={repairing.has(f.slug)}
                        onClick={() => bulkRepair([f.slug!], { parent: "" }, "Clearing parent")}>
                        Clear parent
                      </button>
                    )}
                    <span className={`health-badge sev-${f.severity}`}>{f.severity}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}

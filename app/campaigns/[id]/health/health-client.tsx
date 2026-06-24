"use client";

import { useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";

type Finding = { type: string; severity: "error" | "warn" | "info"; slug?: string; title: string; detail: string };
type Health = { pageCount: number; findings: Finding[]; counts: Record<string, number> };

// Display order + friendly labels for each finding type.
const GROUPS: { type: string; label: string }[] = [
  { type: "broken-link", label: "Broken wiki links" },
  { type: "invalid-parent", label: "Invalid parents" },
  { type: "parent-mismatch", label: "Parent category mismatch" },
  { type: "missing-media", label: "Missing media" },
  { type: "duplicate-alias", label: "Duplicate aliases" },
  { type: "empty-name", label: "Pages without a name" },
  { type: "unapproved", label: "Unapproved pages" }
];

export default function HealthClient({ campaign }: { campaign: Campaign }) {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (loading) return <p className="muted">Scanning every page…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const total = data.findings.length;
  const groupsWithFindings = GROUPS.filter((g) => (data.counts[g.type] || 0) > 0);

  return (
    <section className="health">
      <div className="health-summary">
        {total === 0 ? (
          <p className="health-clean">✓ No issues found across {data.pageCount} pages.</p>
        ) : (
          <p className="muted">{total} finding{total === 1 ? "" : "s"} across {data.pageCount} pages.</p>
        )}
        <button type="button" className="secondary" onClick={load}>Re-scan</button>
      </div>

      {groupsWithFindings.map((group) => {
        const items = data.findings.filter((f) => f.type === group.type);
        const severity = items[0]?.severity || "info";
        return (
          <section className="band" key={group.type}>
            <div className="section-heading">
              <h2>{group.label}</h2>
              <span className={`health-badge sev-${severity}`}>{items.length}</span>
            </div>
            {group.type === "unapproved" && (
              <p className="muted">
                Approve these from the <a href={`/campaigns/${campaign.id}/admin`}>review queue</a> (or bulk-set approval in <a href={`/campaigns/${campaign.id}/organize`}>Organize</a>).
              </p>
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
                  <span className={`health-badge sev-${f.severity}`}>{f.severity}</span>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}

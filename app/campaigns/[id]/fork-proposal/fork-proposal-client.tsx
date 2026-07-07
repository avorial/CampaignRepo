"use client";

import { useState } from "react";

export default function ForkProposalClient({ campaignId, forkOf, pages }: {
  campaignId: number;
  forkOf: string;
  pages: { slug: string; name: string }[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string; githubPrUrl?: string | null } | null>(null);

  function toggle(slug: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });
  }

  async function submit() {
    if (!title.trim() || selected.size === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/fork-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, pages: [...selected] })
      });
      const data = await res.json();
      if (res.ok) setResult({ ok: true, githubPrUrl: data.githubPrUrl || null });
      else setResult({ error: data.error || "Could not submit proposal." });
    } finally {
      setBusy(false);
    }
  }

  if (result?.ok) {
    return (
      <section className="panel" style={{ maxWidth: 640, margin: "40px auto", padding: 32, textAlign: "center" }}>
        <h2>Proposal submitted</h2>
        <p className="muted">The source world owner has been notified and can review your proposed pages.</p>
        {result.githubPrUrl && (
          <p style={{ marginTop: 16 }}>
            <a href={result.githubPrUrl} className="button secondary" target="_blank" rel="noreferrer">Open GitHub pull request</a>
          </p>
        )}
        <a href={`/campaigns/${campaignId}`} className="button" style={{ marginTop: 16 }}>Back to campaign</a>
      </section>
    );
  }

  return (
    <section className="panel" style={{ maxWidth: 640, margin: "40px auto", padding: 32 }}>
      <div className="stack">
        <div>
          <p className="muted" style={{ marginBottom: 16 }}>
            Select the pages you've improved, add a summary, and submit. The source world owner will see your proposal in their GM Admin panel.
          </p>
        </div>

        <label>
          Title <span className="muted">(required)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Fixed typos in character descriptions"
            maxLength={200}
          />
        </label>

        <label>
          Description <span className="muted">(optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Briefly describe your changes and why they improve the world…"
            rows={4}
            maxLength={2000}
          />
        </label>

        <div>
          <p style={{ fontSize: 13, marginBottom: 8, color: "var(--text-secondary)" }}>
            Pages to include ({selected.size} selected)
          </p>
          <div className="fork-page-grid">
            {pages.map((p) => (
              <label key={p.slug} className={`fork-page-row${selected.has(p.slug) ? " selected" : ""}`}>
                <input type="checkbox" checked={selected.has(p.slug)} onChange={() => toggle(p.slug)} />
                <span>{p.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>{p.slug}</span>
              </label>
            ))}
          </div>
          {!pages.length && <p className="muted">No pages found in this campaign.</p>}
        </div>

        {result?.error && <p className="error">{result.error}</p>}

        <button onClick={submit} disabled={busy || !title.trim() || selected.size === 0}>
          {busy ? "Submitting…" : `Submit proposal (${selected.size} page${selected.size === 1 ? "" : "s"})`}
        </button>
      </div>
    </section>
  );
}

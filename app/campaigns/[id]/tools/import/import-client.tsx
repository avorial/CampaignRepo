"use client";

import { useState } from "react";

type ImportResult = { slug: string; name: string; created: boolean; error?: string };
type ImportResponse = { results: ImportResult[]; created: number; updated: number; errors: number; total: number; error?: string };

const CATEGORY_OPTIONS = ["character", "npc", "location", "faction", "item", "lore", "event", "session", "quest", "creature"];
const VISIBILITY_OPTIONS = ["gm", "players"] as const;
const APPROVAL_OPTIONS = ["unapproved", "approved", "rejected"] as const;

const CSV_EXAMPLE = `name,category,summary,tags,visibility,content
Aldric Vayne,character,"Former knight turned rogue","human,knight",gm,"Aldric carries a family sword with a broken crossguard."
The Rustwood Inn,location,"Roadside tavern in Thornmere","inn,tavern",players,`;

export default function ImportClient({ campaignId, campaignName }: { campaignId: number; campaignName: string }) {
  const api = `/api/campaigns/${campaignId}`;

  const [activeTab, setActiveTab] = useState<"csv" | "foundry" | "export">("csv");

  // CSV import state
  const [csvText, setCsvText] = useState("");
  const [csvCategory, setCsvCategory] = useState("npc");
  const [csvVisibility, setCsvVisibility] = useState<"gm" | "players">("gm");
  const [csvApproval, setCsvApproval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvResult, setCsvResult] = useState<ImportResponse | null>(null);

  // Foundry journal import state
  const [journalJson, setJournalJson] = useState("");
  const [journalCategory, setJournalCategory] = useState("lore");
  const [journalVisibility, setJournalVisibility] = useState<"gm" | "players">("gm");
  const [journalApproval, setJournalApproval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [journalBusy, setJournalBusy] = useState(false);
  const [journalResult, setJournalResult] = useState<ImportResponse | null>(null);

  async function runCsvImport() {
    if (!csvText.trim()) return;
    setCsvBusy(true);
    setCsvResult(null);
    try {
      const res = await fetch(`${api}/imports/csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, defaultCategory: csvCategory, visibility: csvVisibility, approvalStatus: csvApproval })
      });
      setCsvResult(await res.json());
    } finally {
      setCsvBusy(false);
    }
  }

  async function runJournalImport() {
    let json: unknown;
    try { json = JSON.parse(journalJson); } catch { setJournalResult({ results: [], created: 0, updated: 0, errors: 0, total: 0, error: "Invalid JSON. Paste raw Foundry journal JSON." }); return; }
    setJournalBusy(true);
    setJournalResult(null);
    try {
      const res = await fetch(`${api}/imports/journals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json, category: journalCategory, visibility: journalVisibility, approvalStatus: journalApproval })
      });
      setJournalResult(await res.json());
    } finally {
      setJournalBusy(false);
    }
  }

  function loadCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText((ev.target?.result as string) || "");
    reader.readAsText(file);
  }

  function loadJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJournalJson((ev.target?.result as string) || "");
    reader.readAsText(file);
  }

  return (
    <div className="import-shell">
      <div className="tab-row">
        <button className={`tab-btn${activeTab === "csv" ? " active" : ""}`} onClick={() => setActiveTab("csv")}>CSV Bulk Import</button>
        <button className={`tab-btn${activeTab === "foundry" ? " active" : ""}`} onClick={() => setActiveTab("foundry")}>Foundry Journals</button>
        <button className={`tab-btn${activeTab === "export" ? " active" : ""}`} onClick={() => setActiveTab("export")}>Export</button>
      </div>

      {activeTab === "csv" && (
        <div className="import-panel stack">
          <div className="import-intro">
            <p>Paste CSV or upload a file. Supported columns (case-insensitive, any order):</p>
            <p className="muted" style={{ fontSize: "12px" }}>
              <code>name</code> (required) · <code>category</code> · <code>summary</code> · <code>tags</code> (comma-separated) · <code>visibility</code> · <code>content</code>
            </p>
          </div>

          <div className="import-options">
            <label>Default category
              <select value={csvCategory} onChange={(e) => setCsvCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Visibility
              <select value={csvVisibility} onChange={(e) => setCsvVisibility(e.target.value as "gm" | "players")}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Approval status
              <select value={csvApproval} onChange={(e) => setCsvApproval(e.target.value as "approved" | "unapproved" | "rejected")}>
                {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          <div>
            <label className="file-upload-row">
              Upload CSV file
              <input type="file" accept=".csv,text/csv" onChange={loadCsvFile} style={{ marginLeft: 8 }} />
            </label>
          </div>

          <textarea
            className="import-textarea"
            placeholder={CSV_EXAMPLE}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={runCsvImport} disabled={csvBusy || !csvText.trim()}>
              {csvBusy ? "Importing…" : "Import CSV"}
            </button>
            <button className="secondary" onClick={() => setCsvText(CSV_EXAMPLE)}>Load example</button>
          </div>

          {csvResult && <ImportResultPanel result={csvResult} api={`/campaigns/${campaignId}`} />}
        </div>
      )}

      {activeTab === "foundry" && (
        <div className="import-panel stack">
          <div className="import-intro">
            <p>Paste Foundry VTT journal JSON. Accepts a single Journal Entry object, an array of entries, or a world export containing a <code>journals</code> array.</p>
            <p className="muted" style={{ fontSize: "12px" }}>HTML content is converted to Markdown. Multi-page journals become a single page with <code>##</code> section headings.</p>
          </div>

          <div className="import-options">
            <label>Default category
              <select value={journalCategory} onChange={(e) => setJournalCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Visibility
              <select value={journalVisibility} onChange={(e) => setJournalVisibility(e.target.value as "gm" | "players")}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Approval status
              <select value={journalApproval} onChange={(e) => setJournalApproval(e.target.value as "approved" | "unapproved" | "rejected")}>
                {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          <label className="file-upload-row">
            Upload JSON file
            <input type="file" accept=".json,application/json" onChange={loadJsonFile} style={{ marginLeft: 8 }} />
          </label>

          <textarea
            className="import-textarea"
            placeholder={`Paste Foundry journal JSON here…\n\nExample:\n{"_id":"abc","name":"The Ash Keep","pages":[{"name":"Overview","text":{"content":"<p>A fortress overlooking…</p>"}}]}`}
            value={journalJson}
            onChange={(e) => setJournalJson(e.target.value)}
            rows={12}
          />

          <button onClick={runJournalImport} disabled={journalBusy || !journalJson.trim()}>
            {journalBusy ? "Importing…" : "Import journals"}
          </button>

          {journalResult && <ImportResultPanel result={journalResult} api={`/campaigns/${campaignId}`} />}
        </div>
      )}

      {activeTab === "export" && (
        <div className="import-panel stack">
          <h3>Export campaign</h3>
          <p>Download all wiki pages as a portable archive. This is a snapshot — it does not include media files.</p>

          <div className="export-options">
            <div className="export-option panel">
              <div className="export-option-header">
                <strong>ZIP archive</strong>
                <span className="tag-chip">Recommended</span>
              </div>
              <p className="muted" style={{ fontSize: "13px" }}>
                All pages as Markdown files, preserving <code>wiki/pages/</code> folder structure. Open in Obsidian, VS Code, or any text editor.
              </p>
              <a
                href={`/api/campaigns/${campaignId}/export?format=zip`}
                className="button"
                download={`${campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-export.zip`}
              >
                Download ZIP
              </a>
            </div>

            <div className="export-option panel">
              <div className="export-option-header">
                <strong>JSON bundle</strong>
              </div>
              <p className="muted" style={{ fontSize: "13px" }}>
                All pages as a single JSON file with frontmatter and content. Useful for scripting or re-importing into CampaignRepo.
              </p>
              <a
                href={`/api/campaigns/${campaignId}/export?format=json`}
                className="button secondary"
                download={`${campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-export.json`}
              >
                Download JSON
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportResultPanel({ result, api }: { result: ImportResponse; api: string }) {
  if (result.error) return <p className="error">{result.error}</p>;
  const errors = result.results?.filter((r) => r.error) || [];
  return (
    <div className="import-result">
      <p className="import-result-summary">
        <strong>{result.created}</strong> created &middot; <strong>{result.updated}</strong> updated
        {result.errors > 0 && <span className="error"> &middot; {result.errors} failed</span>}
        {" "}— {result.total} total rows
      </p>
      {errors.length > 0 && (
        <ul className="import-errors">
          {errors.map((r, i) => <li key={i}><code>{r.name}</code>: {r.error}</li>)}
        </ul>
      )}
      {result.results?.filter((r) => !r.error).slice(0, 12).map((r) => (
        <a key={r.slug} href={`${api}/pages/${r.slug}`} className="tag-chip" style={{ marginRight: 4, marginBottom: 4 }}>
          {r.name}
        </a>
      ))}
      {result.total > 12 && <span className="muted" style={{ fontSize: "12px" }}> +{result.total - 12} more</span>}
    </div>
  );
}

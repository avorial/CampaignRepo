"use client";

import { useState } from "react";

type ImportResult = { slug: string; name: string; created: boolean; error?: string };
type ImportResponse = { results: ImportResult[]; created: number; updated: number; errors: number; total: number; error?: string };

const CATEGORY_OPTIONS = ["character", "npc", "location", "faction", "item", "lore", "event", "session", "quest", "creature"];
const VISIBILITY_OPTIONS = ["gm", "players"] as const;
const APPROVAL_OPTIONS = ["unapproved", "approved", "rejected"] as const;

type FileEntry = { name: string; content: string };

function readFileList(files: File[]): Promise<FileEntry[]> {
  return Promise.all(
    files.map(
      (f) =>
        new Promise<FileEntry>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, content: (e.target?.result as string) || "" });
          reader.onerror = reject;
          reader.readAsText(f);
        })
    )
  );
}

const CSV_EXAMPLE = `name,category,summary,tags,visibility,content
Aldric Vayne,character,"Former knight turned rogue","human,knight",gm,"Aldric carries a family sword with a broken crossguard."
The Rustwood Inn,location,"Roadside tavern in Thornmere","inn,tavern",players,`;

export default function ImportClient({ campaignId, campaignName }: { campaignId: number; campaignName: string }) {
  const api = `/api/campaigns/${campaignId}`;

  const [activeTab, setActiveTab] = useState<"csv" | "foundry" | "obsidian" | "notion" | "worldanvil" | "export">("csv");

  // Obsidian vault import state
  const [obsidianFiles, setObsidianFiles] = useState<FileEntry[]>([]);
  const [obsidianCategory, setObsidianCategory] = useState("lore");
  const [obsidianVisibility, setObsidianVisibility] = useState<"gm" | "players">("gm");
  const [obsidianApproval, setObsidianApproval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [obsidianFolderCat, setObsidianFolderCat] = useState(true);
  const [obsidianBusy, setObsidianBusy] = useState(false);
  const [obsidianResult, setObsidianResult] = useState<ImportResponse | null>(null);

  // Notion export import state
  const [notionFiles, setNotionFiles] = useState<FileEntry[]>([]);
  const [notionCategory, setNotionCategory] = useState("lore");
  const [notionVisibility, setNotionVisibility] = useState<"gm" | "players">("gm");
  const [notionApproval, setNotionApproval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [notionBusy, setNotionBusy] = useState(false);
  const [notionResult, setNotionResult] = useState<ImportResponse | null>(null);

  // World Anvil import state
  const [waJson, setWaJson] = useState("");
  const [waVisibility, setWaVisibility] = useState<"gm" | "players">("gm");
  const [waApproval, setWaApproval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [waBusy, setWaBusy] = useState(false);
  const [waResult, setWaResult] = useState<ImportResponse | null>(null);

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

  async function runWaImport() {
    let json: unknown;
    try { json = JSON.parse(waJson); } catch { setWaResult({ results: [], created: 0, updated: 0, errors: 0, total: 0, error: "Invalid JSON. Paste the World Anvil export JSON." }); return; }
    setWaBusy(true);
    setWaResult(null);
    try {
      const res = await fetch(`${api}/imports/worldanvil`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json, visibility: waVisibility, approvalStatus: waApproval })
      });
      setWaResult(await res.json());
    } finally {
      setWaBusy(false);
    }
  }

  function loadWaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setWaJson((ev.target?.result as string) || "");
    reader.readAsText(file);
  }

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

  async function loadObsidianFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const all = Array.from(files);
    const mdFiles = all.filter((f) => f.name.endsWith(".md"));
    setObsidianFiles(await readFileList(mdFiles.length ? mdFiles : all));
    setObsidianResult(null);
  }

  async function runObsidianImport() {
    if (!obsidianFiles.length) return;
    setObsidianBusy(true);
    setObsidianResult(null);
    try {
      const res = await fetch(`${api}/imports/obsidian`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: obsidianFiles, defaultCategory: obsidianCategory, visibility: obsidianVisibility, approvalStatus: obsidianApproval, folderAsCategory: obsidianFolderCat })
      });
      setObsidianResult(await res.json());
    } finally {
      setObsidianBusy(false);
    }
  }

  async function loadNotionFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const all = Array.from(files);
    const mdFiles = all.filter((f) => f.name.endsWith(".md"));
    setNotionFiles(await readFileList(mdFiles.length ? mdFiles : all));
    setNotionResult(null);
  }

  async function runNotionImport() {
    if (!notionFiles.length) return;
    setNotionBusy(true);
    setNotionResult(null);
    try {
      const res = await fetch(`${api}/imports/notion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: notionFiles, defaultCategory: notionCategory, visibility: notionVisibility, approvalStatus: notionApproval })
      });
      setNotionResult(await res.json());
    } finally {
      setNotionBusy(false);
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
        <button className={`tab-btn${activeTab === "csv" ? " active" : ""}`} onClick={() => setActiveTab("csv")}>CSV</button>
        <button className={`tab-btn${activeTab === "foundry" ? " active" : ""}`} onClick={() => setActiveTab("foundry")}>Foundry</button>
        <button className={`tab-btn${activeTab === "obsidian" ? " active" : ""}`} onClick={() => setActiveTab("obsidian")}>Obsidian</button>
        <button className={`tab-btn${activeTab === "notion" ? " active" : ""}`} onClick={() => setActiveTab("notion")}>Notion</button>
        <button className={`tab-btn${activeTab === "worldanvil" ? " active" : ""}`} onClick={() => setActiveTab("worldanvil")}>World Anvil</button>
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

      {activeTab === "obsidian" && (
        <div className="import-panel stack">
          <div className="import-intro">
            <p>Import from an Obsidian vault. Select the vault folder or individual <code>.md</code> files. YAML frontmatter (<code>title</code>, <code>tags</code>, <code>summary</code>) is preserved. <code>[[wikilinks]]</code> pass through as-is.</p>
            <p className="muted" style={{ fontSize: "12px" }}>
              Folder names map automatically to categories (e.g. <code>characters/</code> → character). Disable below to use the default category for all files.
            </p>
          </div>

          <div className="import-options">
            <label>Default category
              <select value={obsidianCategory} onChange={(e) => setObsidianCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Visibility
              <select value={obsidianVisibility} onChange={(e) => setObsidianVisibility(e.target.value as "gm" | "players")}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Approval status
              <select value={obsidianApproval} onChange={(e) => setObsidianApproval(e.target.value as "approved" | "unapproved" | "rejected")}>
                {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={obsidianFolderCat} onChange={(e) => setObsidianFolderCat(e.target.checked)} />
            Infer category from folder name
          </label>

          <label className="file-upload-row">
            Select vault folder or .md files
            <input
              type="file"
              accept=".md"
              multiple
              // @ts-expect-error webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              onChange={loadObsidianFolder}
              style={{ marginLeft: 8 }}
            />
          </label>

          {obsidianFiles.length > 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              {obsidianFiles.length} .md file{obsidianFiles.length !== 1 ? "s" : ""} selected
            </p>
          )}

          <button onClick={runObsidianImport} disabled={obsidianBusy || obsidianFiles.length === 0}>
            {obsidianBusy ? "Importing…" : `Import ${obsidianFiles.length > 0 ? obsidianFiles.length + " files" : "vault"}`}
          </button>

          {obsidianResult && <ImportResultPanel result={obsidianResult} api={`/campaigns/${campaignId}`} />}
        </div>
      )}

      {activeTab === "notion" && (
        <div className="import-panel stack">
          <div className="import-intro">
            <p>Import from a Notion markdown export. In Notion, go to <strong>Settings → Export → Markdown &amp; CSV</strong>, then select the exported <code>.md</code> files here.</p>
            <p className="muted" style={{ fontSize: "12px" }}>
              Page titles are inferred from file names (Notion&apos;s trailing IDs are stripped). Property lines at the top of each file are extracted as frontmatter.
            </p>
          </div>

          <div className="import-options">
            <label>Default category
              <select value={notionCategory} onChange={(e) => setNotionCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Visibility
              <select value={notionVisibility} onChange={(e) => setNotionVisibility(e.target.value as "gm" | "players")}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Approval status
              <select value={notionApproval} onChange={(e) => setNotionApproval(e.target.value as "approved" | "unapproved" | "rejected")}>
                {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          <label className="file-upload-row">
            Select Notion export folder or .md files
            <input
              type="file"
              accept=".md"
              multiple
              // @ts-expect-error webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              onChange={loadNotionFolder}
              style={{ marginLeft: 8 }}
            />
          </label>

          {notionFiles.length > 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              {notionFiles.length} .md file{notionFiles.length !== 1 ? "s" : ""} selected
            </p>
          )}

          <button onClick={runNotionImport} disabled={notionBusy || notionFiles.length === 0}>
            {notionBusy ? "Importing…" : `Import ${notionFiles.length > 0 ? notionFiles.length + " files" : "pages"}`}
          </button>

          {notionResult && <ImportResultPanel result={notionResult} api={`/campaigns/${campaignId}`} />}
        </div>
      )}

      {activeTab === "worldanvil" && (
        <div className="import-panel stack">
          <div className="import-intro">
            <p>Import from World Anvil. In World Anvil, go to <strong>World → Export World</strong> and download the JSON export. Paste or upload it here.</p>
            <p className="muted" style={{ fontSize: "12px" }}>
              Accepts the full world JSON export (with an <code>articles</code> array) or a single article object. HTML is converted to Markdown. Sections marked as secrets are stripped.
            </p>
          </div>

          <div className="import-options">
            <label>Visibility
              <select value={waVisibility} onChange={(e) => setWaVisibility(e.target.value as "gm" | "players")}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Approval status
              <select value={waApproval} onChange={(e) => setWaApproval(e.target.value as "approved" | "unapproved" | "rejected")}>
                {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          <label className="file-upload-row">
            Upload JSON export
            <input type="file" accept=".json,application/json" onChange={loadWaFile} style={{ marginLeft: 8 }} />
          </label>

          <textarea
            className="import-textarea"
            placeholder={`Paste World Anvil JSON export here…\n\nExample:\n{"articles":[{"title":"The Dragon Queen","entityClass":"Character","content":"<p>A powerful dragon…</p>","excerpt":"She rules from Ember Throne.","tags":[{"title":"dragon"}]}]}`}
            value={waJson}
            onChange={(e) => setWaJson(e.target.value)}
            rows={12}
          />

          <button onClick={runWaImport} disabled={waBusy || !waJson.trim()}>
            {waBusy ? "Importing…" : "Import articles"}
          </button>

          {waResult && <ImportResultPanel result={waResult} api={`/campaigns/${campaignId}`} />}
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

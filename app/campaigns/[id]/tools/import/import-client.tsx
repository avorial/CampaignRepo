"use client";

import { useState } from "react";

type ImportResult = { slug: string; name: string; created: boolean; error?: string };
type ImportResponse = { results: ImportResult[]; created: number; updated: number; errors: number; total: number; error?: string };
type ActorFieldChange = { field: string; before: string; after: string };
type ActorPreviewEntry = { slug: string; name: string; isNew: boolean; bodyChanged: boolean; bodyBefore: number; bodyAfter: number; changes: ActorFieldChange[] };

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

  const [activeTab, setActiveTab] = useState<"csv" | "characters" | "foundry" | "obsidian" | "notion" | "worldanvil" | "googledocs" | "roll20" | "legendkeeper" | "export">("csv");

  // Single character JSON import state (custom field-path mapping)
  const [charSource, setCharSource] = useState<"foundry" | "generic">("foundry");
  const [charVisibility, setCharVisibility] = useState<"gm" | "players">("gm");
  const [charApproval, setCharApproval] = useState<"approved" | "unapproved" | "rejected">("approved");
  const [charMap, setCharMap] = useState({ name: "", biography: "", items: "", category: "", summary: "", tags: "" });
  const [charJson, setCharJson] = useState("");
  const [charBusy, setCharBusy] = useState(false);
  const [charError, setCharError] = useState("");

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

  // Google Docs import state
  const [gdFiles, setGdFiles] = useState<FileEntry[]>([]);
  const [gdCategory, setGdCategory] = useState("lore");
  const [gdVisibility, setGdVisibility] = useState<"gm" | "players">("gm");
  const [gdApproval, setGdApproval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [gdBusy, setGdBusy] = useState(false);
  const [gdResult, setGdResult] = useState<ImportResponse | null>(null);

  // Roll20 import state
  const [r20Json, setR20Json] = useState("");
  const [r20Visibility, setR20Visibility] = useState<"gm" | "players">("gm");
  const [r20Approval, setR20Approval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [r20IncludeHandouts, setR20IncludeHandouts] = useState(true);
  const [r20Busy, setR20Busy] = useState(false);
  const [r20Result, setR20Result] = useState<ImportResponse | null>(null);

  // LegendKeeper import state
  const [lkJson, setLkJson] = useState("");
  const [lkVisibility, setLkVisibility] = useState<"gm" | "players">("gm");
  const [lkApproval, setLkApproval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [lkBusy, setLkBusy] = useState(false);
  const [lkResult, setLkResult] = useState<ImportResponse | null>(null);

  // Foundry sub-tab
  const [foundryTab, setFoundryTab] = useState<"journals" | "actors">("journals");

  // Foundry journal import state
  const [journalJson, setJournalJson] = useState("");
  const [journalCategory, setJournalCategory] = useState("lore");
  const [journalVisibility, setJournalVisibility] = useState<"gm" | "players">("gm");
  const [journalApproval, setJournalApproval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [journalBusy, setJournalBusy] = useState(false);
  const [journalResult, setJournalResult] = useState<ImportResponse | null>(null);

  // Foundry actors import state
  const [actorJson, setActorJson] = useState("");
  const [actorVisibility, setActorVisibility] = useState<"gm" | "players">("gm");
  const [actorApproval, setActorApproval] = useState<"approved" | "unapproved" | "rejected">("unapproved");
  const [actorBusy, setActorBusy] = useState(false);
  const [actorResult, setActorResult] = useState<ImportResponse | null>(null);
  const [actorPreviews, setActorPreviews] = useState<ActorPreviewEntry[] | null>(null);

  async function runCharImport() {
    let sourceJson: unknown;
    try { sourceJson = JSON.parse(charJson || "{}"); } catch { setCharError("Import JSON is invalid."); return; }
    if (!sourceJson || typeof sourceJson !== "object" || Array.isArray(sourceJson)) {
      setCharError("Paste a single character object (not an array). For batches, use the Foundry or CSV tabs.");
      return;
    }
    setCharBusy(true);
    setCharError("");
    try {
      const res = await fetch(`${api}/imports/characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: charSource, visibility: charVisibility, approvalStatus: charApproval, mapping: charMap, sourceJson })
      });
      const data = await res.json();
      if (res.ok && data.slug) { window.location.href = `/campaigns/${campaignId}/pages/${data.slug}`; return; }
      setCharError(data.error || "Import failed.");
    } finally {
      setCharBusy(false);
    }
  }

  function loadCharFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCharJson((ev.target?.result as string) || "");
    reader.readAsText(file);
  }

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

  async function previewActorImport() {
    let json: unknown;
    try { json = JSON.parse(actorJson); } catch { setActorResult({ results: [], created: 0, updated: 0, errors: 0, total: 0, error: "Invalid JSON. Paste Foundry Actor JSON." }); return; }
    setActorBusy(true);
    setActorResult(null);
    setActorPreviews(null);
    try {
      const res = await fetch(`${api}/imports/foundry-actors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json, visibility: actorVisibility, approvalStatus: actorApproval, preview: true })
      });
      const data = await res.json();
      if (data.previews) setActorPreviews(data.previews);
      else setActorResult(data);
    } finally {
      setActorBusy(false);
    }
  }

  async function runActorImport() {
    let json: unknown;
    try { json = JSON.parse(actorJson); } catch { setActorResult({ results: [], created: 0, updated: 0, errors: 0, total: 0, error: "Invalid JSON. Paste Foundry Actor JSON." }); return; }
    setActorBusy(true);
    setActorResult(null);
    setActorPreviews(null);
    try {
      const res = await fetch(`${api}/imports/foundry-actors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json, visibility: actorVisibility, approvalStatus: actorApproval })
      });
      setActorResult(await res.json());
    } finally {
      setActorBusy(false);
    }
  }

  async function runR20Import() {
    let json: unknown;
    try { json = JSON.parse(r20Json); } catch { setR20Result({ results: [], created: 0, updated: 0, errors: 0, total: 0, error: "Invalid JSON. Paste the Roll20 campaign export JSON." }); return; }
    setR20Busy(true);
    setR20Result(null);
    try {
      const res = await fetch(`${api}/imports/roll20`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json, visibility: r20Visibility, approvalStatus: r20Approval, includeHandouts: r20IncludeHandouts })
      });
      setR20Result(await res.json());
    } finally {
      setR20Busy(false);
    }
  }

  function loadR20File(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setR20Json((ev.target?.result as string) || "");
    reader.readAsText(file);
  }

  async function runLKImport() {
    let json: unknown;
    try { json = JSON.parse(lkJson); } catch { setLkResult({ results: [], created: 0, updated: 0, errors: 0, total: 0, error: "Invalid JSON. Paste a LegendKeeper JSON export." }); return; }
    setLkBusy(true);
    setLkResult(null);
    try {
      const res = await fetch(`${api}/imports/legendkeeper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json, visibility: lkVisibility, approvalStatus: lkApproval })
      });
      setLkResult(await res.json());
    } finally {
      setLkBusy(false);
    }
  }

  function loadLKFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLkJson((ev.target?.result as string) || "");
    reader.readAsText(file);
  }

  function loadActorFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setActorJson((ev.target?.result as string) || "");
    reader.readAsText(file);
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

  async function loadGdFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const all = Array.from(files).filter((f) => /\.(html?|txt)$/i.test(f.name));
    setGdFiles(await readFileList(all.length ? all : Array.from(files)));
    setGdResult(null);
  }

  async function runGdImport() {
    if (!gdFiles.length) return;
    setGdBusy(true);
    setGdResult(null);
    try {
      const res = await fetch(`${api}/imports/google-docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: gdFiles, category: gdCategory, visibility: gdVisibility, approvalStatus: gdApproval })
      });
      setGdResult(await res.json());
    } finally {
      setGdBusy(false);
    }
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
        <button className={`tab-btn${activeTab === "characters" ? " active" : ""}`} onClick={() => setActiveTab("characters")}>Character JSON</button>
        <button className={`tab-btn${activeTab === "foundry" ? " active" : ""}`} onClick={() => setActiveTab("foundry")}>Foundry</button>
        <button className={`tab-btn${activeTab === "obsidian" ? " active" : ""}`} onClick={() => setActiveTab("obsidian")}>Obsidian</button>
        <button className={`tab-btn${activeTab === "notion" ? " active" : ""}`} onClick={() => setActiveTab("notion")}>Notion</button>
        <button className={`tab-btn${activeTab === "worldanvil" ? " active" : ""}`} onClick={() => setActiveTab("worldanvil")}>World Anvil</button>
        <button className={`tab-btn${activeTab === "googledocs" ? " active" : ""}`} onClick={() => setActiveTab("googledocs")}>Google Docs</button>
        <button className={`tab-btn${activeTab === "roll20" ? " active" : ""}`} onClick={() => setActiveTab("roll20")}>Roll20</button>
        <button className={`tab-btn${activeTab === "legendkeeper" ? " active" : ""}`} onClick={() => setActiveTab("legendkeeper")}>LegendKeeper</button>
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

      {activeTab === "characters" && (
        <div className="import-panel stack">
          <div className="import-intro">
            <p>Import a <strong>single character</strong> from raw JSON, creating one wiki page. Pick a source, then optionally map fields with dot-paths (e.g. <code>system.biography.value</code>) if the defaults miss anything.</p>
            <p className="muted" style={{ fontSize: "12px" }}>
              Leave path fields blank to use sensible defaults. For bulk actor/journal imports use the <strong>Foundry</strong> tab; for spreadsheets use <strong>CSV</strong>.
            </p>
            <p className="callout-warn" style={{ fontSize: "13px" }}>
              <strong>One character at a time.</strong>
              <span>Bulk uploads exceed the MCP upload limit — to add many characters at once, commit the pages directly to the campaign&apos;s Git repository instead.</span>
            </p>
          </div>

          <div className="import-options">
            <label>Source
              <select value={charSource} onChange={(e) => setCharSource(e.target.value as "foundry" | "generic")}>
                <option value="foundry">Foundry Actor JSON</option>
                <option value="generic">Generic JSON</option>
              </select>
            </label>
            <label>Visibility
              <select value={charVisibility} onChange={(e) => setCharVisibility(e.target.value as "gm" | "players")}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Approval status
              <select value={charApproval} onChange={(e) => setCharApproval(e.target.value as "approved" | "unapproved" | "rejected")}>
                {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          <div className="mapper-grid">
            <label>Name path<input value={charMap.name} onChange={(e) => setCharMap({ ...charMap, name: e.target.value })} placeholder="name" /></label>
            <label>Biography path<input value={charMap.biography} onChange={(e) => setCharMap({ ...charMap, biography: e.target.value })} placeholder="bio or system.biography.value" /></label>
            <label>Items path<input value={charMap.items} onChange={(e) => setCharMap({ ...charMap, items: e.target.value })} placeholder="items" /></label>
            <label>Category path<input value={charMap.category} onChange={(e) => setCharMap({ ...charMap, category: e.target.value })} placeholder="type" /></label>
            <label>Summary path<input value={charMap.summary} onChange={(e) => setCharMap({ ...charMap, summary: e.target.value })} placeholder="summary" /></label>
            <label>Tags path<input value={charMap.tags} onChange={(e) => setCharMap({ ...charMap, tags: e.target.value })} placeholder="tags" /></label>
          </div>

          <label className="file-upload-row">
            Upload JSON file
            <input type="file" accept=".json,application/json" onChange={loadCharFile} style={{ marginLeft: 8 }} />
          </label>

          <textarea
            className="import-textarea"
            placeholder={'{"name":"Victor Mendes","type":"npc","system":{"biography":{"value":"<p>A dockside fixer…</p>"}}}'}
            value={charJson}
            onChange={(e) => setCharJson(e.target.value)}
            rows={10}
          />

          <button onClick={runCharImport} disabled={charBusy || !charJson.trim()}>
            {charBusy ? "Importing…" : "Import character"}
          </button>

          {charError && <p className="error">{charError}</p>}
        </div>
      )}

      {activeTab === "foundry" && (
        <div className="import-panel stack">
          <div className="segmented" style={{ marginBottom: 12 }}>
            <button type="button" className={foundryTab === "journals" ? "active" : ""} onClick={() => setFoundryTab("journals")}>Journals</button>
            <button type="button" className={foundryTab === "actors" ? "active" : ""} onClick={() => setFoundryTab("actors")}>Actors</button>
          </div>

          {foundryTab === "journals" && <>
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
          </>}

          {foundryTab === "actors" && <>
            <div className="import-intro">
              <p>Import Foundry VTT actors as wiki pages. In Foundry, right-click actors in the sidebar and choose <strong>Export Data</strong>, or export from a compendium. Accepts a single actor, an array, or a world export with an <code>actors</code> array.</p>
              <p className="muted" style={{ fontSize: "12px" }}>Actor type maps automatically: <code>character</code> → Character, <code>npc</code> → NPC, <code>vehicle</code> → Item. Biography HTML is converted to Markdown. Foundry ID is stored in frontmatter for deduplication on re-import.</p>
            </div>

            <div className="import-options">
              <label>Visibility
                <select value={actorVisibility} onChange={(e) => setActorVisibility(e.target.value as "gm" | "players")}>
                  {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label>Approval status
                <select value={actorApproval} onChange={(e) => setActorApproval(e.target.value as "approved" | "unapproved" | "rejected")}>
                  {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </div>

            <label className="file-upload-row">
              Upload JSON file
              <input type="file" accept=".json,application/json" onChange={loadActorFile} style={{ marginLeft: 8 }} />
            </label>

            <textarea
              className="import-textarea"
              placeholder={`Paste Foundry actor JSON here…\n\nExample:\n[{"_id":"abc123","name":"Captain Vane","type":"npc","system":{"details":{"biography":{"value":"<p>A grizzled pirate captain…</p>"},"race":"Human","cr":"2"}}}]`}
              value={actorJson}
              onChange={(e) => setActorJson(e.target.value)}
              rows={12}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button className="secondary" onClick={previewActorImport} disabled={actorBusy || !actorJson.trim()}>
                {actorBusy ? "Checking…" : "Preview changes"}
              </button>
              <button onClick={runActorImport} disabled={actorBusy || !actorJson.trim()}>
                {actorBusy ? "Importing…" : "Import actors"}
              </button>
            </div>

            {actorPreviews && !actorResult && (
              <div className="actor-preview-list">
                <p className="import-preview-header">
                  <strong>{actorPreviews.length} actor{actorPreviews.length === 1 ? "" : "s"} found</strong>
                  {" — "}
                  {actorPreviews.filter((p) => p.isNew).length} new,{" "}
                  {actorPreviews.filter((p) => !p.isNew && (p.changes.length > 0 || p.bodyChanged)).length} changed,{" "}
                  {actorPreviews.filter((p) => !p.isNew && p.changes.length === 0 && !p.bodyChanged).length} unchanged
                </p>
                {actorPreviews.map((entry) => (
                  <div key={entry.slug} className={`actor-preview-card${entry.isNew ? " is-new" : entry.changes.length === 0 && !entry.bodyChanged ? " is-same" : " is-changed"}`}>
                    <div className="actor-preview-name">
                      <span className={`actor-preview-badge${entry.isNew ? " new" : entry.changes.length === 0 && !entry.bodyChanged ? " same" : " changed"}`}>
                        {entry.isNew ? "new" : entry.changes.length === 0 && !entry.bodyChanged ? "same" : "changed"}
                      </span>
                      {entry.name}
                      <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>/{entry.slug}</span>
                    </div>
                    {entry.changes.map((c) => (
                      <div key={c.field} className="actor-preview-field">
                        <span className="actor-preview-field-name">{c.field}</span>
                        <span className="actor-preview-before">{c.before || "(empty)"}</span>
                        <span className="actor-preview-arrow">→</span>
                        <span className="actor-preview-after">{c.after || "(empty)"}</span>
                      </div>
                    ))}
                    {entry.bodyChanged && (
                      <div className="actor-preview-field">
                        <span className="actor-preview-field-name">body</span>
                        <span className="actor-preview-before">{entry.bodyBefore} chars</span>
                        <span className="actor-preview-arrow">→</span>
                        <span className="actor-preview-after">{entry.bodyAfter} chars</span>
                      </div>
                    )}
                  </div>
                ))}
                <button style={{ marginTop: 8 }} onClick={runActorImport} disabled={actorBusy}>
                  {actorBusy ? "Importing…" : `Confirm import (${actorPreviews.length})`}
                </button>
              </div>
            )}

            {actorResult && <ImportResultPanel result={actorResult} api={`/campaigns/${campaignId}`} />}
          </>}
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

      {activeTab === "googledocs" && (
        <div className="import-panel stack">
          <div className="import-intro">
            <p>Import Google Docs as wiki pages. In Google Docs, go to <strong>File → Download → Web page (.html, zipped)</strong>, unzip, and select the <code>.html</code> files here. Plain text (<code>.txt</code>) exports also work.</p>
            <p className="muted" style={{ fontSize: "12px" }}>
              Document titles come from the Google Docs page title. Headings, bold, italic, and lists are preserved. Images and comments are dropped. Select multiple files to import a batch.
            </p>
          </div>

          <div className="import-options">
            <label>Default category
              <select value={gdCategory} onChange={(e) => setGdCategory(e.target.value)}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Visibility
              <select value={gdVisibility} onChange={(e) => setGdVisibility(e.target.value as "gm" | "players")}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Approval status
              <select value={gdApproval} onChange={(e) => setGdApproval(e.target.value as "approved" | "unapproved" | "rejected")}>
                {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          <label className="file-upload-row">
            Select .html or .txt files
            <input
              type="file"
              accept=".html,.htm,.txt"
              multiple
              onChange={loadGdFiles}
              style={{ marginLeft: 8 }}
            />
          </label>

          {gdFiles.length > 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              {gdFiles.length} file{gdFiles.length !== 1 ? "s" : ""} selected: {gdFiles.map((f) => f.name).join(", ")}
            </p>
          )}

          <button onClick={runGdImport} disabled={gdBusy || gdFiles.length === 0}>
            {gdBusy ? "Importing…" : `Import ${gdFiles.length > 0 ? gdFiles.length + " document" + (gdFiles.length === 1 ? "" : "s") : "documents"}`}
          </button>

          {gdResult && <ImportResultPanel result={gdResult} api={`/campaigns/${campaignId}`} />}
        </div>
      )}

      {activeTab === "roll20" && (
        <div className="import-panel stack">
          <div className="import-intro">
            <p>Import from Roll20. In Roll20, open your campaign, go to <strong>Settings → Export Campaign</strong> and download the JSON backup. Paste or upload it here.</p>
            <p className="muted" style={{ fontSize: "12px" }}>
              Imports characters and optionally handouts. Character bio and GM notes are converted to Markdown. GM notes are placed in a GM-only block. Attribute list is used to generate a stat summary.
            </p>
          </div>

          <div className="import-options">
            <label>Visibility
              <select value={r20Visibility} onChange={(e) => setR20Visibility(e.target.value as "gm" | "players")}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Approval status
              <select value={r20Approval} onChange={(e) => setR20Approval(e.target.value as "approved" | "unapproved" | "rejected")}>
                {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={r20IncludeHandouts} onChange={(e) => setR20IncludeHandouts(e.target.checked)} />
              Include handouts
            </label>
          </div>

          <label className="file-upload-row">
            Upload JSON export
            <input type="file" accept=".json,application/json" onChange={loadR20File} style={{ marginLeft: 8 }} />
          </label>

          <textarea
            className="import-textarea"
            placeholder={`Paste Roll20 campaign export JSON here…\n\nExample:\n{"schema_version":2,"characters":[{"id":"abc123","name":"Erevan","bio":"<p>An elven rogue…</p>","gmnotes":"","attributes":[{"name":"race","current":"Elf"},{"name":"class","current":"Rogue"},{"name":"level","current":"5"}]}],"handouts":[]}`}
            value={r20Json}
            onChange={(e) => setR20Json(e.target.value)}
            rows={12}
          />

          <button onClick={runR20Import} disabled={r20Busy || !r20Json.trim()}>
            {r20Busy ? "Importing…" : "Import Roll20 campaign"}
          </button>

          {r20Result && <ImportResultPanel result={r20Result} api={`/campaigns/${campaignId}`} />}
        </div>
      )}

      {activeTab === "legendkeeper" && (
        <div className="import-panel stack">
          <div className="import-intro">
            <p>Import from LegendKeeper. In LegendKeeper, open your atlas, go to <strong>Settings → Export</strong> and download the JSON. Paste or upload it here.</p>
            <p className="muted" style={{ fontSize: "12px" }}>
              Accepts the LegendKeeper JSON export with <code>entries</code>, <code>pages</code>, or <code>articles</code> arrays. ProseMirror rich-text content is converted to Markdown. Tags and entry types are preserved.
            </p>
          </div>

          <div className="import-options">
            <label>Visibility
              <select value={lkVisibility} onChange={(e) => setLkVisibility(e.target.value as "gm" | "players")}>
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Approval status
              <select value={lkApproval} onChange={(e) => setLkApproval(e.target.value as "approved" | "unapproved" | "rejected")}>
                {APPROVAL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          <label className="file-upload-row">
            Upload JSON export
            <input type="file" accept=".json,application/json" onChange={loadLKFile} style={{ marginLeft: 8 }} />
          </label>

          <textarea
            className="import-textarea"
            placeholder={`Paste LegendKeeper JSON export here…\n\nExample:\n{"entries":[{"id":"abc","title":"The Verdant City","type":"location","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"A city built in the canopy…"}]}]},"tags":["city","nature"]}]}`}
            value={lkJson}
            onChange={(e) => setLkJson(e.target.value)}
            rows={12}
          />

          <button onClick={runLKImport} disabled={lkBusy || !lkJson.trim()}>
            {lkBusy ? "Importing…" : "Import LegendKeeper atlas"}
          </button>

          {lkResult && <ImportResultPanel result={lkResult} api={`/campaigns/${campaignId}`} />}
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

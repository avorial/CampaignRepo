"use client";

import { useEffect, useMemo, useState } from "react";
import type { Campaign, WikiPage } from "@/lib/types";

type GenType = "npc" | "settlement" | "faction" | "rumor" | "encounter";
type GenMode = "random" | "ai";
type GenResult = { name: string; category: string; content: string };
type AIConfig = { endpoint?: string; model?: string; apiKey?: string };
type PromptPreset = "mystery" | "political" | "danger" | "wonder" | "quiet";

const GEN_TYPES: { id: GenType; label: string; icon: string; hint: string }[] = [
  { id: "npc", label: "NPC", icon: "👤", hint: "Name, occupation, trait, secret, goal" },
  { id: "settlement", label: "Settlement", icon: "🏘️", hint: "Size, authority, feature, problem" },
  { id: "faction", label: "Faction", icon: "⚔️", hint: "Name, goal, method, resource" },
  { id: "rumor", label: "Rumor", icon: "🗣️", hint: "Overheard gossip with a twist" },
  { id: "encounter", label: "Encounter", icon: "🎲", hint: "Type, terrain, actor, complication" }
];

const PROMPT_PRESETS: { id: PromptPreset; label: string; direction: string }[] = [
  { id: "mystery", label: "Mystery", direction: "seed clues, unanswered questions, and one detail that is not what it first appears to be" },
  { id: "political", label: "Political", direction: "emphasize factions, leverage, public motives, and private agendas" },
  { id: "danger", label: "Danger", direction: "make the threat immediate, costly, and tied to a hard choice" },
  { id: "wonder", label: "Wonder", direction: "lean into strange sensory details, discovery, and setting texture" },
  { id: "quiet", label: "Quiet", direction: "keep it grounded, intimate, and useful at the table without melodrama" }
];

export default function GenerateClient({ campaign }: { campaign: Campaign }) {
  const base = `/campaigns/${campaign.id}`;
  const api = `/api/campaigns/${campaign.id}`;

  const [genType, setGenType] = useState<GenType>("npc");
  const [mode, setMode] = useState<GenMode>("random");
  const [result, setResult] = useState<GenResult | null>(null);
  const [resultMode, setResultMode] = useState<GenMode>("random");
  const [warning, setWarning] = useState("");
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdSlug, setCreatedSlug] = useState("");
  const [promptPreset, setPromptPreset] = useState<PromptPreset>("mystery");
  const [promptMustInclude, setPromptMustInclude] = useState("");
  const [promptAvoid, setPromptAvoid] = useState("");
  const [promptTone, setPromptTone] = useState("");
  const [promptShape, setPromptShape] = useState("wiki-ready prose with clear hooks and concrete table-use details");

  // Pages for context
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [contextSlugs, setContextSlugs] = useState<Set<string>>(new Set());
  const [pageFilter, setPageFilter] = useState("");

  // AI settings
  const [aiConfig, setAiConfig] = useState<AIConfig>({});
  const [editingAI, setEditingAI] = useState(false);
  const [aiEndpoint, setAiEndpoint] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiKey, setAiKey] = useState("");
  const [savingAI, setSavingAI] = useState(false);

  useEffect(() => {
    fetch(`${api}/pages`).then((r) => r.json()).then((d) => setPages(d.pages || []));
    fetch(`${api}/ai-settings`).then((r) => r.json()).then((d) => {
      if (d.config) {
        setAiConfig(d.config);
        setAiEndpoint(d.config.endpoint || "");
        setAiModel(d.config.model || "");
      }
    });
  }, []);

  const filteredPages = useMemo(() => {
    const f = pageFilter.trim().toLowerCase();
    return pages.filter((p) => !f || p.frontmatter.name.toLowerCase().includes(f)).slice(0, 50);
  }, [pages, pageFilter]);

  function toggleContext(slug: string) {
    setContextSlugs((prev) => { const next = new Set(prev); next.has(slug) ? next.delete(slug) : next.add(slug); return next; });
  }

  const promptBrief = useMemo(() => {
    const preset = PROMPT_PRESETS.find((item) => item.id === promptPreset);
    return [
      preset ? `Direction: ${preset.direction}.` : "",
      promptTone.trim() ? `Tone: ${promptTone.trim()}.` : "",
      promptMustInclude.trim() ? `Must include: ${promptMustInclude.trim()}.` : "",
      promptAvoid.trim() ? `Avoid: ${promptAvoid.trim()}.` : "",
      promptShape.trim() ? `Output shape: ${promptShape.trim()}.` : ""
    ].filter(Boolean).join("\n");
  }, [promptAvoid, promptMustInclude, promptPreset, promptShape, promptTone]);

  async function generate() {
    setGenerating(true);
    setResult(null);
    setWarning("");
    setCreatedSlug("");
    setMessage("");
    const res = await fetch(`${api}/generate`, {
      method: "POST",
      body: JSON.stringify({
        type: genType,
        mode,
        contextSlugs: [...contextSlugs],
        promptBrief,
        seed: Math.floor(Math.random() * 2 ** 31)
      })
    });
    const data = await res.json();
    setGenerating(false);
    if (res.ok) {
      setResult(data.result);
      setResultMode(data.mode);
      if (data.warning) setWarning(data.warning);
    } else {
      setMessage(data.error || "Generation failed.");
    }
  }

  async function createPage() {
    if (!result) return;
    setCreating(true);
    setMessage("Creating page…");
    const res = await fetch(`${api}/pages`, {
      method: "POST",
      body: JSON.stringify({ name: result.name, category: result.category, visibility: "gm" })
    });
    const data = await res.json();
    if (!res.ok) { setCreating(false); setMessage(data.error || "Could not create page."); return; }
    const slug = data.page?.slug || data.slug;
    if (!slug) { setCreating(false); setMessage("Created but no slug returned."); return; }
    // Append generated content to the page
    const putRes = await fetch(`${api}/pages/${slug}`, {
      method: "PUT",
      body: JSON.stringify({
        frontmatter: { name: result.name, category: result.category, visibility: "gm", approvalStatus: "unapproved" },
        content: result.content
      })
    });
    setCreating(false);
    if (putRes.ok) {
      setCreatedSlug(slug);
      setMessage(`Created as draft — review and approve before sharing with players.`);
    } else {
      setMessage("Page created but content update failed.");
      setCreatedSlug(slug);
    }
  }

  async function saveAI() {
    setSavingAI(true);
    const res = await fetch(`${api}/ai-settings`, {
      method: "PUT",
      body: JSON.stringify({ endpoint: aiEndpoint, model: aiModel, apiKey: aiKey || undefined })
    });
    const data = await res.json();
    setSavingAI(false);
    if (res.ok) {
      setAiConfig(data.config);
      setAiKey("");
      setEditingAI(false);
    }
  }

  const hasAI = Boolean(aiConfig.endpoint);

  return (
    <section className="generate-shell">
      {/* Generator type selector */}
      <div className="panel generate-types">
        <h2>Generator type</h2>
        <div className="gen-type-grid">
          {GEN_TYPES.map((t) => (
            <button key={t.id} type="button"
              className={`gen-type-btn${genType === t.id ? " active" : ""}`}
              onClick={() => { setGenType(t.id); setResult(null); setCreatedSlug(""); }}>
              <span className="gen-type-icon">{t.icon}</span>
              <strong>{t.label}</strong>
              <span className="muted">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="generate-main">
        {/* Controls */}
        <div className="panel">
          <h2>Generate</h2>
          <div className="gen-mode-row">
            <label>
              <input type="radio" name="mode" value="random" checked={mode === "random"} onChange={() => setMode("random")} />
              Random tables
            </label>
            <label className={!hasAI ? "muted" : ""} title={!hasAI ? "Configure an AI endpoint below to enable" : undefined}>
              <input type="radio" name="mode" value="ai" checked={mode === "ai"} onChange={() => setMode("ai")} disabled={!hasAI} />
              AI expand {!hasAI && <span style={{ fontSize: "11px" }}>(not configured)</span>}
            </label>
          </div>

          {mode === "ai" && (
            <details className="context-picker">
              <summary>Context pages ({contextSlugs.size} selected)</summary>
              <input placeholder="Filter pages…" value={pageFilter} onChange={(e) => setPageFilter(e.target.value)} style={{ marginBottom: "8px" }} />
              <div className="context-list">
                {filteredPages.map((p) => (
                  <label key={p.slug} className="context-item">
                    <input type="checkbox" checked={contextSlugs.has(p.slug)} onChange={() => toggleContext(p.slug)} />
                    <span className="cat-dot" style={{ background: `var(--cat-${p.frontmatter.category}, var(--gold))` }} />
                    {p.frontmatter.name}
                  </label>
                ))}
              </div>
            </details>
          )}

          <details className="prompt-helper" open={mode === "ai"}>
            <summary>Prompt helper</summary>
            <div className="prompt-helper-presets">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={promptPreset === preset.id ? "active" : ""}
                  onClick={() => setPromptPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label>
              Tone
              <input value={promptTone} onChange={(e) => setPromptTone(e.target.value)} placeholder="noir, hopeful, courtly, grimy frontier..." />
            </label>
            <label>
              Must include
              <textarea value={promptMustInclude} onChange={(e) => setPromptMustInclude(e.target.value)} placeholder="Names, places, constraints, secrets, table facts..." rows={4} />
            </label>
            <label>
              Avoid
              <input value={promptAvoid} onChange={(e) => setPromptAvoid(e.target.value)} placeholder="Tropes, topics, names, power levels..." />
            </label>
            <label>
              Output shape
              <input value={promptShape} onChange={(e) => setPromptShape(e.target.value)} />
            </label>
            {promptBrief && <pre className="prompt-helper-brief">{promptBrief}</pre>}
          </details>

          <button onClick={generate} disabled={generating} style={{ marginTop: "12px" }}>
            {generating ? "Generating…" : `Generate ${GEN_TYPES.find((t) => t.id === genType)?.label}`}
          </button>
          {message && <p className="toast">{message}</p>}
        </div>

        {/* Result */}
        {result && (
          <div className="panel generate-result">
            <div className="generate-result-header">
              <h2>{result.name}</h2>
              <span className="muted" style={{ fontSize: "12px" }}>{resultMode === "ai" ? "AI generated" : "Random tables"} · {result.category}</span>
            </div>
            {warning && <p className="toast toast-warn" style={{ fontSize: "12px" }}>{warning}</p>}
            <pre className="generate-preview">{result.content}</pre>
            <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
              {!createdSlug ? (
                <button onClick={createPage} disabled={creating}>
                  {creating ? "Creating…" : "Create draft wiki page"}
                </button>
              ) : (
                <a href={`${base}/pages/${createdSlug}`} className="button">Open draft page →</a>
              )}
              <button type="button" className="secondary" onClick={generate} disabled={generating}>Regenerate</button>
            </div>
          </div>
        )}
      </div>

      {/* AI settings */}
      <div className="panel generate-ai-panel">
        <h2>AI endpoint</h2>
        {!editingAI ? (
          <div>
            <p className="muted" style={{ fontSize: "13px" }}>
              {hasAI
                ? <>Connected: <strong>{aiConfig.endpoint}</strong> · model: <strong>{aiConfig.model || "llama3.2"}</strong></>
                : "No AI endpoint configured. Random tables always available."}
            </p>
            <p className="muted" style={{ fontSize: "12px", marginTop: "4px" }}>
              Supports any OpenAI-compatible endpoint: Ollama (<code>http://localhost:11434/v1</code>), LM Studio, or a hosted provider.
            </p>
            <button type="button" className="secondary" style={{ marginTop: "8px" }} onClick={() => setEditingAI(true)}>
              {hasAI ? "Edit endpoint" : "Configure endpoint"}
            </button>
          </div>
        ) : (
          <div className="stack">
            <label>Endpoint URL
              <input value={aiEndpoint} onChange={(e) => setAiEndpoint(e.target.value)} placeholder="http://localhost:11434/v1" />
            </label>
            <label>Model
              <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} placeholder="llama3.2" />
            </label>
            <label>API key <span className="muted">(leave blank for Ollama / local endpoints)</span>
              <input type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder="sk-… (optional)" />
            </label>
            <p className="muted" style={{ fontSize: "11px" }}>Config stored in <code>wiki/.ai-config.json</code> in your campaign repo. Keep API keys out of shared or public repos.</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={saveAI} disabled={savingAI}>{savingAI ? "Saving…" : "Save"}</button>
              <button type="button" className="secondary" onClick={() => setEditingAI(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

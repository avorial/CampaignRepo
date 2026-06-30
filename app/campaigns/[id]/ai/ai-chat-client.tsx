"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Campaign } from "@/lib/types";

type PageRef = { slug: string; name: string; category: string };
type Message = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "Who are the most important NPCs in this campaign?",
  "Summarize the major factions and their goals.",
  "What locations have been visited so far?",
  "List every character connected to the main plot.",
  "Generate a session recap based on recent events.",
  "What secrets might the players not know yet?"
];

export default function AIChatClient({ campaign, pages }: { campaign: Campaign; pages: PageRef[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [contextSlugs, setContextSlugs] = useState<string[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [contextFilter, setContextFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, contextSlugs })
      });
      const data = await res.json() as { reply?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error || "Request failed.");
        setMessages(next); // keep user message
      } else {
        setMessages([...next, { role: "assistant", content: data.reply || "" }]);
      }
    } catch {
      setError("Network error. Check your AI endpoint configuration.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    send(text);
  }

  function toggleSlug(slug: string) {
    setContextSlugs((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);
  }

  const filteredPages = pages.filter((p) =>
    !contextFilter || p.name.toLowerCase().includes(contextFilter.toLowerCase()) || p.category.toLowerCase().includes(contextFilter.toLowerCase())
  );

  const groupedPages = filteredPages.reduce<Record<string, PageRef[]>>((acc, p) => {
    const cat = p.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div className="ai-chat-shell">
      <div className="ai-chat-header">
        <Link href={`/campaigns/${campaign.id}`} className="back-link">← {campaign.name}</Link>
        <h1 className="ai-chat-title">🤖 AI Assistant</h1>
        <button
          type="button"
          className={`button button-sm${showContext ? " button-active" : ""}`}
          onClick={() => setShowContext((v) => !v)}
        >
          {contextSlugs.length > 0 ? `Context: ${contextSlugs.length} page${contextSlugs.length !== 1 ? "s" : ""}` : "Add context"}
        </button>
      </div>

      <div className="ai-chat-body">
        <div className="ai-chat-messages">
          {messages.length === 0 && (
            <div className="ai-chat-empty">
              <div className="ai-chat-empty-icon">🤖</div>
              <p>Ask anything about your campaign. Use context pages to focus the AI on specific material.</p>
              <div className="ai-chat-suggestions">
                {SUGGESTED.map((s) => (
                  <button key={s} type="button" className="ai-suggestion-chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`ai-message ai-message-${msg.role}`}>
              <div className="ai-message-label">{msg.role === "user" ? "You" : "AI"}</div>
              <div className="ai-message-content">{msg.content}</div>
            </div>
          ))}
          {loading && (
            <div className="ai-message ai-message-assistant">
              <div className="ai-message-label">AI</div>
              <div className="ai-message-content ai-thinking">Thinking…</div>
            </div>
          )}
          {error && <div className="ai-error">{error} — <Link href={`/campaigns/${campaign.id}/settings`} className="link">AI Settings</Link></div>}
          <div ref={bottomRef} />
        </div>

        {showContext && (
          <div className="ai-context-panel">
            <div className="ai-context-header">
              <strong>Context pages</strong>
              <span className="ai-context-hint">Selected pages are included in full; otherwise the AI uses a summary of all pages.</span>
            </div>
            <input
              className="ai-context-filter"
              placeholder="Filter pages…"
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value)}
            />
            {contextSlugs.length > 0 && (
              <button type="button" className="button button-sm" onClick={() => setContextSlugs([])}>Clear all</button>
            )}
            <div className="ai-context-list">
              {Object.entries(groupedPages).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catPages]) => (
                <div key={cat}>
                  <div className="ai-context-category">{cat}</div>
                  {catPages.map((p) => (
                    <label key={p.slug} className="ai-context-item">
                      <input
                        type="checkbox"
                        checked={contextSlugs.includes(p.slug)}
                        onChange={() => toggleSlug(p.slug)}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              ))}
              {filteredPages.length === 0 && <div className="ai-context-empty">No pages match.</div>}
            </div>
          </div>
        )}
      </div>

      <form className="ai-chat-input-row" onSubmit={handleSubmit}>
        <input
          className="ai-chat-input"
          placeholder="Ask about your campaign…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <button type="submit" className="button" disabled={loading || !input.trim()}>Send</button>
        {messages.length > 0 && (
          <button type="button" className="button button-ghost" onClick={() => { setMessages([]); setError(""); }}>Clear</button>
        )}
      </form>
    </div>
  );
}

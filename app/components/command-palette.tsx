"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Campaign = { id: number; name: string; owner: string; repo: string; role: string };
type SearchResult = { campaignId: number; campaignName?: string; slug: string; title: string; category: string; visibility: string };
type MediaFile = { name: string; mediaType: string; alt?: string };
type Item = { id: string; group: string; label: string; hint?: string; run: () => void };

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentId = useMemo(() => {
    const match = pathname?.match(/\/campaigns\/(\d+)/);
    return match ? Number(match[1]) : null;
  }, [pathname]);

  // Only activate for signed-in users (keeps Cmd+K inert on login/register).
  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => alive && setEnabled(Boolean(d?.user)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;
    fetch("/api/campaigns")
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((d) => setCampaigns(d.campaigns || []))
      .catch(() => undefined);
  }, [enabled, open]);

  // Load media for the current campaign when the palette opens.
  useEffect(() => {
    if (!open || !currentId) return;
    fetch(`/api/campaigns/${currentId}/media`)
      .then((r) => (r.ok ? r.json() : { media: [] }))
      .then((d) => setMedia(d.media || []))
      .catch(() => undefined);
  }, [open, currentId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (enabled) setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Debounced full-text search across the user's campaigns.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d) => setResults((d.results || []).slice(0, 25)))
        .catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open]);

  const currentCampaign = campaigns.find((c) => c.id === currentId);
  const canManage = Boolean(currentCampaign && (currentCampaign.role === "owner" || currentCampaign.role === "gm"));

  const items: Item[] = useMemo(() => {
    const go = (href: string) => () => {
      setOpen(false);
      router.push(href);
    };
    const list: Item[] = [];
    list.push({ id: "nav-dash", group: "Go to", label: "Dashboard", run: go("/dashboard") });
    if (currentId) {
      list.push({ id: "nav-ws", group: "Go to", label: "Campaign workspace", run: go(`/campaigns/${currentId}`) });
      list.push({ id: "nav-overview", group: "Go to", label: "Overview dashboard", run: go(`/campaigns/${currentId}/overview`) });
      list.push({ id: "nav-graph", group: "Go to", label: "Relationship graph", run: go(`/campaigns/${currentId}/graph`) });
      list.push({ id: "nav-calendar", group: "Go to", label: "Calendar", run: go(`/campaigns/${currentId}/calendar`) });
      list.push({ id: "nav-sessions", group: "Go to", label: "Sessions", run: go(`/campaigns/${currentId}/sessions`) });
      list.push({ id: "nav-quests", group: "Go to", label: "Quests", run: go(`/campaigns/${currentId}/quests`) });
      if (canManage) {
        list.push({ id: "nav-org", group: "Go to", label: "Organize pages", run: go(`/campaigns/${currentId}/organize`) });
        list.push({ id: "nav-maps", group: "Go to", label: "Maps", run: go(`/campaigns/${currentId}/maps`) });
        list.push({ id: "nav-health", group: "Go to", label: "Campaign health", run: go(`/campaigns/${currentId}/health`) });
        list.push({ id: "nav-lexicon", group: "Go to", label: "Lexicon", run: go(`/campaigns/${currentId}/lexicon`) });
        list.push({ id: "nav-manuscripts", group: "Go to", label: "Manuscripts", run: go(`/campaigns/${currentId}/manuscripts`) });
        list.push({ id: "nav-boards", group: "Go to", label: "Boards", run: go(`/campaigns/${currentId}/boards`) });
        list.push({ id: "nav-admin", group: "Go to", label: "GM Admin", run: go(`/campaigns/${currentId}/admin`) });
      }
      list.push({ id: "nav-player", group: "Go to", label: "Player portal", run: go(`/campaigns/${currentId}/player`) });
    }
    for (const c of campaigns) {
      list.push({ id: `camp-${c.id}`, group: "Campaigns", label: c.name, hint: `${c.owner}/${c.repo} · ${c.role}`, run: go(`/campaigns/${c.id}`) });
    }
    for (const r of results) {
      list.push({
        id: `pg-${r.campaignId}-${r.slug}`,
        group: "Pages",
        label: r.title,
        hint: [r.category, r.campaignName, r.visibility === "gm" ? "GM" : null].filter(Boolean).join(" · "),
        run: go(`/campaigns/${r.campaignId}/pages/${r.slug}`)
      });
    }
    if (currentId && query.trim()) {
      const q = query.trim().toLowerCase();
      const matchingMedia = media.filter((m) => m.name.toLowerCase().includes(q) || (m.alt || "").toLowerCase().includes(q));
      for (const m of matchingMedia.slice(0, 10)) {
        list.push({
          id: `media-${currentId}-${m.name}`,
          group: "Media",
          label: m.alt || m.name,
          hint: m.name,
          run: go(`/campaigns/${currentId}/organize?tab=media`)
        });
      }
    }
    return list;
  }, [campaigns, results, media, currentId, canManage, router, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.filter((i) => i.group !== "Pages" && i.group !== "Media");
    return items.filter((i) => i.group === "Pages" || i.group === "Media" || i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    setActive(0);
  }, [filtered.length]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  }

  if (!open) return null;

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)} role="presentation">
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette" aria-modal="true">
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Search pages, campaigns, actions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKey}
        />
        <div className="cmdk-list">
          {filtered.length === 0 && <div className="cmdk-empty">No matches</div>}
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={`cmdk-item${idx === active ? " active" : ""}`}
              onMouseMove={() => setActive(idx)}
              onClick={() => item.run()}
            >
              <span className="cmdk-group">{item.group}</span>
              <span className="cmdk-label">{item.label}</span>
              {item.hint && <span className="cmdk-hint">{item.hint}</span>}
            </button>
          ))}
        </div>
        <div className="cmdk-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

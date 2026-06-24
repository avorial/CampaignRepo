"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Campaign = { id: number; name: string; owner: string; repo: string; role: string };
type SearchResult = { campaignId: number; campaignName?: string; slug: string; title: string; category: string; visibility: string };
type Item = { id: string; group: string; label: string; hint?: string; run: () => void };

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
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
      if (canManage) {
        list.push({ id: "nav-org", group: "Go to", label: "Organize pages", run: go(`/campaigns/${currentId}/organize`) });
        list.push({ id: "nav-maps", group: "Go to", label: "Maps", run: go(`/campaigns/${currentId}/maps`) });
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
    return list;
  }, [campaigns, results, currentId, canManage, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.filter((i) => i.group !== "Pages");
    return items.filter((i) => i.group === "Pages" || i.label.toLowerCase().includes(q) || i.hint?.toLowerCase().includes(q));
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
      <div className="cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
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

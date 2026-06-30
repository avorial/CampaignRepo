"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CampaignGraphEdge, CampaignGraphNode } from "@/lib/types";
import { REL_TYPE_MAP } from "@/lib/relationships";

// === Physics simulation ===
type Pos = { x: number; y: number; vx: number; vy: number };

const REPULSION = 14000;
const SPRING_LEN = 200;
const SPRING_K = 0.04;
const CENTER_K = 0.018;
const DAMPING = 0.82;

function initPositions(slugs: string[]): Map<string, Pos> {
  const map = new Map<string, Pos>();
  slugs.forEach((slug, i) => {
    const angle = (i / Math.max(slugs.length, 1)) * Math.PI * 2;
    const r = 120 + (i % 4) * 70;
    map.set(slug, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, vx: 0, vy: 0 });
  });
  return map;
}

function stepOnce(positions: Map<string, Pos>, edges: CampaignGraphEdge[]): Map<string, Pos> {
  const next = new Map<string, Pos>();
  for (const [slug, pos] of positions) next.set(slug, { ...pos });
  const slugs = Array.from(next.keys());

  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = next.get(slugs[i])!;
      const b = next.get(slugs[j])!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distSq = Math.max(dx * dx + dy * dy, 100);
      const dist = Math.sqrt(distSq);
      const force = REPULSION / distSq;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
  }

  const seen = new Set<string>();
  for (const edge of edges) {
    if (edge.missing) continue;
    const key = [edge.source, edge.target].sort().join("\0");
    if (seen.has(key)) continue;
    seen.add(key);
    const a = next.get(edge.source);
    const b = next.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const force = (dist - SPRING_LEN) * SPRING_K;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  }

  for (const [, pos] of next) {
    pos.vx += -pos.x * CENTER_K;
    pos.vy += -pos.y * CENTER_K;
    pos.vx *= DAMPING;
    pos.vy *= DAMPING;
    pos.x += pos.vx;
    pos.y += pos.vy;
  }

  return next;
}

// === Category colors ===
const CAT_COLORS: Record<string, string> = {
  character: "#d4a957",
  npc: "#a075ff",
  location: "#6bb8ff",
  event: "#ff7a7a",
  game: "#c0b0e0",
  organization: "#78c8a0",
  species: "#e68cc8",
  item: "#78c8dc",
  lore: "#c8b478",
};

function catColor(cat: string): string {
  return CAT_COLORS[cat] || "#888";
}

// === Component ===
export default function GraphClient({ campaignId }: { campaignId: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<CampaignGraphNode[]>([]);
  const [edges, setEdges] = useState<CampaignGraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Map<string, Pos>>(new Map());
  const [simDone, setSimDone] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [panStart, setPanStart] = useState<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [filterCats, setFilterCats] = useState<Set<string>>(new Set(Object.keys(CAT_COLORS)));
  const [showRelOnly, setShowRelOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}/graph`)
      .then((r) => r.json())
      .then((data) => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setLoading(false);
      });
  }, [campaignId]);

  const visibleNodes = useMemo(
    () => nodes.filter((n) => filterCats.has(n.category)),
    [nodes, filterCats]
  );
  const visibleSlugs = useMemo(() => new Set(visibleNodes.map((n) => n.slug)), [visibleNodes]);
  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (e) =>
          !e.missing &&
          visibleSlugs.has(e.source) &&
          visibleSlugs.has(e.target) &&
          (!showRelOnly || Boolean(e.relType))
      ),
    [edges, visibleSlugs, showRelOnly]
  );

  // Force simulation
  useEffect(() => {
    if (visibleNodes.length === 0) return;
    setSimDone(false);
    let pos = initPositions(visibleNodes.map((n) => n.slug));
    let ticks = 0;
    let rafId: number;

    function tick() {
      const steps = ticks < 100 ? 10 : ticks < 250 ? 5 : 2;
      for (let i = 0; i < steps; i++) {
        pos = stepOnce(pos, visibleEdges);
        ticks++;
      }
      setPositions(new Map(pos));
      if (ticks < 400) {
        rafId = requestAnimationFrame(tick);
      } else {
        setSimDone(true);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [visibleNodes, visibleEdges]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.88 : 1.12;
    setScale((s) => {
      const newScale = Math.max(0.15, Math.min(5, s * factor));
      setPan((p) => ({
        x: mx - (mx - p.x) * (newScale / s),
        y: my - (my - p.y) * (newScale / s),
      }));
      return newScale;
    });
  }, []);

  const onSvgPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0 || (e.target as Element).closest(".graph-node")) return;
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      setPanStart({ mx: e.clientX, my: e.clientY, ox: pan.x, oy: pan.y });
    },
    [pan]
  );

  const onSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (panStart) {
        setPan({ x: panStart.ox + (e.clientX - panStart.mx), y: panStart.oy + (e.clientY - panStart.my) });
      }
      if (dragNode) {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const x = (e.clientX - rect.left - pan.x) / scale;
        const y = (e.clientY - rect.top - pan.y) / scale;
        setPositions((prev) => {
          const next = new Map(prev);
          const p = next.get(dragNode);
          if (p) next.set(dragNode, { ...p, x, y, vx: 0, vy: 0 });
          return next;
        });
      }
    },
    [panStart, dragNode, pan, scale]
  );

  const onSvgPointerUp = useCallback(() => {
    setPanStart(null);
    setDragNode(null);
  }, []);

  const onNodePointerDown = useCallback((e: React.PointerEvent, slug: string) => {
    e.stopPropagation();
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    setDragNode(slug);
    setSelected(slug);
  }, []);

  const selectedNode = selected ? nodes.find((n) => n.slug === selected) : null;
  const connectedSlugs = useMemo(() => {
    if (!selected) return new Set<string>();
    const s = new Set<string>([selected]);
    for (const e of visibleEdges) {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    }
    return s;
  }, [selected, visibleEdges]);

  const selectedOutgoing = useMemo(
    () => (selected ? visibleEdges.filter((e) => e.source === selected) : []),
    [selected, visibleEdges]
  );
  const selectedIncoming = useMemo(
    () => (selected ? visibleEdges.filter((e) => e.target === selected) : []),
    [selected, visibleEdges]
  );
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.slug, n])), [nodes]);
  const usedCats = useMemo(() => [...new Set(nodes.map((n) => n.category))].sort(), [nodes]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return visibleNodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 12);
  }, [searchQuery, visibleNodes]);

  const searchMatchSlugs = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return new Set(searchResults.map((n) => n.slug));
  }, [searchQuery, searchResults]);

  function jumpToNode(slug: string) {
    setSelected(slug);
    setSearchQuery("");
    setSearchOpen(false);
    const pos = positions.get(slug);
    const svg = svgRef.current;
    if (!pos || !svg) return;
    const { width, height } = svg.getBoundingClientRect();
    setPan({ x: width / 2 - pos.x * scale, y: height / 2 - pos.y * scale });
  }

  function toggleCat(cat: string) {
    setFilterCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const dimmed = (slug: string) => {
    if (searchMatchSlugs) return !searchMatchSlugs.has(slug);
    if (selected) return !connectedSlugs.has(slug);
    return false;
  };

  return (
    <div className="graph-shell">
      <aside className="graph-filters panel">
        <div className="graph-search-wrap">
          <input
            className="graph-search-input"
            placeholder="Search nodes…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          />
          {searchOpen && searchResults.length > 0 && (
            <ul className="graph-search-results">
              {searchResults.map((n) => (
                <li key={n.slug}>
                  <button type="button" onMouseDown={() => jumpToNode(n.slug)}>
                    <span className="cat-dot" style={{ background: catColor(n.category) }} />
                    {n.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <h4>Categories</h4>
        {usedCats.map((cat) => (
          <label key={cat} className="graph-filter-item">
            <input type="checkbox" checked={filterCats.has(cat)} onChange={() => toggleCat(cat)} />
            <span className="cat-dot" style={{ background: catColor(cat) }} />
            {cat}
          </label>
        ))}
        <hr />
        <label className="graph-filter-item">
          <input type="checkbox" checked={showRelOnly} onChange={(e) => setShowRelOnly(e.target.checked)} />
          <span>Typed relationships only</span>
        </label>
        <p className="muted graph-count">
          {visibleNodes.length} nodes · {visibleEdges.length} edges
          {!simDone && !loading && <span> · settling…</span>}
          {loading && <span> · loading…</span>}
        </p>
      </aside>

      <svg
        ref={svgRef}
        className="graph-canvas"
        onWheel={onWheel}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        style={{ cursor: panStart ? "grabbing" : "grab" }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
          {visibleEdges.map((edge, i) => {
            const a = positions.get(edge.source);
            const b = positions.get(edge.target);
            if (!a || !b) return null;
            const isRel = Boolean(edge.relType);
            const isActive = selected && (edge.source === selected || edge.target === selected);
            const isDim = selected && !isActive;
            return (
              <line
                key={`e-${i}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={[
                  "graph-edge",
                  isRel ? "graph-edge-rel" : "",
                  isActive ? "graph-edge-active" : "",
                  isDim ? "graph-edge-dim" : "",
                ].join(" ")}
              />
            );
          })}

          {selected &&
            visibleEdges
              .filter((e) => (e.source === selected || e.target === selected) && e.relType)
              .map((edge, i) => {
                const a = positions.get(edge.source);
                const b = positions.get(edge.target);
                if (!a || !b) return null;
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                const label =
                  edge.source === selected
                    ? (REL_TYPE_MAP.get(edge.relType!)?.label ?? edge.label)
                    : (REL_TYPE_MAP.get(edge.relType!)?.inverseLabel ?? edge.label);
                return (
                  <text key={`el-${i}`} x={mx} y={my - 7} className="graph-edge-label" textAnchor="middle">
                    {label}
                  </text>
                );
              })}

          {visibleNodes.map((node) => {
            const pos = positions.get(node.slug);
            if (!pos) return null;
            const isSel = node.slug === selected;
            const isDim = dimmed(node.slug);
            const initials = node.name.slice(0, 2).toUpperCase();
            const color = catColor(node.category);
            return (
              <g
                key={node.slug}
                className={["graph-node", `graph-node-${node.category}`, isSel ? "graph-node-selected" : "", isDim ? "graph-node-dim" : ""].join(" ")}
                transform={`translate(${pos.x}, ${pos.y})`}
                onPointerDown={(e) => onNodePointerDown(e, node.slug)}
                style={{ cursor: "pointer" }}
              >
                <circle r={22} fill={color} fillOpacity={isSel ? 1 : isDim ? 0.25 : 0.72}
                  stroke={isSel ? color : (searchMatchSlugs?.has(node.slug) && !isSel) ? "#fff" : "transparent"}
                  strokeWidth={isSel ? 3 : 2} />
                <text textAnchor="middle" dominantBaseline="central" className="graph-node-initials" fillOpacity={isDim ? 0.4 : 1}>
                  {initials}
                </text>
                <text textAnchor="middle" y={36} className="graph-node-label" fillOpacity={isDim ? 0.3 : 1}>
                  {node.name.length > 16 ? node.name.slice(0, 14) + "…" : node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {selectedNode && (
        <aside className="graph-detail panel">
          <div className="graph-detail-header">
            <span className="cat-dot" style={{ background: catColor(selectedNode.category) }} />
            <span className="muted">{selectedNode.category}</span>
            <button type="button" className="linklike graph-detail-close" onClick={() => setSelected(null)}>
              ✕
            </button>
          </div>
          <h3>
            <a href={`/campaigns/${campaignId}/pages/${selectedNode.slug}`} className="quiet-link">
              {selectedNode.name}
            </a>
          </h3>
          {selectedNode.summary && <p className="muted graph-detail-summary">{selectedNode.summary}</p>}

          {selectedOutgoing.length > 0 && (
            <div className="graph-detail-section">
              <h4>Links to</h4>
              {selectedOutgoing.map((e, i) => {
                const target = nodeMap.get(e.target);
                const rtDef = e.relType ? REL_TYPE_MAP.get(e.relType) : null;
                return (
                  <button key={i} type="button" className="graph-detail-link" onClick={() => setSelected(e.target)}>
                    {rtDef && <span className="rel-type">{rtDef.label}</span>}
                    {target?.name ?? e.target}
                  </button>
                );
              })}
            </div>
          )}

          {selectedIncoming.length > 0 && (
            <div className="graph-detail-section">
              <h4>Linked from</h4>
              {selectedIncoming.map((e, i) => {
                const source = nodeMap.get(e.source);
                const rtDef = e.relType ? REL_TYPE_MAP.get(e.relType) : null;
                return (
                  <button key={i} type="button" className="graph-detail-link" onClick={() => setSelected(e.source)}>
                    {rtDef && <span className="rel-type rel-type-inverse">{rtDef.inverseLabel}</span>}
                    {source?.name ?? e.source}
                  </button>
                );
              })}
            </div>
          )}

          <a href={`/campaigns/${campaignId}/pages/${selectedNode.slug}`} className="button secondary graph-open-btn">
            Open page
          </a>
        </aside>
      )}
    </div>
  );
}

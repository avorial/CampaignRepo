"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CampaignFamilyTree, CampaignGraphEdge, CampaignGraphNode } from "@/lib/types";
import { RELATIONSHIP_TYPES, REL_TYPE_MAP } from "@/lib/relationships";

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

// === Tree layout (genealogy preset) ===
const TREE_X = 180;
const TREE_Y = 150;

function computeTreeLayout(slugs: string[], hierarchyEdges: CampaignGraphEdge[], spouseEdges: CampaignGraphEdge[] = []): Map<string, Pos> {
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  const slugSet = new Set(slugs);

  for (const e of hierarchyEdges) {
    if (!slugSet.has(e.source) || !slugSet.has(e.target)) continue;
    const parent = e.relType === "child-of" || e.relType === "ward-of" ? e.target : e.source;
    const child = e.relType === "child-of" || e.relType === "ward-of" ? e.source : e.target;
    if (!slugSet.has(parent) || !slugSet.has(child) || parent === child) continue;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(child);
    hasParent.add(child);
  }

  const roots = slugs.filter((s) => !hasParent.has(s));
  const depth = new Map<string, number>();
  const queue = [...roots];
  for (const r of roots) depth.set(r, 0);
  while (queue.length) {
    const s = queue.shift()!;
    for (const child of children.get(s) ?? []) {
      if (!depth.has(child)) { depth.set(child, (depth.get(s) ?? 0) + 1); queue.push(child); }
    }
  }

  const assigned = new Map<string, number>();
  let leafX = 0;
  function assignX(s: string): number {
    if (assigned.has(s)) return assigned.get(s)!;
    const kids = children.get(s) ?? [];
    if (kids.length === 0) { const x = leafX++ * TREE_X; assigned.set(s, x); return x; }
    const xs = kids.map(assignX);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    assigned.set(s, x);
    return x;
  }
  for (const r of roots) assignX(r);

  const maxDepth = depth.size > 0 ? Math.max(...depth.values()) : 0;
  const pos = new Map<string, Pos>();
  for (const [s, d] of depth) pos.set(s, { x: assigned.get(s) ?? 0, y: d * TREE_Y, vx: 0, vy: 0 });

  let freeX = 0;
  for (const s of slugs) {
    if (!pos.has(s)) { pos.set(s, { x: freeX++ * TREE_X, y: (maxDepth + 1.5) * TREE_Y, vx: 0, vy: 0 }); }
  }

  for (const e of spouseEdges) {
    const a = pos.get(e.source);
    const b = pos.get(e.target);
    if (!a || !b) continue;
    const y = Math.min(a.y, b.y);
    const mid = (a.x + b.x) / 2;
    pos.set(e.source, { ...a, x: mid - TREE_X * 0.32, y });
    pos.set(e.target, { ...b, x: mid + TREE_X * 0.32, y });
  }

  return pos;
}

// === Relationship category colors ===
const REL_CAT_COLORS: Record<string, string> = {
  faction:   "#a075ff",
  social:    "#6bb8ff",
  conflict:  "#ff6b6b",
  location:  "#78c8a0",
  family:    "#e68cc8",
  ownership: "#d4a957",
  political: "#c878a0",
  religion:  "#78dcd4",
  session:   "#c0b0e0",
  generic:   "#888888",
};

function relCatColor(relType: string): string {
  const cat = REL_TYPE_MAP.get(relType)?.category;
  return REL_CAT_COLORS[cat ?? ""] ?? "#888888";
}

const FAMILY_REL_TYPES = new Set(["parent-of", "child-of", "spouse-of", "sibling-of", "guardian-of", "ward-of"]);
const HIERARCHY_REL_TYPES = new Set(["parent-of", "child-of", "guardian-of", "ward-of"]);

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

type GraphMode = "relationship" | "family";

// === Component ===
export default function GraphClient({ campaignId, mode = "relationship" }: { campaignId: number; mode?: GraphMode }) {
  const isFamilyMode = mode === "family";
  const relationshipTypes = isFamilyMode ? RELATIONSHIP_TYPES.filter((rt) => rt.category === "family") : RELATIONSHIP_TYPES;
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<CampaignGraphNode[]>([]);
  const [edges, setEdges] = useState<CampaignGraphEdge[]>([]);
  const [familyTrees, setFamilyTrees] = useState<CampaignFamilyTree[]>([]);
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<Map<string, Pos>>(new Map());
  const [simDone, setSimDone] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [panStart, setPanStart] = useState<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [filterCats, setFilterCats] = useState<Set<string>>(new Set(Object.keys(CAT_COLORS)));
  const [filterRelCats, setFilterRelCats] = useState<Set<string>>(new Set(isFamilyMode ? ["family"] : Object.keys(REL_CAT_COLORS)));
  const [showRelOnly, setShowRelOnly] = useState(isFamilyMode);
  const [layout, setLayout] = useState<"force" | "tree">(isFamilyMode ? "tree" : "force");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [addRelOpen, setAddRelOpen] = useState(false);
  const [addRelType, setAddRelType] = useState(relationshipTypes[0]?.type ?? "related-to");
  const [addRelTarget, setAddRelTarget] = useState("");
  const [addRelBusy, setAddRelBusy] = useState(false);
  const [addRelMsg, setAddRelMsg] = useState("");
  const [createPageBusy, setCreatePageBusy] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [deleteRelBusy, setDeleteRelBusy] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    const data = await fetch(`/api/campaigns/${campaignId}/graph`)
      .then((r) => r.json())
      .catch(() => ({ nodes: [], edges: [] }));
    setNodes(data.nodes || []);
    setEdges(data.edges || []);
    setFamilyTrees(data.familyTrees || []);
    setSelectedTreeId((current) => current || data.familyTrees?.[0]?.id || "");
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const familyEdges = useMemo(
    () => edges.filter((e) => !e.missing && e.relType && FAMILY_REL_TYPES.has(e.relType)),
    [edges]
  );
  const familySlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const edge of familyEdges) {
      slugs.add(edge.source);
      slugs.add(edge.target);
    }
    return slugs;
  }, [familyEdges]);
  const selectedFamilyTree = useMemo(
    () => (isFamilyMode ? familyTrees.find((tree) => tree.id === selectedTreeId) || familyTrees[0] : undefined),
    [isFamilyMode, familyTrees, selectedTreeId]
  );
  const familyTreeNodes = useMemo<CampaignGraphNode[]>(() => {
    if (!selectedFamilyTree) return [];
    return selectedFamilyTree.nodes.map((node) => ({
      slug: `family:${selectedFamilyTree.id}:${node.id}`,
      familyId: node.id,
      pageSlug: node.pageSlug,
      missingPage: !node.pageSlug,
      name: node.name,
      category: node.category || "character",
      summary: node.pageSlug ? "Linked to a wiki page." : "No wiki page yet.",
      image: node.image,
      tags: [],
      visibility: "players",
      approvalStatus: "approved",
      keyLinks: [],
      outgoingLinks: [],
      backlinks: []
    }));
  }, [selectedFamilyTree]);
  const familyTreeEdges = useMemo<CampaignGraphEdge[]>(() => {
    if (!selectedFamilyTree) return [];
    return selectedFamilyTree.edges.map((edge) => ({
      source: `family:${selectedFamilyTree.id}:${edge.source}`,
      target: `family:${selectedFamilyTree.id}:${edge.target}`,
      label: edge.label || edge.type,
      missing: false,
      relType: edge.type
    }));
  }, [selectedFamilyTree]);
  const baseNodes = useMemo(
    () => (selectedFamilyTree ? familyTreeNodes : isFamilyMode ? nodes.filter((n) => familySlugs.has(n.slug)) : nodes),
    [selectedFamilyTree, familyTreeNodes, isFamilyMode, nodes, familySlugs]
  );
  const visibleNodes = useMemo(
    () => baseNodes.filter((n) => filterCats.has(n.category)),
    [baseNodes, filterCats]
  );
  const visibleSlugs = useMemo(() => new Set(visibleNodes.map((n) => n.slug)), [visibleNodes]);
  const visibleEdges = useMemo(
    () =>
      (selectedFamilyTree ? familyTreeEdges : edges).filter(
        (e) =>
          !e.missing &&
          visibleSlugs.has(e.source) &&
          visibleSlugs.has(e.target) &&
          (!isFamilyMode || Boolean(e.relType && FAMILY_REL_TYPES.has(e.relType))) &&
          (!showRelOnly || Boolean(e.relType)) &&
          (!e.relType || filterRelCats.has(REL_TYPE_MAP.get(e.relType)?.category ?? "generic"))
      ),
    [edges, familyTreeEdges, selectedFamilyTree, visibleSlugs, isFamilyMode, showRelOnly, filterRelCats]
  );

  const hierarchyEdges = useMemo(
    () => visibleEdges.filter((e) => HIERARCHY_REL_TYPES.has(e.relType || "")),
    [visibleEdges]
  );
  const spouseEdges = useMemo(
    () => visibleEdges.filter((e) => e.relType === "spouse-of"),
    [visibleEdges]
  );
  const hasHierarchyEdges = isFamilyMode || hierarchyEdges.length > 0 || spouseEdges.length > 0;

  const treePositions = useMemo(() => {
    if (layout !== "tree") return null;
    return computeTreeLayout(visibleNodes.map((n) => n.slug), hierarchyEdges, spouseEdges);
  }, [layout, visibleNodes, hierarchyEdges, spouseEdges]);

  // Force simulation
  useEffect(() => {
    if (layout === "tree") { setSimDone(true); return; }
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
  }, [visibleNodes, visibleEdges, layout]);

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

  const selectedNode = selected ? baseNodes.find((n) => n.slug === selected) : null;
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
  const nodeMap = useMemo(() => new Map(baseNodes.map((n) => [n.slug, n])), [baseNodes]);
  const usedCats = useMemo(() => [...new Set(baseNodes.map((n) => n.category))].sort(), [baseNodes]);
  const usedRelCats = useMemo(() => {
    const cats = new Set<string>();
    const sourceEdges = selectedFamilyTree ? familyTreeEdges : isFamilyMode ? familyEdges : edges;
    for (const e of sourceEdges) {
      if (e.relType) cats.add(REL_TYPE_MAP.get(e.relType)?.category ?? "generic");
    }
    return [...cats].sort();
  }, [edges, familyEdges, familyTreeEdges, selectedFamilyTree, isFamilyMode]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return visibleNodes.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 12);
  }, [searchQuery, visibleNodes]);

  const searchMatchSlugs = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return new Set(searchResults.map((n) => n.slug));
  }, [searchQuery, searchResults]);

  const activePositions = treePositions ?? positions;

  // === Cluster mode ===
  const clusterMeta = useMemo(() => {
    const map = new Map<string, { count: number; slugs: string[] }>();
    for (const n of visibleNodes) {
      if (collapsedCats.has(n.category)) {
        if (!map.has(n.category)) map.set(n.category, { count: 0, slugs: [] });
        const entry = map.get(n.category)!;
        entry.count++;
        entry.slugs.push(n.slug);
      }
    }
    return map;
  }, [visibleNodes, collapsedCats]);

  const clusterPositions = useMemo(() => {
    const map = new Map<string, Pos>();
    for (const [cat, meta] of clusterMeta) {
      let sx = 0, sy = 0, cnt = 0;
      for (const slug of meta.slugs) {
        const p = activePositions.get(slug);
        if (p) { sx += p.x; sy += p.y; cnt++; }
      }
      if (cnt > 0) map.set(`cluster:${cat}`, { x: sx / cnt, y: sy / cnt, vx: 0, vy: 0 });
    }
    return map;
  }, [clusterMeta, activePositions]);

  const clusterSlugs = useMemo(() => {
    const m = new Map<string, string>();
    for (const [cat, meta] of clusterMeta)
      for (const slug of meta.slugs) m.set(slug, `cluster:${cat}`);
    return m;
  }, [clusterMeta]);

  const renderEdges = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ source: string; target: string; relType?: string; label?: string }> = [];
    for (const edge of visibleEdges) {
      const src = clusterSlugs.get(edge.source) ?? edge.source;
      const tgt = clusterSlugs.get(edge.target) ?? edge.target;
      if (src === tgt) continue;
      const key = [src, tgt].sort().join("\0");
      if (!seen.has(key)) { seen.add(key); result.push({ source: src, target: tgt, relType: edge.relType ?? undefined, label: edge.label ?? undefined }); }
    }
    return result;
  }, [visibleEdges, clusterSlugs]);

  const renderPositions = useMemo(() => {
    const m = new Map(activePositions);
    for (const [k, v] of clusterPositions) m.set(k, v);
    return m;
  }, [activePositions, clusterPositions]);

  function jumpToNode(slug: string) {
    setSelected(slug);
    setAddRelOpen(false);
    setAddRelMsg("");
    setSearchQuery("");
    setSearchOpen(false);
    const pos = activePositions.get(slug);
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

  function toggleCollapsed(cat: string) {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  function toggleRelCat(cat: string) {
    setFilterRelCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function resolveNodeInput(input: string) {
    const value = input.trim().toLowerCase();
    const exactSlug = nodes.find((n) => n.slug.toLowerCase() === value);
    if (exactSlug) return exactSlug.slug;
    const exactName = nodes.find((n) => n.name.toLowerCase() === value);
    if (exactName) return exactName.slug;
    return input.trim();
  }

  async function addRelationship(sourceSlug: string) {
    const target = resolveNodeInput(addRelTarget);
    setAddRelBusy(true);
    setAddRelMsg("");
    const res = await fetch(`/api/campaigns/${campaignId}/pages/${sourceSlug}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: addRelType, target })
    });
    const data = await res.json();
    setAddRelBusy(false);
    if (res.ok) {
      setAddRelMsg("Saved.");
      setAddRelOpen(false);
      setAddRelTarget("");
      await loadGraph();
    } else {
      setAddRelMsg(data.error || "Could not save.");
    }
  }

  async function deleteRelationship(edge: CampaignGraphEdge) {
    if (!edge.relType) return;
    const key = `${edge.source}:${edge.relType}:${edge.target}`;
    setDeleteRelBusy(key);
    const res = await fetch(`/api/campaigns/${campaignId}/pages/${edge.source}/relationships`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: edge.relType, target: edge.target })
    });
    const data = await res.json().catch(() => ({}));
    setDeleteRelBusy(null);
    if (res.ok) {
      setAddRelMsg("Relationship removed.");
      await loadGraph();
    } else {
      setAddRelMsg(data.error || "Could not remove relationship.");
    }
  }

  async function createPageForNode(node: CampaignGraphNode) {
    setCreatePageBusy(true);
    setAddRelMsg("");
    const res = await fetch(`/api/campaigns/${campaignId}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: node.name,
        category: node.category || "character",
        visibility: "players",
        content: `# ${node.name}\n\nImported from the family tree. Fill in biography, titles, house, and campaign notes.\n\n## Family\n\nOpen the Family Tree to review relatives and lineage.\n`
      })
    });
    const data = await res.json().catch(() => ({}));
    setCreatePageBusy(false);
    if (res.ok || res.status === 409) {
      setAddRelMsg(res.ok ? "Wiki page created." : "A wiki page already exists.");
      await loadGraph();
      if (data.slug) window.location.href = `/campaigns/${campaignId}/pages/${data.slug}?edit=1`;
    } else {
      setAddRelMsg(data.error || "Could not create wiki page.");
    }
  }

  const dimmed = (slug: string) => {
    if (searchMatchSlugs) return !searchMatchSlugs.has(slug);
    if (selected) return !connectedSlugs.has(slug);
    return false;
  };

  return (
    <div className="graph-shell">
      <aside className="graph-filters panel">
        {isFamilyMode && familyTrees.length > 0 && (
          <>
            <h4>Family tree</h4>
            <select value={selectedTreeId || familyTrees[0]?.id || ""} onChange={(event) => setSelectedTreeId(event.target.value)}>
              {familyTrees.map((tree) => (
                <option key={tree.id} value={tree.id}>{tree.name}</option>
              ))}
            </select>
            <p className="muted graph-count">
              {selectedFamilyTree?.nodes.length || 0} people · {selectedFamilyTree?.edges.length || 0} family links
            </p>
            <hr />
          </>
        )}
        <div className="graph-search-wrap">
          <input
            className="graph-search-input"
            placeholder={isFamilyMode ? "Search family members..." : "Search nodes..."}
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
        <h4>{isFamilyMode ? "People and houses" : "Categories"}</h4>
        {usedCats.length > 1 && (
          <div className="graph-filter-actions">
            <button type="button" className="linklike" onClick={() => setCollapsedCats(new Set(usedCats))}>Collapse all</button>
            <button type="button" className="linklike" onClick={() => setCollapsedCats(new Set())}>Expand all</button>
          </div>
        )}
        {usedCats.map((cat) => (
          <label key={cat} className="graph-filter-item">
            <input type="checkbox" checked={filterCats.has(cat)} onChange={() => toggleCat(cat)} />
            <span className="cat-dot" style={{ background: catColor(cat) }} />
            <span className="graph-filter-label">{cat}</span>
            {filterCats.has(cat) && (
              <button
                type="button"
                className={`graph-cluster-btn${collapsedCats.has(cat) ? " active" : ""}`}
                title={collapsedCats.has(cat) ? "Expand cluster" : "Collapse to cluster"}
                onClick={(e) => { e.preventDefault(); toggleCollapsed(cat); }}
              >⬡</button>
            )}
          </label>
        ))}
        {usedRelCats.length > 0 && (
          <>
            <hr />
            <h4>Relationship types</h4>
            {isFamilyMode ? (
              <p className="muted graph-count">Showing parent, child, spouse, sibling, and guardian links.</p>
            ) : (
              usedRelCats.map((cat) => (
                <label key={cat} className="graph-filter-item">
                  <input type="checkbox" checked={filterRelCats.has(cat)} onChange={() => toggleRelCat(cat)} />
                  <span className="cat-dot" style={{ background: REL_CAT_COLORS[cat] ?? "#888" }} />
                  {cat}
                </label>
              ))
            )}
          </>
        )}
        {!isFamilyMode && (
          <>
            <hr />
            <label className="graph-filter-item">
              <input type="checkbox" checked={showRelOnly} onChange={(e) => setShowRelOnly(e.target.checked)} />
              <span>Typed relationships only</span>
            </label>
          </>
        )}
        {hasHierarchyEdges && (
          <>
            <hr />
            <h4>Layout</h4>
            <label className="graph-filter-item">
              <input type="radio" name="layout" checked={layout === "force"} onChange={() => setLayout("force")} />
              <span>Force-directed</span>
            </label>
            <label className="graph-filter-item">
              <input type="radio" name="layout" checked={layout === "tree"} onChange={() => setLayout("tree")} />
              <span>{isFamilyMode ? "Family tree" : "Family / hierarchy tree"}</span>
            </label>
          </>
        )}
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
          <defs>
            {visibleNodes.filter((n) => n.image).map((node) => (
              <clipPath key={`clip-${node.slug}`} id={`graph-node-clip-${node.slug}`}>
                <circle r={22} />
              </clipPath>
            ))}
          </defs>
          {renderEdges.map((edge, i) => {
            const a = renderPositions.get(edge.source);
            const b = renderPositions.get(edge.target);
            if (!a || !b) return null;
            const isRel = Boolean(edge.relType);
            const isActive = selected && (edge.source === selected || edge.target === selected);
            const isDim = selected && !isActive;
            const edgeColor = isActive ? "var(--gold)" : isRel ? relCatColor(edge.relType!) : undefined;
            return (
              <line
                key={`e-${i}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={[
                  "graph-edge",
                  isRel ? "graph-edge-rel" : "",
                  isDim ? "graph-edge-dim" : "",
                ].join(" ")}
                style={edgeColor ? { stroke: edgeColor } : undefined}
              />
            );
          })}

          {selected &&
            visibleEdges
              .filter((e) => (e.source === selected || e.target === selected) && e.relType)
              .map((edge, i) => {
                const a = activePositions.get(edge.source);
                const b = activePositions.get(edge.target);
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

          {[...clusterMeta.entries()].map(([cat, meta]) => {
            const pos = clusterPositions.get(`cluster:${cat}`);
            if (!pos) return null;
            const color = catColor(cat);
            return (
              <g
                key={`cluster-${cat}`}
                className="graph-node graph-cluster-node"
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => toggleCollapsed(cat)}
              >
                <circle r={38} fill={color} fillOpacity={0.92} stroke="var(--surface-2)" strokeWidth={3} />
                <text textAnchor="middle" className="graph-node-initials" dy={-8}>{cat}</text>
                <text textAnchor="middle" className="graph-cluster-count" dy={12}>{meta.count} nodes</text>
              </g>
            );
          })}

          {visibleNodes.filter((n) => !collapsedCats.has(n.category)).map((node) => {
            const pos = activePositions.get(node.slug);
            if (!pos) return null;
            const isSel = node.slug === selected;
            const isDim = dimmed(node.slug);
            const initials = node.name.slice(0, 2).toUpperCase();
            const color = catColor(node.category);
            const showImage = isFamilyMode && Boolean(node.image);
            if (selectedFamilyTree) {
              return (
                <g
                  key={node.slug}
                  className={["graph-node", "graph-family-card", isSel ? "graph-node-selected" : "", isDim ? "graph-node-dim" : ""].join(" ")}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onPointerDown={(e) => onNodePointerDown(e, node.slug)}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={-68}
                    y={-28}
                    width={136}
                    height={56}
                    rx={6}
                    fill={node.missingPage ? "var(--bg-base)" : "var(--bg-elevated)"}
                    stroke={isSel ? "var(--gold)" : node.missingPage ? "var(--border-soft)" : color}
                    strokeDasharray={node.missingPage ? "4 3" : undefined}
                    strokeWidth={isSel ? 2.5 : 1.2}
                    opacity={isDim ? 0.35 : 0.98}
                  />
                  {showImage ? (
                    <image href={node.image} x={-58} y={-18} width={36} height={36} preserveAspectRatio="xMidYMid slice" opacity={isDim ? 0.35 : 1} />
                  ) : (
                    <circle cx={-40} cy={0} r={18} fill={color} fillOpacity={node.missingPage ? 0.28 : 0.8} />
                  )}
                  {!showImage && (
                    <text x={-40} y={0} textAnchor="middle" dominantBaseline="central" className="graph-node-initials" fillOpacity={isDim ? 0.4 : 1}>
                      {initials}
                    </text>
                  )}
                  <text x={-12} y={-4} className="graph-node-label graph-family-name" fillOpacity={isDim ? 0.35 : 1}>
                    {node.name.length > 22 ? node.name.slice(0, 20) + "..." : node.name}
                  </text>
                  <text x={-12} y={14} className="graph-edge-label" fillOpacity={isDim ? 0.25 : 0.72}>
                    {node.missingPage ? "create page" : "wiki page"}
                  </text>
                </g>
              );
            }
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
                {showImage ? (
                  <image
                    href={node.image}
                    x={-22}
                    y={-22}
                    width={44}
                    height={44}
                    clipPath={`url(#graph-node-clip-${node.slug})`}
                    preserveAspectRatio="xMidYMid slice"
                    opacity={isDim ? 0.35 : 1}
                  />
                ) : (
                  <text textAnchor="middle" dominantBaseline="central" className="graph-node-initials" fillOpacity={isDim ? 0.4 : 1}>
                    {initials}
                  </text>
                )}
                <text textAnchor="middle" y={36} className="graph-node-label" fillOpacity={isDim ? 0.3 : 1}>
                  {node.name.length > 16 ? node.name.slice(0, 14) + "…" : node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {isFamilyMode && !loading && familyEdges.length === 0 && (
        <div className="graph-empty panel">
          <h3>No family tree yet</h3>
          <p className="muted">
            Add family relationships from a page detail panel, or import genealogy data as frontmatter relationships.
            Parent, spouse, sibling, and guardian links will appear here separately from the general relationship graph.
          </p>
        </div>
      )}

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
            {selectedNode.pageSlug || !selectedNode.missingPage ? (
            <a href={`/campaigns/${campaignId}/pages/${selectedNode.pageSlug || selectedNode.slug}`} className="quiet-link">
              {selectedNode.name}
            </a>
            ) : (
              selectedNode.name
            )}
          </h3>
          {selectedNode.missingPage && <p className="muted graph-detail-summary">No wiki page yet. Create one when this person is ready for a full entry.</p>}
          {selectedNode.summary && <p className="muted graph-detail-summary">{selectedNode.summary}</p>}

          {selectedOutgoing.length > 0 && (
            <div className="graph-detail-section">
              <h4>Links to</h4>
              {selectedOutgoing.map((e, i) => {
                const target = nodeMap.get(e.target);
                const rtDef = e.relType ? REL_TYPE_MAP.get(e.relType) : null;
                const deleteKey = `${e.source}:${e.relType}:${e.target}`;
                return (
                  <div key={i} className="graph-detail-link-row">
                    <button type="button" className="graph-detail-link" onClick={() => setSelected(e.target)}>
                      {rtDef && <span className="rel-type">{rtDef.label}</span>}
                      {target?.name ?? e.target}
                    </button>
                    {e.relEditable && e.relType && (
                      <button
                        type="button"
                        className="graph-rel-delete"
                        disabled={deleteRelBusy === deleteKey}
                        title="Remove relationship"
                        onClick={() => deleteRelationship(e)}
                      >
                        {deleteRelBusy === deleteKey ? "..." : "x"}
                      </button>
                    )}
                  </div>
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

          {!selectedFamilyTree && (
          <div className="graph-detail-section">
            {!addRelOpen ? (
              <button
                type="button"
                className="button secondary"
                style={{ width: "100%", marginTop: 4 }}
                onClick={() => { setAddRelOpen(true); setAddRelTarget(""); setAddRelMsg(""); }}
              >
                + Add relationship
              </button>
            ) : (
              <div className="graph-add-rel stack" style={{ gap: 6 }}>
                <select value={addRelType} onChange={(e) => setAddRelType(e.target.value)}>
                  {relationshipTypes.map((rt) => <option key={rt.type} value={rt.type}>{rt.label}</option>)}
                </select>
                <input
                  list="graph-rel-targets"
                  value={addRelTarget}
                  onChange={(e) => setAddRelTarget(e.target.value)}
                  placeholder="Target page slug or name"
                />
                <datalist id="graph-rel-targets">
                  {(isFamilyMode ? baseNodes : nodes).filter((n) => n.slug !== selectedNode.slug).map((n) => <option key={n.slug} value={n.slug}>{n.name}</option>)}
                </datalist>
                {addRelMsg && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{addRelMsg}</p>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    disabled={addRelBusy || !addRelTarget.trim()}
                    onClick={() => addRelationship(selectedNode.slug)}
                  >
                    {addRelBusy ? "Saving…" : "Save"}
                  </button>
                  <button type="button" className="secondary" onClick={() => setAddRelOpen(false)}>Cancel</button>
                </div>
              </div>
            )}
            {addRelMsg && !addRelOpen && <p className="muted graph-rel-message">{addRelMsg}</p>}
          </div>
          )}

          {selectedNode.missingPage ? (
            <button type="button" className="button secondary graph-open-btn" disabled={createPageBusy} onClick={() => createPageForNode(selectedNode)}>
              {createPageBusy ? "Creating..." : "Create wiki page"}
            </button>
          ) : (
            <a href={`/campaigns/${campaignId}/pages/${selectedNode.pageSlug || selectedNode.slug}`} className="button secondary graph-open-btn">
              Open page
            </a>
          )}
          {addRelMsg && selectedFamilyTree && <p className="muted graph-rel-message">{addRelMsg}</p>}
        </aside>
      )}
    </div>
  );
}

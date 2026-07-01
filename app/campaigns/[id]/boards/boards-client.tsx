"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type BoardNode = { id: string; type: "page" | "note"; x: number; y: number; w?: number; h?: number; pageSlug?: string; text?: string; color?: string };
type BoardEdge = { id: string; from: string; to: string; label?: string };
type Board = { slug: string; name: string; nodes: BoardNode[]; edges: BoardEdge[]; sha?: string };
type KnownPage = { slug: string; name: string; category: string };

const NOTE_COLORS = ["#3a2f10", "#0a2a1f", "#1a1a3a", "#2a1a2a", "#1a2a2a"];
const GRID = 20;

function snap(v: number) { return Math.round(v / GRID) * GRID; }
function uid() { return Math.random().toString(36).slice(2, 9); }

export default function BoardsClient({ campaignId }: { campaignId: number }) {
  const api = `/api/campaigns/${campaignId}/boards`;
  const [boards, setBoards] = useState<Board[]>([]);
  const [pages, setPages] = useState<KnownPage[]>([]);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tool, setTool] = useState<"select" | "note" | "edge">("select");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [edgeStart, setEdgeStart] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [pageFilter, setPageFilter] = useState("");
  const [newBoardName, setNewBoardName] = useState("");

  // Pan/zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isPanning = useRef(false);
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const isDragging = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const board = boards.find((b) => b.slug === selected) ?? null;

  useEffect(() => {
    fetch(api).then((r) => r.json()).then((d) => {
      const list: Board[] = d.boards || [];
      setBoards(list);
      setSelected((s) => s || list[0]?.slug || "");
    });
    fetch(`/api/campaigns/${campaignId}/pages`).then((r) => r.json()).then((d) =>
      setPages(((d.pages || []) as KnownPage[]).map((p: any) => ({ slug: p.slug, name: p.frontmatter?.name || p.slug, category: p.frontmatter?.category || "" })))
    );
  }, [campaignId]);

  function patchBoard(patch: Partial<Omit<Board, "slug" | "name">>) {
    setBoards((bs) => bs.map((b) => b.slug === selected ? { ...b, ...patch } : b));
    setDirty(true);
  }

  async function saveBoard() {
    if (!board) return;
    setSaving(true);
    const res = await fetch(api, { method: "PUT", body: JSON.stringify({ slug: board.slug, name: board.name, nodes: board.nodes, edges: board.edges }) });
    const data = await res.json();
    if (res.ok) { setBoards(data.boards || []); setDirty(false); setMessage("Saved."); setTimeout(() => setMessage(""), 2000); }
    else setMessage(data.error || "Save failed.");
    setSaving(false);
  }

  async function createBoard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;
    const res = await fetch(api, { method: "PUT", body: JSON.stringify({ name, nodes: [], edges: [] }) });
    const data = await res.json();
    if (res.ok) {
      const list: Board[] = data.boards || [];
      setBoards(list);
      const created = list.find((b) => b.name === name);
      if (created) setSelected(created.slug);
      setNewBoardName("");
      setPan({ x: 0, y: 0 }); setZoom(1);
    }
  }

  async function deleteBoard() {
    if (!board || !confirm(`Delete board "${board.name}"?`)) return;
    const res = await fetch(api, { method: "DELETE", body: JSON.stringify({ slug: board.slug }) });
    const data = await res.json();
    if (res.ok) { const list: Board[] = data.boards || []; setBoards(list); setSelected(list[0]?.slug || ""); }
  }

  // ── Node manipulation ───────────────────────────────────────────────────────

  function addNote() {
    if (!board) return;
    const id = uid();
    const cx = (-pan.x + 400) / zoom;
    const cy = (-pan.y + 300) / zoom;
    const node: BoardNode = { id, type: "note", x: snap(cx), y: snap(cy), text: "New note", color: NOTE_COLORS[0], w: 180, h: 100 };
    patchBoard({ nodes: [...board.nodes, node] });
    setSelectedNode(id);
    setEditingNode(id);
    setTool("select");
  }

  function addPageNode(pageSlug: string) {
    if (!board) return;
    const page = pages.find((p) => p.slug === pageSlug);
    if (!page) return;
    const id = uid();
    const cx = (-pan.x + 400) / zoom + Math.random() * 60 - 30;
    const cy = (-pan.y + 300) / zoom + Math.random() * 60 - 30;
    const node: BoardNode = { id, type: "page", x: snap(cx), y: snap(cy), pageSlug, text: page.name };
    patchBoard({ nodes: [...board.nodes, node] });
    setSelectedNode(id);
    setShowPagePicker(false);
    setPageFilter("");
    setTool("select");
  }

  function deleteNode(id: string) {
    if (!board) return;
    patchBoard({
      nodes: board.nodes.filter((n) => n.id !== id),
      edges: board.edges.filter((e) => e.from !== id && e.to !== id)
    });
    if (selectedNode === id) setSelectedNode(null);
    if (editingNode === id) setEditingNode(null);
  }

  function updateNodeText(id: string, text: string) {
    if (!board) return;
    patchBoard({ nodes: board.nodes.map((n) => n.id === id ? { ...n, text } : n) });
  }

  function updateNodeColor(id: string, color: string) {
    if (!board) return;
    patchBoard({ nodes: board.nodes.map((n) => n.id === id ? { ...n, color } : n) });
  }

  function deleteEdge(id: string) {
    if (!board) return;
    patchBoard({ edges: board.edges.filter((e) => e.id !== id) });
  }

  // ── Canvas interactions ─────────────────────────────────────────────────────

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== canvasRef.current && !(e.target as HTMLElement).classList.contains("board-svg")) return;
    if (tool === "note") { addNote(); return; }
    setSelectedNode(null);
    setEditingNode(null);
    setEdgeStart(null);
    isPanning.current = true;
    panStart.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
    e.preventDefault();
  }, [tool, board]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      const nx = panStart.current.px + (e.clientX - panStart.current.mx);
      const ny = panStart.current.py + (e.clientY - panStart.current.my);
      panRef.current = { x: nx, y: ny };
      setPan({ x: nx, y: ny });
    }
    if (isDragging.current && board) {
      const { id, ox, oy } = isDragging.current;
      const nx = snap(ox + (e.clientX - panStart.current.mx) / zoomRef.current);
      const ny = snap(oy + (e.clientY - panStart.current.my) / zoomRef.current);
      setBoards((bs) => bs.map((b) => b.slug === selected ? { ...b, nodes: b.nodes.map((n) => n.id === id ? { ...n, x: nx, y: ny } : n) } : b));
    }
  }, [board, selected]);

  const onMouseUp = useCallback(() => {
    if (isDragging.current) { setDirty(true); isDragging.current = null; }
    isPanning.current = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const next = Math.min(3, Math.max(0.2, zoomRef.current * factor));
    zoomRef.current = next;
    setZoom(next);
  }, []);

  function onNodeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (tool === "edge") {
      if (!edgeStart) { setEdgeStart(id); return; }
      if (edgeStart !== id && board) {
        const newEdge: BoardEdge = { id: uid(), from: edgeStart, to: id };
        patchBoard({ edges: [...board.edges, newEdge] });
      }
      setEdgeStart(null);
      return;
    }
    setSelectedNode(id);
    const node = board?.nodes.find((n) => n.id === id);
    if (!node) return;
    isDragging.current = { id, ox: node.x, oy: node.y };
    panStart.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
    e.preventDefault();
  }

  // ── SVG edge rendering ──────────────────────────────────────────────────────

  function edgePath(fromId: string, toId: string) {
    const from = board?.nodes.find((n) => n.id === fromId);
    const to = board?.nodes.find((n) => n.id === toId);
    if (!from || !to) return null;
    const fx = from.x + (from.w || 160) / 2;
    const fy = from.y + (from.h || 80) / 2;
    const tx = to.x + (to.w || 160) / 2;
    const ty = to.y + (to.h || 80) / 2;
    const cx = (fx + tx) / 2;
    const cy = Math.min(fy, ty) - 60;
    return `M${fx},${fy} Q${cx},${cy} ${tx},${ty}`;
  }

  const filteredPages = pages.filter((p) => !pageFilter || p.name.toLowerCase().includes(pageFilter.toLowerCase()) || p.category.toLowerCase().includes(pageFilter.toLowerCase()));

  if (!boards.length && !newBoardName) {
    return (
      <div className="panel" style={{ maxWidth: 480 }}>
        <h2>Create your first board</h2>
        <form onSubmit={createBoard} className="inline-form">
          <input placeholder="Board name…" value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} required />
          <button>Create</button>
        </form>
      </div>
    );
  }

  return (
    <div className="boards-shell">
      <aside className="panel boards-sidebar">
        <h2>Boards</h2>
        <div className="results">
          {boards.map((b) => (
            <button type="button" key={b.slug} className={b.slug === selected ? "nav-link active" : "nav-link"} onClick={() => { setSelected(b.slug); setSelectedNode(null); setEdgeStart(null); setPan({ x: 0, y: 0 }); setZoom(1); panRef.current = { x: 0, y: 0 }; zoomRef.current = 1; }}>
              <strong>{b.name}</strong>
              <span>{b.nodes.length} node{b.nodes.length === 1 ? "" : "s"}</span>
            </button>
          ))}
        </div>
        <form onSubmit={createBoard} className="inline-form" style={{ marginTop: 8 }}>
          <input placeholder="New board…" value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} />
          <button disabled={!newBoardName.trim()}>+</button>
        </form>

        {board && (
          <>
            <div className="field-group">
              <h3>Tools</h3>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button type="button" className={tool === "select" ? "active" : "secondary"} onClick={() => { setTool("select"); setEdgeStart(null); }}>Select</button>
                <button type="button" className={tool === "note" ? "active" : "secondary"} onClick={() => { setTool("note"); setEdgeStart(null); }}>Note</button>
                <button type="button" className={tool === "edge" ? "active" : "secondary"} onClick={() => { setTool("edge"); setSelectedNode(null); }}>Edge</button>
                <button type="button" className="secondary" onClick={() => setShowPagePicker(true)}>+ Page</button>
              </div>
              {tool === "note" && <p className="muted" style={{ fontSize: 12 }}>Click canvas to place a note.</p>}
              {tool === "edge" && <p className="muted" style={{ fontSize: 12 }}>{edgeStart ? "Click a target node." : "Click source node."}</p>}
            </div>

            {selectedNode && (() => {
              const node = board.nodes.find((n) => n.id === selectedNode);
              if (!node) return null;
              return (
                <div className="field-group">
                  <h3>Node</h3>
                  {node.type === "note" && (
                    <>
                      <label>Text
                        <textarea value={node.text || ""} onChange={(e) => updateNodeText(node.id, e.target.value)} rows={3} />
                      </label>
                      <label>Color
                        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                          {NOTE_COLORS.map((c) => (
                            <button key={c} type="button" onClick={() => updateNodeColor(node.id, c)} style={{ width: 24, height: 24, background: c, border: node.color === c ? "2px solid var(--gold)" : "2px solid transparent", borderRadius: 4, padding: 0, minHeight: 0 }} />
                          ))}
                        </div>
                      </label>
                    </>
                  )}
                  {node.type === "page" && node.pageSlug && (
                    <a href={`/campaigns/${campaignId}/pages/${node.pageSlug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>Open page →</a>
                  )}
                  <button type="button" className="danger" style={{ marginTop: 4 }} onClick={() => deleteNode(node.id)}>Delete node</button>
                </div>
              );
            })()}

            <div className="field-group">
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={saveBoard} disabled={saving || !dirty}>{saving ? "Saving…" : dirty ? "Save*" : "Saved"}</button>
                <button type="button" className="danger" onClick={deleteBoard}>Delete</button>
              </div>
              <p className="muted" style={{ fontSize: 12 }}>Zoom: {Math.round(zoom * 100)}% · Scroll to zoom · Drag canvas to pan</p>
            </div>
          </>
        )}
      </aside>

      {board ? (
        <div
          className="boards-canvas-wrap"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          <div
            ref={canvasRef}
            className="boards-canvas"
            onMouseDown={onCanvasMouseDown}
            style={{ cursor: tool === "note" ? "crosshair" : tool === "edge" ? "cell" : isPanning.current ? "grabbing" : "grab" }}
          >
            <div style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "relative", width: 4000, height: 3000 }}>
              {/* SVG edges */}
              <svg className="board-svg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="var(--border-soft)" />
                  </marker>
                </defs>
                {board.edges.map((edge) => {
                  const d = edgePath(edge.from, edge.to);
                  if (!d) return null;
                  return (
                    <g key={edge.id}>
                      <path d={d} stroke="var(--border-soft)" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" />
                      <path d={d} stroke="transparent" strokeWidth="12" fill="none" style={{ cursor: "pointer", pointerEvents: "stroke" }}
                        onClick={() => { if (confirm("Delete this edge?")) deleteEdge(edge.id); }} />
                    </g>
                  );
                })}
              </svg>

              {/* Nodes */}
              {board.nodes.map((node) => (
                <div
                  key={node.id}
                  className={`board-node board-node-${node.type}${selectedNode === node.id ? " selected" : ""}${edgeStart === node.id ? " edge-source" : ""}`}
                  style={{
                    position: "absolute",
                    left: node.x,
                    top: node.y,
                    width: node.w || (node.type === "page" ? 180 : 180),
                    minHeight: node.h || 80,
                    background: node.type === "note" ? (node.color || NOTE_COLORS[0]) : "var(--bg-elevated)",
                    cursor: tool === "edge" ? "cell" : "move"
                  }}
                  onMouseDown={(e) => onNodeMouseDown(e, node.id)}
                  onDoubleClick={() => { if (node.type === "note") setEditingNode(node.id); }}
                >
                  {node.type === "page" && (
                    <>
                      <div className="board-node-label">{node.text || node.pageSlug}</div>
                      <div className="board-node-hint">{pages.find((p) => p.slug === node.pageSlug)?.category || "page"}</div>
                    </>
                  )}
                  {node.type === "note" && (
                    editingNode === node.id ? (
                      <textarea
                        autoFocus
                        value={node.text || ""}
                        onChange={(e) => updateNodeText(node.id, e.target.value)}
                        onBlur={() => setEditingNode(null)}
                        style={{ background: "transparent", border: "none", outline: "none", resize: "none", width: "100%", height: "100%", color: "inherit", font: "inherit", padding: 0 }}
                      />
                    ) : (
                      <div className="board-node-text">{node.text || "Note"}</div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel"><p className="muted">Select or create a board.</p></div>
      )}

      {showPagePicker && (
        <div className="board-page-picker" onClick={(e) => { if (e.target === e.currentTarget) setShowPagePicker(false); }}>
          <div className="panel board-page-picker-inner">
            <h3>Add wiki page to board</h3>
            <input autoFocus placeholder="Filter pages…" value={pageFilter} onChange={(e) => setPageFilter(e.target.value)} />
            <div className="results board-page-picker-list">
              {filteredPages.map((p) => (
                <button type="button" key={p.slug} className="nav-link" onClick={() => addPageNode(p.slug)}>
                  <strong>{p.name}</strong><span>{p.category}</span>
                </button>
              ))}
              {!filteredPages.length && <p className="muted">No pages match.</p>}
            </div>
            <button type="button" className="secondary" onClick={() => { setShowPagePicker(false); setPageFilter(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {message && <p className="toast">{message}</p>}
    </div>
  );
}

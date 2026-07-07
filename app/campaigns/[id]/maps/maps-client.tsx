"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignMedia, WikiPage } from "@/lib/types";

type Layer = { id: string; name: string; visibility: "gm" | "players" };
type Pin = { x: number; y: number; label: string; pageSlug?: string; mapSlug?: string; layer?: string; icon?: string; discovered?: boolean; image?: string };
type Region = { x: number; y: number; w: number; h: number; label: string; layer?: string; color?: string };
type Route = { fromIndex: number; toIndex: number; label?: string; style?: "road" | "river" | "path" | "wall"; layer?: string };
type Journey = { id: string; name: string; steps: number[] };
type CampaignMap = { slug: string; name: string; image: string; pins: Pin[]; layers?: Layer[]; regions?: Region[]; routes?: Route[]; journeys?: Journey[]; scale?: { total: number; unit: string }; sha?: string };

const PIN_ICONS = ["📍", "🏰", "🌆", "🌊", "🌲", "🏔️", "⚔️", "☠️", "💎", "❓", "🔒", "⭐", "🚪", "🛖", "⛵"];
const DEFAULT_LAYER: Layer = { id: "default", name: "Default", visibility: "players" };

function layersOf(map: CampaignMap): Layer[] {
  return map.layers?.length ? map.layers : [DEFAULT_LAYER];
}

export default function MapsClient({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [maps, setMaps] = useState<CampaignMap[]>([]);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [addMode, setAddMode] = useState<"pin" | "region" | "route" | "measure" | null>(null);
  const [message, setMessage] = useState("");
  const [editingPin, setEditingPin] = useState<number | null>(null);
  const [editingRoute, setEditingRoute] = useState<number | null>(null);
  const [editingRegion, setEditingRegion] = useState<number | null>(null);
  const [routeFrom, setRouteFrom] = useState<number | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [newLayerName, setNewLayerName] = useState("");
  const [activeLayer, setActiveLayer] = useState<string>("default");
  const [measurePts, setMeasurePts] = useState<Array<{ x: number; y: number }>>([]);
  const [measureResult, setMeasureResult] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState(1);
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [journeyStep, setJourneyStep] = useState(0);
  const [journeyAddMode, setJourneyAddMode] = useState(false);
  const [newJourneyName, setNewJourneyName] = useState("");
  const [editingJourneyId, setEditingJourneyId] = useState<string | null>(null);
  const [playerView, setPlayerView] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}/maps`).then((r) => r.json()).then((d) => {
      const list: CampaignMap[] = d.maps || [];
      setMaps(list);
      setSelected((s) => s || list[0]?.slug || "");
    });
    fetch(`/api/campaigns/${campaign.id}/pages`).then((r) => r.json()).then((d) => setPages(d.pages || []));
    fetch(`/api/campaigns/${campaign.id}/media`).then((r) => r.json()).then((d) =>
      setImages(((d.media || []) as CampaignMedia[]).filter((m) => m.mediaType === "image").map((m) => m.name))
    );
  }, [campaign.id]);

  const map = maps.find((m) => m.slug === selected);
  const layers = map ? layersOf(map) : [DEFAULT_LAYER];

  function patchMap(slug: string, patch: Partial<CampaignMap>) {
    setMaps((ms) => ms.map((m) => (m.slug === slug ? { ...m, ...patch } : m)));
  }

  function updatePin(index: number, patch: Partial<Pin>) {
    if (!map) return;
    patchMap(map.slug, { pins: map.pins.map((p, i) => i === index ? { ...p, ...patch } : p) });
  }

  function updateRoute(index: number, patch: Partial<Route>) {
    if (!map) return;
    patchMap(map.slug, { routes: (map.routes || []).map((r, i) => i === index ? { ...r, ...patch } : r) });
  }

  function deleteRoute(index: number) {
    if (!map) return;
    patchMap(map.slug, { routes: (map.routes || []).filter((_, i) => i !== index) });
    if (editingRoute === index) setEditingRoute(null);
  }

  function updateRegion(index: number, patch: Partial<Region>) {
    if (!map) return;
    patchMap(map.slug, { regions: (map.regions || []).map((r, i) => i === index ? { ...r, ...patch } : r) });
  }

  function deleteRegion(index: number) {
    if (!map) return;
    patchMap(map.slug, { regions: (map.regions || []).filter((_, i) => i !== index) });
    if (editingRegion === index) setEditingRegion(null);
  }

  function createJourney() {
    if (!map || !newJourneyName.trim()) return;
    const id = `j${Date.now()}`;
    const journey: Journey = { id, name: newJourneyName.trim(), steps: [] };
    patchMap(map.slug, { journeys: [...(map.journeys || []), journey] });
    setNewJourneyName("");
    setEditingJourneyId(id);
    setJourneyAddMode(true);
  }

  function deleteJourney(id: string) {
    if (!map) return;
    patchMap(map.slug, { journeys: (map.journeys || []).filter((j) => j.id !== id) });
    if (activeJourneyId === id) { setActiveJourneyId(null); setJourneyStep(0); }
    if (editingJourneyId === id) { setEditingJourneyId(null); setJourneyAddMode(false); }
  }

  function journeyAddPin(pinIndex: number) {
    if (!map || !editingJourneyId) return;
    patchMap(map.slug, {
      journeys: (map.journeys || []).map((j) => j.id === editingJourneyId
        ? { ...j, steps: [...j.steps, pinIndex] }
        : j
      )
    });
  }

  function journeyRemoveLastPin() {
    if (!map || !editingJourneyId) return;
    patchMap(map.slug, {
      journeys: (map.journeys || []).map((j) => j.id === editingJourneyId
        ? { ...j, steps: j.steps.slice(0, -1) }
        : j
      )
    });
  }

  function startPlayback(id: string) {
    setActiveJourneyId(id);
    setJourneyStep(0);
    setEditingJourneyId(null);
    setJourneyAddMode(false);
    setAddMode(null);
    setEditingPin(null);
    setEditingRoute(null);
  }

  async function createMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const image = String(data.get("image") || "");
    if (!name || !image) return setMessage("Pick a name and an image.");
    const res = await fetch(`/api/campaigns/${campaign.id}/maps`, { method: "PUT", body: JSON.stringify({ name, image, pins: [], layers: [DEFAULT_LAYER] }) });
    const body = await res.json();
    if (res.ok) {
      setMaps(body.maps || []);
      const created = (body.maps || []).find((m: CampaignMap) => m.name === name);
      if (created) setSelected(created.slug);
      form.reset();
      setMessage("Map created.");
    } else setMessage(body.error || "Could not create map.");
  }

  async function saveMap() {
    if (!map) return;
    const res = await fetch(`/api/campaigns/${campaign.id}/maps`, { method: "PUT", body: JSON.stringify(map) });
    const body = await res.json();
    if (res.ok) setMaps(body.maps || []);
    setMessage(res.ok ? "Map saved." : body.error || "Save failed.");
  }

  async function deleteMap() {
    if (!map || !confirm(`Delete map "${map.name}"?`)) return;
    const res = await fetch(`/api/campaigns/${campaign.id}/maps`, { method: "DELETE", body: JSON.stringify({ slug: map.slug }) });
    const body = await res.json();
    if (res.ok) { setMaps(body.maps || []); setSelected((body.maps || [])[0]?.slug || ""); }
  }

  function computeDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = (b.y - a.y) / imageAspect;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
    if (!map || !addMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    if (addMode === "pin") {
      const newPin: Pin = { x, y, label: "New pin", layer: activeLayer, icon: "📍" };
      patchMap(map.slug, { pins: [...map.pins, newPin] });
      setEditingPin(map.pins.length);
      setAddMode(null);
    }

    if (addMode === "region") {
      const newRegion: Region = {
        x: Math.min(0.88, x),
        y: Math.min(0.88, y),
        w: 0.12,
        h: 0.12,
        label: "New region",
        layer: activeLayer,
        color: "#4a90d9"
      };
      patchMap(map.slug, { regions: [...(map.regions || []), newRegion] });
      setEditingRegion((map.regions || []).length);
      setAddMode(null);
    }

    if (addMode === "measure") {
      if (measurePts.length === 0) {
        setMeasurePts([{ x, y }]);
        setMeasureResult(null);
      } else if (measurePts.length === 1) {
        const pt2 = { x, y };
        const frac = computeDistance(measurePts[0], pt2);
        const scale = map.scale;
        const dist = scale ? (frac * scale.total).toFixed(1) + " " + scale.unit : (frac * 100).toFixed(1) + "% of map width";
        setMeasurePts([measurePts[0], pt2]);
        setMeasureResult(dist);
      } else {
        setMeasurePts([]);
        setMeasureResult(null);
        setAddMode(null);
      }
    }
  }

  function handlePinClickInRouteMode(pinIndex: number, event: React.MouseEvent) {
    event.stopPropagation();
    if (!map || addMode !== "route") return;
    if (routeFrom === null) {
      setRouteFrom(pinIndex);
    } else if (routeFrom !== pinIndex) {
      const newRoute: Route = { fromIndex: routeFrom, toIndex: pinIndex, label: "", style: "road", layer: activeLayer };
      patchMap(map.slug, { routes: [...(map.routes || []), newRoute] });
      setRouteFrom(null);
      setAddMode(null);
    }
  }

  function addLayer() {
    const name = newLayerName.trim();
    if (!name || !map) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const newLayer: Layer = { id, name, visibility: "gm" };
    patchMap(map.slug, { layers: [...layers.filter((l) => l.id !== "default"), newLayer].concat(layers.includes(DEFAULT_LAYER) ? [DEFAULT_LAYER] : []) });
    setNewLayerName("");
  }

  function toggleLayerVisibility(lid: string, vis: "gm" | "players") {
    if (!map) return;
    patchMap(map.slug, { layers: layers.map((l) => l.id === lid ? { ...l, visibility: vis } : l) });
  }

  function toggleLayerHidden(lid: string) {
    setHiddenLayers((s) => { const n = new Set(s); if (n.has(lid)) n.delete(lid); else n.add(lid); return n; });
  }

  const visiblePins = map
    ? map.pins.filter((p) => !hiddenLayers.has(p.layer || "default") && (!playerView || p.discovered))
    : [];
  const undiscoveredCount = map ? map.pins.filter((p) => !p.discovered).length : 0;

  return (
    <section className="maps-grid">
      <aside className="panel maps-sidebar">
        <h2>Maps</h2>
        <div className="results">
          {maps.map((m) => (
            <button type="button" key={m.slug} className={m.slug === selected ? "nav-link active" : "nav-link"} onClick={() => { setSelected(m.slug); setAddMode(null); setEditingPin(null); setMeasurePts([]); setMeasureResult(null); }}>
              <strong>{m.name}</strong>
              <span>{m.pins.length} pin{m.pins.length === 1 ? "" : "s"}</span>
            </button>
          ))}
          {!maps.length && <p className="muted">No maps yet.</p>}
        </div>

        <div className="field-group">
          <h3>New map</h3>
          <form onSubmit={createMap} className="stack">
            <label>Name<input name="name" required placeholder="World Map" /></label>
            <label>Image<select name="image" required defaultValue="">
              <option value="" disabled>Choose an uploaded image…</option>
              {images.map((img) => <option key={img} value={img}>{img}</option>)}
            </select></label>
            <button>Create map</button>
          </form>
          {!images.length && <p className="muted">Upload a map image in Media first.</p>}
        </div>

        {map && (
          <>
            <div className="field-group">
              <h3>Layers</h3>
              {layers.map((layer) => (
                <div key={layer.id} className="map-layer-row">
                  <button type="button" className="map-layer-eye" title={hiddenLayers.has(layer.id) ? "Show" : "Hide"} onClick={() => toggleLayerHidden(layer.id)}>
                    {hiddenLayers.has(layer.id) ? "○" : "●"}
                  </button>
                  <span
                    className={`map-layer-name${activeLayer === layer.id ? " active" : ""}`}
                    onClick={() => setActiveLayer(layer.id)}
                    style={{ cursor: "pointer" }}
                  >
                    {layer.name}
                  </span>
                  <select
                    value={layer.visibility}
                    onChange={(e) => toggleLayerVisibility(layer.id, e.target.value as "gm" | "players")}
                    className="map-layer-vis"
                    title="Who can see this layer"
                  >
                    <option value="gm">GM only</option>
                    <option value="players">Players</option>
                  </select>
                </div>
              ))}
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input
                  placeholder="New layer name…"
                  value={newLayerName}
                  onChange={(e) => setNewLayerName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLayer(); } }}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={addLayer} disabled={!newLayerName.trim()} style={{ whiteSpace: "nowrap" }}>+ Layer</button>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Click a layer name to make it active. New pins go on the active layer.
              </p>
            </div>

            <div className="field-group">
              <h3>Scale</h3>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>Full width =</span>
                <input
                  type="number"
                  min={1}
                  placeholder="500"
                  value={map.scale?.total ?? ""}
                  onChange={(e) => patchMap(map.slug, { scale: e.target.value ? { total: Number(e.target.value), unit: map.scale?.unit || "miles" } : undefined })}
                  style={{ width: 70 }}
                />
                <input
                  placeholder="miles"
                  value={map.scale?.unit ?? ""}
                  onChange={(e) => patchMap(map.slug, { scale: map.scale ? { ...map.scale, unit: e.target.value } : undefined })}
                  style={{ width: 60 }}
                />
              </div>
              <p className="muted" style={{ fontSize: 12 }}>Set for the measure tool.</p>
            </div>
          </>
        )}
      </aside>

      <div className="panel maps-main">
        {map ? (
          <>
            <div className="maps-toolbar">
              <strong>{map.name}</strong>
              <div className="topbar-actions">
                <button
                  type="button"
                  className={addMode === "pin" ? "active" : "secondary"}
                  onClick={() => { setAddMode((v) => v === "pin" ? null : "pin"); setEditingPin(null); setEditingRegion(null); setRouteFrom(null); setMeasurePts([]); setMeasureResult(null); }}
                >
                  {addMode === "pin" ? `Click map to place pin…` : "Add pin"}
                </button>
                <button
                  type="button"
                  className={addMode === "region" ? "active" : "secondary"}
                  onClick={() => { setAddMode((v) => v === "region" ? null : "region"); setEditingPin(null); setEditingRegion(null); setRouteFrom(null); setMeasurePts([]); setMeasureResult(null); }}
                >
                  {addMode === "region" ? "Click map to place region..." : "Add region"}
                </button>
                <button
                  type="button"
                  className={addMode === "route" ? "active" : "secondary"}
                  onClick={() => { setAddMode((v) => v === "route" ? null : "route"); setEditingPin(null); setEditingRegion(null); setRouteFrom(null); setMeasurePts([]); setMeasureResult(null); }}
                >
                  {addMode === "route" ? (routeFrom !== null ? "Click second pin…" : "Click first pin…") : "Add route"}
                </button>
                <button
                  type="button"
                  className={addMode === "measure" ? "active" : "secondary"}
                  onClick={() => { setAddMode((v) => v === "measure" ? null : "measure"); setMeasurePts([]); setMeasureResult(null); setEditingPin(null); setEditingRegion(null); setRouteFrom(null); }}
                >
                  {addMode === "measure" ? (measurePts.length === 0 ? "Click start…" : measurePts.length === 1 ? "Click end…" : "Click to clear") : "Measure"}
                </button>
                <button
                  type="button"
                  className={playerView ? "active" : "secondary"}
                  title={playerView ? "Showing only discovered pins (what players see)" : "Preview the map as players see it — undiscovered pins are hidden"}
                  onClick={() => { setPlayerView((v) => !v); setEditingPin(null); setAddMode(null); }}
                >
                  {playerView ? `Player view (${undiscoveredCount} hidden)` : "Player view"}
                </button>
                <button type="button" onClick={saveMap}>Save</button>
                <button type="button" className="danger" onClick={deleteMap}>Delete map</button>
              </div>
            </div>
            {playerView && (
              <div style={{ padding: "6px 12px", background: "rgba(74,144,217,0.12)", borderBottom: "1px solid var(--border-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                <strong style={{ color: "#4a90d9" }}>👁 Player view</strong>
                <span className="muted">{undiscoveredCount} undiscovered pin{undiscoveredCount === 1 ? "" : "s"} hidden. Editing is disabled — toggle off to make changes.</span>
              </div>
            )}

            {measureResult && (
              <div style={{ padding: "6px 12px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-soft)", fontSize: 13 }}>
                Distance: <strong>{measureResult}</strong>
                <button type="button" className="linklike" style={{ marginLeft: 12, fontSize: 12 }} onClick={() => { setMeasurePts([]); setMeasureResult(null); setAddMode(null); }}>Clear</button>
              </div>
            )}
            {activeJourneyId && (() => {
              const journey = (map.journeys || []).find((j) => j.id === activeJourneyId);
              if (!journey) return null;
              const currentPin = journey.steps[journeyStep] != null ? map.pins[journey.steps[journeyStep]] : null;
              return (
                <div style={{ padding: "6px 12px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                  <strong style={{ color: "#4a90d9" }}>Journey: {journey.name}</strong>
                  <span className="muted">Stop {journeyStep + 1}/{journey.steps.length}{currentPin ? ` — ${currentPin.label}` : ""}</span>
                  <button type="button" className="secondary" style={{ minHeight: 26, padding: "0 8px", fontSize: 12 }} disabled={journeyStep === 0} onClick={() => setJourneyStep((s) => s - 1)}>← Back</button>
                  <button type="button" className="secondary" style={{ minHeight: 26, padding: "0 8px", fontSize: 12 }} disabled={journeyStep >= journey.steps.length - 1} onClick={() => setJourneyStep((s) => s + 1)}>Next →</button>
                  <button type="button" className="linklike" style={{ fontSize: 12, marginLeft: "auto" }} onClick={() => { setActiveJourneyId(null); setJourneyStep(0); }}>End journey</button>
                </div>
              );
            })()}
            {journeyAddMode && editingJourneyId && (() => {
              const journey = (map.journeys || []).find((j) => j.id === editingJourneyId);
              if (!journey) return null;
              return (
                <div style={{ padding: "6px 12px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-soft)", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                  <strong style={{ color: "var(--gold)" }}>Adding stops to: {journey.name}</strong>
                  <span className="muted">{journey.steps.length} stop{journey.steps.length !== 1 ? "s" : ""} — click pins on map to add</span>
                  <button type="button" className="secondary" style={{ minHeight: 26, padding: "0 8px", fontSize: 12 }} disabled={!journey.steps.length} onClick={journeyRemoveLastPin}>Undo last</button>
                  <button type="button" className="linklike" style={{ fontSize: 12, marginLeft: "auto" }} onClick={() => setJourneyAddMode(false)}>Done</button>
                </div>
              );
            })()}

            <div className={`map-canvas${addMode ? " placing" : ""}${journeyAddMode ? " placing" : ""}`} onClick={handleCanvasClick}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/campaign-media/${campaign.id}/${encodeURIComponent(map.image)}`}
                alt={map.name}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth && img.naturalHeight) setImageAspect(img.naturalWidth / img.naturalHeight);
                }}
              />

              {/* SVG overlay for routes, regions, and measure */}
              <svg className="map-overlay-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                {(map.regions || []).filter((r) => !hiddenLayers.has(r.layer || "default")).map((region, i) => (
                  <g key={i}>
                    <rect
                      x={region.x * 100} y={region.y * 100}
                      width={region.w * 100} height={region.h * 100}
                      fill={region.color || "#4a90d9"} fillOpacity="0.18"
                      stroke={region.color || "#4a90d9"} strokeWidth="0.4" strokeOpacity="0.6"
                      onClick={(event) => { event.stopPropagation(); setEditingRegion(i); setEditingPin(null); setEditingRoute(null); }}
                      style={{ cursor: "pointer" }}
                    />
                    {region.label && (
                      <text x={(region.x + region.w / 2) * 100} y={(region.y + region.h / 2) * 100}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="2.5" fill={region.color || "#4a90d9"} fillOpacity="0.9" fontWeight="600">
                        {region.label}
                      </text>
                    )}
                  </g>
                ))}
                {(map.routes || []).filter((r) => !hiddenLayers.has(r.layer || "default")).map((route, i) => {
                  const from = map.pins[route.fromIndex];
                  const to = map.pins[route.toIndex];
                  if (!from || !to) return null;
                  const strokeStyle = route.style === "river" ? { stroke: "#4a90d9", strokeDasharray: "none" } :
                                      route.style === "path" ? { stroke: "#c8a96e", strokeDasharray: "1.5,1" } :
                                      route.style === "wall" ? { stroke: "#888", strokeDasharray: "0.8,0.4" } :
                                      { stroke: "#c8a96e", strokeDasharray: "none" };
                  const mx = (from.x + to.x) / 2 * 100;
                  const my = (from.y + to.y) / 2 * 100;
                  return (
                    <g key={i} style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setEditingRoute(editingRoute === i ? null : i); }}>
                      <line x1={from.x * 100} y1={from.y * 100} x2={to.x * 100} y2={to.y * 100}
                        strokeWidth="0.8" strokeLinecap="round" {...strokeStyle} />
                      {route.label && (
                        <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle"
                          fontSize="2" fill="#c8a96e" stroke="var(--bg-primary)" strokeWidth="0.5" paintOrder="stroke">
                          {route.label}
                        </text>
                      )}
                    </g>
                  );
                })}
                {/* Measure line */}
                {measurePts.length === 2 && (
                  <g>
                    <line
                      x1={measurePts[0].x * 100} y1={measurePts[0].y * 100}
                      x2={measurePts[1].x * 100} y2={measurePts[1].y * 100}
                      stroke="var(--gold)" strokeWidth="0.7" strokeDasharray="2,1" strokeLinecap="round"
                    />
                    <circle cx={measurePts[0].x * 100} cy={measurePts[0].y * 100} r="1" fill="var(--gold)" />
                    <circle cx={measurePts[1].x * 100} cy={measurePts[1].y * 100} r="1" fill="var(--gold)" />
                  </g>
                )}
                {measurePts.length === 1 && (
                  <circle cx={measurePts[0].x * 100} cy={measurePts[0].y * 100} r="1" fill="var(--gold)" />
                )}
                {/* Journey path overlay */}
                {activeJourneyId && (() => {
                  const journey = (map.journeys || []).find((j) => j.id === activeJourneyId);
                  if (!journey || !journey.steps.length) return null;
                  const visitedSteps = journey.steps.slice(0, journeyStep + 1);
                  const pathParts: string[] = [];
                  for (let i = 0; i < visitedSteps.length - 1; i++) {
                    const from = map.pins[visitedSteps[i]];
                    const to = map.pins[visitedSteps[i + 1]];
                    if (from && to) pathParts.push(`M ${from.x * 100} ${from.y * 100} L ${to.x * 100} ${to.y * 100}`);
                  }
                  const currentPin = map.pins[journey.steps[journeyStep]];
                  return (
                    <>
                      {pathParts.length > 0 && (
                        <path d={pathParts.join(" ")} fill="none" stroke="#4a90d9" strokeWidth="1.2" strokeDasharray="2,1" strokeLinecap="round" opacity="0.7" />
                      )}
                      {currentPin && (
                        <circle cx={currentPin.x * 100} cy={currentPin.y * 100} r="3" fill="none" stroke="#4a90d9" strokeWidth="1" opacity="0.9">
                          <animate attributeName="r" values="2.5;4;2.5" dur="1.8s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.8s" repeatCount="indefinite" />
                        </circle>
                      )}
                    </>
                  );
                })()}
              </svg>

              {(() => {
                const activeJourney = activeJourneyId ? (map.journeys || []).find((j) => j.id === activeJourneyId) : null;
                const currentPinIndex = activeJourney ? activeJourney.steps[journeyStep] : null;
                const visitedPins = activeJourney ? new Set(activeJourney.steps.slice(0, journeyStep + 1)) : null;
                return visiblePins.map((pin) => {
                  const pinIndex = map.pins.indexOf(pin);
                  const isRouteFrom = routeFrom === pinIndex;
                  const imgSrc = pin.image ? `/campaign-media/${campaign.id}/${encodeURIComponent(pin.image)}` : null;
                  const isJourneyCurrent = currentPinIndex === pinIndex;
                  const isJourneyVisited = visitedPins?.has(pinIndex) && !isJourneyCurrent;
                  const isUndiscovered = !pin.discovered && !playerView;
                  return (
                    <button
                      type="button"
                      key={pinIndex}
                      className={`map-pin${pin.pageSlug || pin.mapSlug ? "" : " unlinked"}${editingPin === pinIndex ? " editing" : ""}${isRouteFrom ? " route-from" : ""}${imgSrc ? " map-pin-image" : ""}${isJourneyCurrent ? " journey-current" : ""}${isJourneyVisited ? " journey-visited" : ""}${isUndiscovered ? " map-pin-undiscovered" : ""}`}
                      style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                      title={pin.label}
                      onClick={(e) => {
                        if (playerView) {
                          e.stopPropagation();
                          if (pin.pageSlug) router.push(`/campaigns/${campaign.id}/pages/${pin.pageSlug}`);
                          else if (pin.mapSlug) setSelected(pin.mapSlug);
                          return;
                        }
                        if (addMode === "route") { handlePinClickInRouteMode(pinIndex, e); return; }
                        if (journeyAddMode) { e.stopPropagation(); journeyAddPin(pinIndex); return; }
                        e.stopPropagation();
                        if (addMode) return;
                        if (activeJourneyId) return;
                        if (editingPin === pinIndex) { setEditingPin(null); return; }
                        setEditingPin(pinIndex);
                        setEditingRoute(null);
                      }}
                    >
                      {imgSrc ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={imgSrc} alt={pin.label} className="map-pin-portrait" />
                      ) : (
                        <span className="map-pin-icon">{pin.icon || "📍"}</span>
                      )}
                      <span className="map-pin-label">{pin.label}</span>
                    </button>
                  );
                });
              })()}
            </div>

            {(editingRegion !== null || (map.regions || []).length > 0) && (
              <div className="field-group">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3>Regions {(map.regions || []).length > 0 && `(${(map.regions || []).length})`}</h3>
                  {editingRegion !== null && <button type="button" className="linklike" onClick={() => setEditingRegion(null)}>Close editor</button>}
                </div>

                {editingRegion !== null && (() => {
                  const region = (map.regions || [])[editingRegion];
                  if (!region) return null;
                  const pct = (value: number) => Math.round(value * 100);
                  return (
                    <div className="map-pin-editor">
                      <label>Label<input value={region.label || ""} onChange={(e) => updateRegion(editingRegion, { label: e.target.value })} /></label>
                      <label>Color<input type="color" value={region.color || "#4a90d9"} onChange={(e) => updateRegion(editingRegion, { color: e.target.value })} /></label>
                      <label>Layer
                        <select value={region.layer || "default"} onChange={(e) => updateRegion(editingRegion, { layer: e.target.value })}>
                          {layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </label>
                      <label>Width %
                        <input type="number" min={1} max={100} value={pct(region.w)} onChange={(e) => updateRegion(editingRegion, { w: Math.max(0.01, Math.min(1, Number(e.target.value) / 100 || region.w)) })} />
                      </label>
                      <label>Height %
                        <input type="number" min={1} max={100} value={pct(region.h)} onChange={(e) => updateRegion(editingRegion, { h: Math.max(0.01, Math.min(1, Number(e.target.value) / 100 || region.h)) })} />
                      </label>
                      <button type="button" className="danger" onClick={() => deleteRegion(editingRegion)}>Delete region</button>
                    </div>
                  );
                })()}

                <div className="map-pin-list">
                  {(map.regions || []).map((region, index) => (
                    <div key={index} className="map-pin-list-row" onClick={() => { setEditingRegion(index); setEditingPin(null); setEditingRoute(null); }}>
                      <span style={{ color: region.color || "#4a90d9" }}>■</span>
                      <span>{region.label || "Unnamed region"}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{layers.find((l) => l.id === (region.layer || "default"))?.name || region.layer}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editingRoute !== null && (() => {
              const route = (map.routes || [])[editingRoute];
              if (!route) return null;
              const fromPin = map.pins[route.fromIndex];
              const toPin = map.pins[route.toIndex];
              return (
                <div className="field-group">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3>Route: {fromPin?.label || `Pin ${route.fromIndex}`} → {toPin?.label || `Pin ${route.toIndex}`}</h3>
                    <button type="button" className="linklike" onClick={() => setEditingRoute(null)}>Close</button>
                  </div>
                  <div className="map-pin-editor">
                    <label>Label<input value={route.label || ""} onChange={(e) => updateRoute(editingRoute, { label: e.target.value })} placeholder="(optional)" /></label>
                    <label>Style
                      <select value={route.style || "road"} onChange={(e) => updateRoute(editingRoute, { style: e.target.value as Route["style"] })}>
                        <option value="road">Road</option>
                        <option value="path">Path / trail</option>
                        <option value="river">River / water</option>
                        <option value="wall">Wall / border</option>
                      </select>
                    </label>
                    <label>Layer
                      <select value={route.layer || "default"} onChange={(e) => updateRoute(editingRoute, { layer: e.target.value })}>
                        {layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </label>
                    <button type="button" className="danger" onClick={() => deleteRoute(editingRoute)}>Delete route</button>
                  </div>
                </div>
              );
            })()}

            <div className="field-group">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3>Pins {map.pins.length > 0 && `(${map.pins.length})`}</h3>
                {editingPin !== null && <button type="button" className="linklike" onClick={() => setEditingPin(null)}>Close editor</button>}
              </div>

              {editingPin !== null && (() => {
                const pin = map.pins[editingPin];
                if (!pin) return null;
                return (
                  <div className="map-pin-editor">
                    <label>Label<input value={pin.label} onChange={(e) => updatePin(editingPin, { label: e.target.value })} placeholder="Label" /></label>
                    <label>Icon
                      <div className="map-icon-grid">
                        {PIN_ICONS.map((icon) => (
                          <button key={icon} type="button" className={`map-icon-btn${pin.icon === icon && !pin.image ? " active" : ""}`} onClick={() => updatePin(editingPin, { icon, image: undefined })}>
                            {icon}
                          </button>
                        ))}
                      </div>
                    </label>
                    <label>Portrait image
                      <select value={pin.image || ""} onChange={(e) => updatePin(editingPin, { image: e.target.value || undefined })}>
                        <option value="">— use icon above —</option>
                        {images.map((img) => <option key={img} value={img}>{img}</option>)}
                      </select>
                    </label>
                    <label>Layer
                      <select value={pin.layer || "default"} onChange={(e) => updatePin(editingPin, { layer: e.target.value })}>
                        {layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </label>
                    <label>Link to page
                      <select value={pin.pageSlug || ""} onChange={(e) => updatePin(editingPin, { pageSlug: e.target.value || undefined, mapSlug: undefined })}>
                        <option value="">— no page link —</option>
                        {pages.map((p) => <option key={p.slug} value={p.slug}>{p.frontmatter.name}</option>)}
                      </select>
                    </label>
                    <label>Link to map
                      <select value={pin.mapSlug || ""} onChange={(e) => updatePin(editingPin, { mapSlug: e.target.value || undefined, pageSlug: undefined })}>
                        <option value="">— no map link —</option>
                        {maps.filter((m) => m.slug !== map.slug).map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
                      </select>
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={Boolean(pin.discovered)} onChange={(e) => updatePin(editingPin, { discovered: e.target.checked })} />
                      Discovered by players
                    </label>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      {pin.pageSlug && <button type="button" className="secondary" onClick={() => router.push(`/campaigns/${campaign.id}/pages/${pin.pageSlug}`)}>Open page →</button>}
                      {pin.mapSlug && <button type="button" className="secondary" onClick={() => { setSelected(pin.mapSlug!); setEditingPin(null); }}>Open map →</button>}
                      <button type="button" className="danger" onClick={() => { patchMap(map.slug, { pins: map.pins.filter((_, i) => i !== editingPin) }); setEditingPin(null); }}>Delete pin</button>
                    </div>
                  </div>
                );
              })()}

              {editingPin === null && (
                <div className="map-pin-list">
                  {map.pins.map((pin, index) => (
                    <div key={index} className="map-pin-list-row" onClick={() => setEditingPin(index)}>
                      <span>{pin.image ? "🖼" : (pin.icon || "📍")}</span>
                      <span>{pin.label || "Unnamed"}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{layers.find((l) => l.id === (pin.layer || "default"))?.name || pin.layer}</span>
                      {pin.pageSlug && <span className="tag-chip" style={{ fontSize: 11 }}>page</span>}
                      {pin.mapSlug && <span className="tag-chip" style={{ fontSize: 11 }}>map</span>}
                    </div>
                  ))}
                  {!map.pins.length && <p className="muted">Click <strong>Add pin</strong>, then click the map. Remember to Save.</p>}
                </div>
              )}
            </div>

            {(map.routes || []).length > 0 && (
              <div className="field-group">
                <h3>Routes ({(map.routes || []).length})</h3>
                <div className="map-pin-list">
                  {(map.routes || []).map((route, i) => {
                    const fromPin = map.pins[route.fromIndex];
                    const toPin = map.pins[route.toIndex];
                    return (
                      <div key={i} className="map-pin-list-row" onClick={() => { setEditingRoute(i); setEditingPin(null); }}>
                        <span className="muted" style={{ fontSize: 12 }}>{route.style || "road"}</span>
                        <span>{fromPin?.label || `Pin ${route.fromIndex}`} → {toPin?.label || `Pin ${route.toIndex}`}</span>
                        {route.label && <span className="muted" style={{ fontSize: 11 }}>{route.label}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="field-group">
              <h3>Journeys</h3>
              <div className="map-pin-list">
                {(map.journeys || []).map((journey) => (
                  <div key={journey.id} className="map-pin-list-row">
                    <span>{journey.steps.length} stop{journey.steps.length !== 1 ? "s" : ""}</span>
                    <span style={{ flex: 1 }}>{journey.name}</span>
                    <button type="button" className="secondary" style={{ minHeight: 24, padding: "0 6px", fontSize: 11 }} onClick={() => { setEditingJourneyId(journey.id); setJourneyAddMode(true); setActiveJourneyId(null); setAddMode(null); }}>Edit</button>
                    <button type="button" className="secondary" style={{ minHeight: 24, padding: "0 6px", fontSize: 11 }} disabled={!journey.steps.length} onClick={() => startPlayback(journey.id)}>▶ Play</button>
                    <button type="button" className="danger" style={{ minHeight: 24, padding: "0 6px", fontSize: 11 }} onClick={() => deleteJourney(journey.id)}>✕</button>
                  </div>
                ))}
                {!(map.journeys || []).length && <p className="muted" style={{ fontSize: 12 }}>No journeys yet. Create one to track the party&apos;s route.</p>}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input
                  placeholder="Journey name…"
                  value={newJourneyName}
                  onChange={(e) => setNewJourneyName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createJourney(); } }}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={createJourney} disabled={!newJourneyName.trim()} style={{ whiteSpace: "nowrap" }}>+ Journey</button>
              </div>
            </div>
          </>
        ) : (
          <p className="muted">Select or create a map.</p>
        )}
        {message && <p className="toast">{message}</p>}
      </div>
    </section>
  );
}

"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignMedia, WikiPage } from "@/lib/types";

type Layer = { id: string; name: string; visibility: "gm" | "players" };
type Pin = { x: number; y: number; label: string; pageSlug?: string; mapSlug?: string; layer?: string; icon?: string; discovered?: boolean; image?: string };
type Region = { x: number; y: number; w: number; h: number; label: string; layer?: string; color?: string };
type Route = { fromIndex: number; toIndex: number; label?: string; style?: "road" | "river" | "path" | "wall"; layer?: string };
type CampaignMap = { slug: string; name: string; image: string; pins: Pin[]; layers?: Layer[]; regions?: Region[]; routes?: Route[]; scale?: { total: number; unit: string }; sha?: string };

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
  const [routeFrom, setRouteFrom] = useState<number | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [newLayerName, setNewLayerName] = useState("");
  const [activeLayer, setActiveLayer] = useState<string>("default");
  const [measurePts, setMeasurePts] = useState<Array<{ x: number; y: number }>>([]);
  const [measureResult, setMeasureResult] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState(1);

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

  const visiblePins = map ? map.pins.filter((p) => !hiddenLayers.has(p.layer || "default")) : [];

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
                  onClick={() => { setAddMode((v) => v === "pin" ? null : "pin"); setEditingPin(null); setRouteFrom(null); setMeasurePts([]); setMeasureResult(null); }}
                >
                  {addMode === "pin" ? `Click map to place pin…` : "Add pin"}
                </button>
                <button
                  type="button"
                  className={addMode === "route" ? "active" : "secondary"}
                  onClick={() => { setAddMode((v) => v === "route" ? null : "route"); setEditingPin(null); setRouteFrom(null); setMeasurePts([]); setMeasureResult(null); }}
                >
                  {addMode === "route" ? (routeFrom !== null ? "Click second pin…" : "Click first pin…") : "Add route"}
                </button>
                <button
                  type="button"
                  className={addMode === "measure" ? "active" : "secondary"}
                  onClick={() => { setAddMode((v) => v === "measure" ? null : "measure"); setMeasurePts([]); setMeasureResult(null); setEditingPin(null); setRouteFrom(null); }}
                >
                  {addMode === "measure" ? (measurePts.length === 0 ? "Click start…" : measurePts.length === 1 ? "Click end…" : "Click to clear") : "Measure"}
                </button>
                <button type="button" onClick={saveMap}>Save</button>
                <button type="button" className="danger" onClick={deleteMap}>Delete map</button>
              </div>
            </div>

            {measureResult && (
              <div style={{ padding: "6px 12px", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-soft)", fontSize: 13 }}>
                Distance: <strong>{measureResult}</strong>
                <button type="button" className="linklike" style={{ marginLeft: 12, fontSize: 12 }} onClick={() => { setMeasurePts([]); setMeasureResult(null); setAddMode(null); }}>Clear</button>
              </div>
            )}

            <div className={addMode ? "map-canvas placing" : "map-canvas"} onClick={handleCanvasClick}>
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
              </svg>

              {visiblePins.map((pin, index) => {
                const pinIndex = map.pins.indexOf(pin);
                const isRouteFrom = routeFrom === pinIndex;
                const imgSrc = pin.image ? `/campaign-media/${campaign.id}/${encodeURIComponent(pin.image)}` : null;
                return (
                  <button
                    type="button"
                    key={pinIndex}
                    className={`map-pin${pin.pageSlug || pin.mapSlug ? "" : " unlinked"}${editingPin === pinIndex ? " editing" : ""}${isRouteFrom ? " route-from" : ""}${imgSrc ? " map-pin-image" : ""}`}
                    style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                    title={pin.label}
                    onClick={(e) => {
                      if (addMode === "route") { handlePinClickInRouteMode(pinIndex, e); return; }
                      e.stopPropagation();
                      if (addMode) return;
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
              })}
            </div>

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
          </>
        ) : (
          <p className="muted">Select or create a map.</p>
        )}
        {message && <p className="toast">{message}</p>}
      </div>
    </section>
  );
}

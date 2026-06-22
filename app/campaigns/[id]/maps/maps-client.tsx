"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign, CampaignMedia, WikiPage } from "@/lib/types";

type Pin = { x: number; y: number; pageSlug: string; label: string };
type CampaignMap = { slug: string; name: string; image: string; pins: Pin[]; sha?: string };

export default function MapsClient({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [maps, setMaps] = useState<CampaignMap[]>([]);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [addMode, setAddMode] = useState(false);
  const [message, setMessage] = useState("");

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

  function patchMap(slug: string, pins: Pin[]) {
    setMaps((ms) => ms.map((m) => (m.slug === slug ? { ...m, pins } : m)));
  }

  async function createMap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const image = String(data.get("image") || "");
    if (!name || !image) return setMessage("Pick a name and an image.");
    const res = await fetch(`/api/campaigns/${campaign.id}/maps`, { method: "PUT", body: JSON.stringify({ name, image, pins: [] }) });
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
    const res = await fetch(`/api/campaigns/${campaign.id}/maps`, { method: "PUT", body: JSON.stringify({ slug: map.slug, name: map.name, image: map.image, pins: map.pins }) });
    const body = await res.json();
    if (res.ok) setMaps(body.maps || []);
    setMessage(res.ok ? "Map saved." : body.error || "Save failed.");
  }

  async function deleteMap() {
    if (!map || !confirm(`Delete map "${map.name}"? Pins are removed; the image stays in media.`)) return;
    const res = await fetch(`/api/campaigns/${campaign.id}/maps`, { method: "DELETE", body: JSON.stringify({ slug: map.slug }) });
    const body = await res.json();
    if (res.ok) {
      setMaps(body.maps || []);
      setSelected((body.maps || [])[0]?.slug || "");
    }
  }

  function placePin(event: MouseEvent<HTMLDivElement>) {
    if (!map || !addMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    patchMap(map.slug, [...map.pins, { x, y, pageSlug: "", label: "New pin" }]);
    setAddMode(false);
  }

  return (
    <section className="maps-grid">
      <aside className="panel">
        <h2>Maps</h2>
        <div className="results">
          {maps.map((m) => (
            <button type="button" key={m.slug} className={m.slug === selected ? "nav-link active" : "nav-link"} onClick={() => { setSelected(m.slug); setAddMode(false); }}>
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
          {!images.length && <p className="muted">Upload a map image in the campaign Media manager first.</p>}
        </div>
      </aside>

      <div className="panel">
        {map ? (
          <>
            <div className="maps-toolbar">
              <strong>{map.name}</strong>
              <div className="topbar-actions">
                <button type="button" className={addMode ? "active" : "secondary"} onClick={() => setAddMode((v) => !v)}>{addMode ? "Click map to place…" : "Add pin"}</button>
                <button type="button" onClick={saveMap}>Save</button>
                <button type="button" className="danger" onClick={deleteMap}>Delete map</button>
              </div>
            </div>
            <div className={addMode ? "map-canvas placing" : "map-canvas"} onClick={placePin}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/campaign-media/${campaign.id}/${encodeURIComponent(map.image)}`} alt={map.name} />
              {map.pins.map((pin, index) => (
                <button
                  type="button"
                  key={index}
                  className={`map-pin${pin.pageSlug ? "" : " unlinked"}`}
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                  title={pin.label}
                  onClick={(e) => { e.stopPropagation(); if (!addMode && pin.pageSlug) router.push(`/campaigns/${campaign.id}/pages/${pin.pageSlug}`); }}
                >
                  <span className="map-pin-label">{pin.label}</span>
                </button>
              ))}
            </div>

            <div className="field-group">
              <h3>Pins</h3>
              {map.pins.map((pin, index) => (
                <div className="map-pin-row" key={index}>
                  <input value={pin.label} onChange={(e) => patchMap(map.slug, map.pins.map((p, i) => (i === index ? { ...p, label: e.target.value } : p)))} placeholder="Label" />
                  <select value={pin.pageSlug} onChange={(e) => patchMap(map.slug, map.pins.map((p, i) => (i === index ? { ...p, pageSlug: e.target.value } : p)))}>
                    <option value="">— link a page —</option>
                    {pages.map((p) => <option key={p.slug} value={p.slug}>{p.frontmatter.name}</option>)}
                  </select>
                  <button type="button" className="danger" onClick={() => patchMap(map.slug, map.pins.filter((_, i) => i !== index))}>✕</button>
                </div>
              ))}
              {!map.pins.length && <p className="muted">Click <strong>Add pin</strong>, then click the map to drop a pin and link it to a page. Remember to Save.</p>}
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

/**
 * Full-screen MapLibre map of SF. Zones are colored by whatever map layer is picked (see
 * layers.ts): nothing, the fit score, or the density of one kind of place. Hover shows the
 * zone's name and the layer's value (so nothing depends on color alone); click selects.
 */
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre works out its worker's address at runtime, which bundlers can't follow, so the
// worker is shipped as its own file and its URL passed in. Without this the map is blank.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

maplibregl.setWorkerUrl(workerUrl);
import { LEVEL_NAMES, type Level, type World } from "./sim";
import type { ZonePaint } from "./layers";
import type { Pop, PopKind } from "./pops";

const POP_EMOJI: Record<PopKind, string> = { lead: "🙂", order: "🛍️", first: "🎉", added: "✓" };
const POP_LABEL: Record<PopKind, string> = { lead: "Someone noticed you", order: "Order", first: "First sale", added: "Added to your plan" };
/** How long a bubble stays on screen; matches the longest animation in styles.css. */
const POP_MS = 2200;

/**
 * Put one bubble over a zone. A MapLibre marker keeps it pinned to the zone while the map
 * pans and zooms; the inner element does the animation (the marker owns the outer transform).
 */
function spawnPop(m: maplibregl.Map, at: [number, number], pop: Pop) {
  if (document.hidden) return;
  const el = document.createElement("div");
  el.className = `pop pop-${pop.kind}`;
  el.setAttribute("aria-hidden", "true");
  const inner = document.createElement("div");
  inner.className = "pop-inner";
  inner.title = POP_LABEL[pop.kind];
  const emoji = document.createElement("span");
  emoji.className = "pop-emoji";
  emoji.textContent = POP_EMOJI[pop.kind];
  inner.append(emoji);
  if (pop.text) {
    const t = document.createElement("span");
    t.className = "pop-text";
    t.textContent = pop.text;
    inner.append(t);
  }
  el.append(inner);
  if (pop.kind === "order" || pop.kind === "first") {
    const ring = document.createElement("div");
    ring.className = "pop-ring";
    el.append(ring);
  }
  if (pop.kind === "first") {
    const colors = ["#2a78d6", "#1a7f45", "#e5612c", "#f2b705", "#b3261e", "#7b4fd6"];
    for (let k = 0; k < 18; k++) {
      const c = document.createElement("span");
      c.className = "confetti";
      const angle = (Math.PI * 2 * k) / 18 + Math.random() * 0.3;
      const dist = 50 + Math.random() * 40;
      c.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      c.style.setProperty("--dy", `${Math.sin(angle) * dist - 30}px`);
      c.style.setProperty("--rot", `${Math.round(Math.random() * 720 - 360)}deg`);
      c.style.background = colors[k % colors.length];
      el.append(c);
    }
  }
  // Spread bubbles around the zone's center so a busy zone doesn't stack them.
  const spread = pop.kind === "first" || pop.kind === "added" ? 0 : 40;
  const offset: [number, number] = [(Math.random() - 0.5) * 2 * spread, -Math.random() * spread * 0.6];
  const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset }).setLngLat(at).addTo(m);
  window.setTimeout(() => marker.remove(), pop.kind === "first" ? POP_MS + 800 : POP_MS);
}

const SF_BOUNDS: [number, number, number, number] = [-122.52, 37.7, -122.35, 37.835];
const BASEMAP = "https://tiles.openfreemap.org/styles/positron";
/** Matches the phone breakpoint in styles.css, where the neighborhood card becomes a bottom sheet. */
const PHONE_WIDTH = 720;
const PHONE_PANEL_SHARE = 0.55;

/**
 * Positron is all greys, so the uncolored map read as blank. Give water, parks and land
 * soft natural tints. They stay pale and low-chroma so the data layers (orange places,
 * blue fit score) are still the loudest thing on screen; water sits outside every zone,
 * so its blue never reads as a fit score.
 */
const BASEMAP_TINTS: [layer: string, prop: string, color: string][] = [
  ["background", "background-color", "#f4f1ea"],
  ["landuse_residential", "fill-color", "#eeeae1"],
  ["building", "fill-color", "#e6e1d6"],
  ["building", "fill-outline-color", "#d9d3c6"],
  ["park", "fill-color", "#d7e6cc"],
  ["landcover_wood", "fill-color", "#c9ddbd"],
  ["water", "fill-color", "#a9cde3"],
  ["waterway", "line-color", "#a9cde3"],
  ["road_area_pier", "fill-color", "#f4f1ea"],
  ["road_pier", "line-color", "#f4f1ea"],
];

function tintBasemap(m: maplibregl.Map) {
  for (const [layer, prop, color] of BASEMAP_TINTS)
    if (m.getLayer(layer)) m.setPaintProperty(layer, prop as "fill-color", color);
}

interface Props {
  geojson: GeoJSON.FeatureCollection;
  world: World;
  selected: number | null;
  onSelect: (zone: number | null) => void;
  /** Current ad level per zone; zones with ads get an outline and an L/M/H badge. */
  levels?: Level[];
  /** Fill per zone index, from the current map layer. */
  paint: ZonePaint[];
  /** Tooltip line per zone index (null: name only). */
  describe: (zone: number) => string | null;
  /** On phones the neighborhood card covers the lower part of the screen. */
  zoneCardOpen?: boolean;
  /** Bubbles to show over zones (leads, orders...). New ids are shown once each. */
  pops?: Pop[];
}

interface Hover {
  x: number;
  y: number;
  zone: number;
}

export function MapView({ geojson, world, selected, onSelect, levels, zoneCardOpen, paint, describe, pops }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const worldRef = useRef(world);
  worldRef.current = world;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    const m = new maplibregl.Map({
      container: container.current!,
      style: BASEMAP,
      bounds: SF_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: "Neighborhood data © Overture Maps Foundation",
      }),
    );
    // No zoom buttons: scroll, pinch and double-click zoom, and the screen stays clear.
    map.current = m;

    m.on("load", () => {
      // On phones the expanded credits sit under the map button; start them collapsed
      // behind the (i) button. The Overture credit is also in the neighborhood card.
      if (window.innerWidth <= PHONE_WIDTH)
        container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      tintBasemap(m);
      m.addSource("zones", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" });
      // Put the zones under the basemap's labels so street and place names stay readable.
      const firstLabel = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
      m.addLayer(
        {
          id: "zones-fill",
          type: "fill",
          source: "zones",
          paint: {
            "fill-color": ["get", "fill"],
            // Opaque enough that the colors match the legend; hover changes the outline,
            // never the color (a darker fill would read as a better score).
            // Zones with no layer color stay at opacity 0: still hoverable and clickable.
            "fill-opacity": ["get", "fillOpacity"],
          },
        },
        firstLabel,
      );
      m.addLayer(
        {
          id: "zones-line",
          type: "line",
          source: "zones",
          // White between colored zones; a faint gray outline when the map is uncolored so
          // the neighborhoods are still visible.
          paint: {
            "line-color": ["case", [">", ["get", "fillOpacity"], 0.5], "#fcfcfb", "#8f8e89"],
            "line-width": 1,
            "line-opacity": ["case", [">", ["get", "fillOpacity"], 0.5], 0.9, 0.35],
          },
        },
        firstLabel,
      );
      // Zones with ads: a soft blue tint and a solid blue outline, so your plan stands out
      // on any map coloring.
      m.addLayer(
        {
          id: "zones-active-fill",
          type: "fill",
          source: "zones",
          filter: [">", ["get", "level"], 0],
          paint: { "fill-color": "#2a78d6", "fill-opacity": 0.16 },
        },
        firstLabel,
      );
      m.addLayer({
        id: "zones-active",
        type: "line",
        source: "zones",
        filter: [">", ["get", "level"], 0],
        paint: { "line-color": "#2a78d6", "line-width": 2.5 },
      });
      m.addSource("badges", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "badges-circle",
        type: "circle",
        source: "badges",
        paint: { "circle-radius": 11, "circle-color": "#2a78d6", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
      });
      m.addLayer({
        id: "badges-text",
        type: "symbol",
        source: "badges",
        layout: {
          "text-field": ["get", "letter"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 12,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#ffffff" },
      });
      m.addLayer({
        id: "zones-hover",
        type: "line",
        source: "zones",
        paint: {
          "line-color": "#0b0b0b",
          "line-width": 2,
          "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.6, 0],
        },
      });
      m.addLayer({
        id: "zones-selected",
        type: "line",
        source: "zones",
        // feature-state can't be used in a filter, so the selected outline filters on the
        // zone id (updated in the effect below).
        filter: ["==", ["get", "id"], ""],
        paint: { "line-color": "#0b0b0b", "line-width": 3 },
      });

      let hovered: string | number | undefined;
      m.on("mousemove", "zones-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        if (hovered !== undefined) m.setFeatureState({ source: "zones", id: hovered }, { hover: false });
        hovered = f.id;
        m.setFeatureState({ source: "zones", id: hovered! }, { hover: true });
        m.getCanvas().style.cursor = "pointer";
        const z = worldRef.current.byId.get(String(f.id));
        if (z) setHover({ x: e.point.x, y: e.point.y, zone: z.index });
      });
      m.on("mouseleave", "zones-fill", () => {
        if (hovered !== undefined) m.setFeatureState({ source: "zones", id: hovered }, { hover: false });
        hovered = undefined;
        m.getCanvas().style.cursor = "";
        setHover(null);
      });
      m.on("click", (e) => {
        const f = m.queryRenderedFeatures(e.point, { layers: ["zones-fill"] })[0];
        const z = f ? worldRef.current.byId.get(String(f.id)) : undefined;
        onSelectRef.current(z ? z.index : null);
      });
      setReady(true);
    });
    return () => m.remove();
  }, []);

  // Push the layer colors and ad levels into the map.
  useEffect(() => {
    if (!ready) return;
    const data: GeoJSON.FeatureCollection = {
      ...geojson,
      features: geojson.features.map((f) => {
        const i = world.byId.get(String(f.properties?.id))?.index ?? -1;
        return {
          ...f,
          properties: {
            ...f.properties,
            fill: paint[i]?.color ?? "#000000",
            fillOpacity: paint[i]?.opacity ?? 0,
            level: levels?.[i] ?? 0,
          },
        };
      }),
    };
    (map.current!.getSource("zones") as GeoJSONSource).setData(data);
    const badges: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: world.zones
        .filter((z) => (levels?.[z.index] ?? 0) > 0)
        .map((z) => ({
          type: "Feature",
          properties: { letter: LEVEL_NAMES[levels![z.index]][0] },
          geometry: { type: "Point", coordinates: z.data.center },
        })),
    };
    (map.current!.getSource("badges") as GeoJSONSource).setData(badges);
  }, [ready, geojson, world, levels, paint]);

  // Outline the selected zone. On phones the panel covers the lower part of the screen,
  // so move the map to keep the selected zone in view above it.
  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    const id = selected === null ? "" : world.zones[selected].id;
    m.setFilter("zones-selected", ["==", ["get", "id"], id]);
    if (window.innerWidth <= PHONE_WIDTH) {
      const panel = Math.round(m.getContainer().clientHeight * PHONE_PANEL_SHARE);
      const padding = { top: 0, left: 0, right: 0, bottom: selected !== null && zoneCardOpen ? panel : 0 };
      if (selected === null) m.fitBounds(SF_BOUNDS, { padding: { ...padding, top: 24, left: 24, right: 24 } });
      else m.easeTo({ center: world.zones[selected].data.center, zoom: 12.5, padding });
    }
    // Only when the selection changes, not when the product does.
  }, [ready, selected, zoneCardOpen]);

  // Show new bubbles once each, after their delay.
  const shownPops = useRef(new Set<number>());
  useEffect(() => {
    if (!ready || !pops) return;
    const m = map.current!;
    for (const p of pops) {
      if (shownPops.current.has(p.id)) continue;
      shownPops.current.add(p.id);
      const z = world.zones[p.zone];
      if (!z) continue;
      window.setTimeout(() => spawnPop(m, z.data.center, p), p.delay);
    }
  }, [ready, pops, world]);

  /** Back to the starting view: all of San Francisco. */
  const goHome = () => {
    const m = map.current;
    if (!m) return;
    const phonePanel =
      window.innerWidth <= PHONE_WIDTH && selected !== null && zoneCardOpen
        ? Math.round(m.getContainer().clientHeight * PHONE_PANEL_SHARE)
        : 0;
    m.fitBounds(SF_BOUNDS, { padding: { top: 24, left: 24, right: 24, bottom: 24 + phonePanel } });
  };

  const hz = hover ? world.zones[hover.zone] : null;
  return (
    <div className="map-wrap">
      <div ref={container} className="map" role="region" aria-label="Map of San Francisco neighborhoods" />
      <button
        type="button"
        className="float-card home-btn"
        onClick={goHome}
        title="Back to all of San Francisco"
        aria-label="Back to all of San Francisco"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-6h3v6h5V9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </button>
      {hz && hover && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }} role="status">
          <strong>{hz.name}</strong>
          {describe(hz.index) && <span>{describe(hz.index)}</span>}
        </div>
      )}
    </div>
  );
}

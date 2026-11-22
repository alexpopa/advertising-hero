/**
 * Full-screen MapLibre map of SF with the zones colored by score for the current product.
 * Hover shows the zone's name and score (so nothing depends on color alone); click selects.
 */
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre works out its worker's address at runtime, which bundlers can't follow, so the
// worker is shipped as its own file and its URL passed in. Without this the map is blank.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

maplibregl.setWorkerUrl(workerUrl);
import { LEVEL_NAMES, type Level, type World } from "./sim";
import { SCORE_BINS } from "./scale";

const SF_BOUNDS: [number, number, number, number] = [-122.52, 37.7, -122.35, 37.835];
const BASEMAP = "https://tiles.openfreemap.org/styles/positron";
/** Matches the phone breakpoint in styles.css, where the panel becomes a bottom sheet. */
const PHONE_WIDTH = 720;
const PHONE_PANEL_SHARE = 0.55;

const fillColor: ExpressionSpecification = [
  "step",
  ["get", "score"],
  SCORE_BINS[0].color,
  ...SCORE_BINS.slice(1).flatMap((b) => [b.min, b.color] as [number, string]),
];

interface Props {
  geojson: GeoJSON.FeatureCollection;
  world: World;
  selected: number | null;
  onSelect: (zone: number | null) => void;
  /** Current ad level per zone; zones with ads get an outline and an L/M/H badge. */
  levels?: Level[];
  /** On phones, share of the screen covered by an open bottom sheet. */
  sheetOpen?: boolean;
}

interface Hover {
  x: number;
  y: number;
  zone: number;
}

export function MapView({ geojson, world, selected, onSelect, levels, sheetOpen }: Props) {
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
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.current = m;

    m.on("load", () => {
      m.addSource("zones", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" });
      // Put the zones under the basemap's labels so street and place names stay readable.
      const firstLabel = m.getStyle().layers.find((l) => l.type === "symbol")?.id;
      m.addLayer(
        {
          id: "zones-fill",
          type: "fill",
          source: "zones",
          paint: {
            "fill-color": fillColor,
            // Opaque enough that the colors match the legend; hover changes the outline,
            // never the color (a darker fill would read as a better score).
            "fill-opacity": 0.85,
          },
        },
        firstLabel,
      );
      m.addLayer(
        {
          id: "zones-line",
          type: "line",
          source: "zones",
          paint: { "line-color": "#fcfcfb", "line-width": 1, "line-opacity": 0.9 },
        },
        firstLabel,
      );
      m.addLayer({
        id: "zones-active",
        type: "line",
        source: "zones",
        filter: [">", ["get", "level"], 0],
        paint: { "line-color": "#0b0b0b", "line-width": 1.5, "line-dasharray": [2, 1.5] },
      });
      m.addSource("badges", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "badges-circle",
        type: "circle",
        source: "badges",
        paint: { "circle-radius": 10, "circle-color": "#ffffff", "circle-stroke-color": "#0b0b0b", "circle-stroke-width": 1.5 },
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
        paint: { "text-color": "#0b0b0b" },
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

  // Push scores for the current product into the map.
  useEffect(() => {
    if (!ready) return;
    const data: GeoJSON.FeatureCollection = {
      ...geojson,
      features: geojson.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          score: world.byId.get(String(f.properties?.id))?.score ?? 0,
          level: levels?.[world.byId.get(String(f.properties?.id))?.index ?? -1] ?? 0,
        },
      })),
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
  }, [ready, geojson, world, levels]);

  // Outline the selected zone. On phones the panel covers the lower part of the screen,
  // so move the map to keep the selected zone in view above it.
  useEffect(() => {
    if (!ready) return;
    const m = map.current!;
    const id = selected === null ? "" : world.zones[selected].id;
    m.setFilter("zones-selected", ["==", ["get", "id"], id]);
    if (window.innerWidth <= PHONE_WIDTH) {
      const panel = Math.round(m.getContainer().clientHeight * PHONE_PANEL_SHARE);
      const padding = { top: 0, left: 0, right: 0, bottom: selected !== null || sheetOpen ? panel : 0 };
      if (selected === null) m.fitBounds(SF_BOUNDS, { padding: { ...padding, top: 24, left: 24, right: 24 } });
      else m.easeTo({ center: world.zones[selected].data.center, zoom: 12.5, padding });
    }
    // Only when the selection or sheet changes, not when the product does.
  }, [ready, selected, sheetOpen]);

  const hz = hover ? world.zones[hover.zone] : null;
  return (
    <div className="map-wrap">
      <div ref={container} className="map" role="region" aria-label="Map of San Francisco neighborhoods" />
      {hz && hover && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }} role="status">
          <strong>{hz.name}</strong>
          <span>
            Score <b>{hz.score}</b>/100
          </span>
        </div>
      )}
    </div>
  );
}

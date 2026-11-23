/**
 * The map button, bottom-left. Closed, it's a small button naming what the map shows;
 * hovering it shows the color key. Open, it lists every place type in the data. Tick one or
 * several and the map colors each neighborhood by how many of them it has per km2, added
 * together. Grouped by theme, not by "customers" vs "competitors", so working out what
 * matters stays the player's job.
 */
import { useState } from "react";
import categories from "../scripts/categories.json";
import { labelName, type CategoriesData, type World } from "./sim";
import { cityCount, layerName, type LayerView, type MapLayer } from "./layers";

/** Map layer groups come from scripts/categories.json, so the data build and the map agree. */
const GROUPS: [string, string[]][] = ((categories as unknown as CategoriesData).layers ?? []).map((g) => [g.group, g.labels]);

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <path d="M10 2 18 6.5 10 11 2 6.5Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M2.5 10.2 10 14.5l7.5-4.3M2.5 13.7 10 18l7.5-4.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** The color key for whatever the map shows. */
function Key({ view }: { view: LayerView }) {
  return (
    <div className="key">
      <div className="key-title">{view.title}</div>
      <ol className="legend-steps">
        {view.noneBin && (
          <li>
            <span className="swatch" style={{ background: view.noneBin.color }} />
            {view.noneBin.label}
          </li>
        )}
        {view.bins.map((b) => (
          <li key={b.label}>
            <span className="swatch" style={{ background: b.color }} />
            {b.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

interface Props {
  world: World;
  layer: MapLayer;
  view: LayerView;
  onChange: (layer: MapLayer) => void;
  /** Easy mode offers the fit score as a layer. */
  allowFit: boolean;
}

export function MapControl({ world, layer, view, onChange, allowFit }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const picked = layer.kind === "places" ? layer.labels : [];
  const showing = view.bins.length > 0;

  const toggle = (label: string) => {
    const next = picked.includes(label) ? picked.filter((l) => l !== label) : [...picked, label];
    onChange(next.length ? { kind: "places", labels: next } : { kind: "none" });
  };

  return (
    <div className={"map-control" + (open ? " open" : "")}>
      {open && (
        <div className="float-card map-panel" role="dialog" aria-label="What the map shows">
          <header className="map-panel-head">
            <h2>Show on the map</h2>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </header>

          {showing && <Key view={view} />}

          {allowFit && (
            <label className={"fit-toggle" + (layer.kind === "fit" ? " on" : "")}>
              <input
                type="checkbox"
                checked={layer.kind === "fit"}
                onChange={(e) => onChange(e.target.checked ? { kind: "fit" } : { kind: "none" })}
              />
              <span>
                <b>Fit score</b>
                <span className="muted small">Where {world.product.name.toLowerCase()} pays off best (Easy mode)</span>
              </span>
            </label>
          )}

          <div className="picked-row">
            <span className="muted small">
              {picked.length
                ? `${picked.length} selected, counted together`
                : "Pick one or more kinds of places. Their counts per km² are added together."}
            </span>
            {layer.kind !== "none" && (
              <button className="link small" onClick={() => onChange({ kind: "none" })}>
                Clear
              </button>
            )}
          </div>

          <input
            className="layer-search"
            type="search"
            placeholder="Search place types"
            aria-label="Search place types"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="layer-list">
            {GROUPS.map(([group, labels]) => {
              const shown = labels.filter((l) => !q || labelName(l).toLowerCase().includes(q));
              if (!shown.length) return null;
              return (
                <section key={group}>
                  <h3>{group}</h3>
                  <ul>
                    {shown.map((l) => {
                      const on = picked.includes(l);
                      return (
                        <li key={l}>
                          <label className={"layer-opt" + (on ? " on" : "")}>
                            <input type="checkbox" checked={on} onChange={() => toggle(l)} />
                            <span className="layer-name">{cap(labelName(l))}</span>
                            <span className="muted small">{cityCount(world, l).toLocaleString("en-US")}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
          <p className="muted small">Place data © Overture Maps Foundation.</p>
        </div>
      )}

      {!open && showing && (
        <div className="float-card key-pop" aria-hidden>
          <Key view={view} />
        </div>
      )}

      <button
        className="float-card map-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={showing ? `Map shows ${layerName(layer, world)}. Change` : "Color the map by place type"}
      >
        <LayersIcon />
        <span className="map-btn-label">{showing ? layerName(layer, world) : "Color the map"}</span>
        {showing && (
          <span className="mini-ramp" aria-hidden>
            {view.bins.map((b) => (
              <span key={b.label} style={{ background: b.color }} />
            ))}
          </span>
        )}
      </button>
    </div>
  );
}

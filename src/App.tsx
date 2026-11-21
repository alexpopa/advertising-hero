/**
 * Map preview (DESIGN.md build step 3): the map colored by score for a product, and the
 * "why" panel. The start screen, ad buying and the game loop come in steps 4-5; until
 * then a product picker in the top bar lets you explore.
 */
import { useEffect, useMemo, useState } from "react";
import { MapView } from "./MapView";
import { ZonePanel } from "./ZonePanel";
import { loadGameData, type GameData } from "./data";
import { buildWorld } from "./sim";
import { SCORE_BINS } from "./scale";

export function App() {
  const [data, setData] = useState<GameData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ?product=late_night&zone=mission opens straight to a product and neighborhood.
  const params = new URLSearchParams(window.location.search);
  const [productKey, setProductKey] = useState(params.get("product") ?? "cold_brew");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    loadGameData().then((d) => {
      if (!d.categories.products[productKey]) setProductKey("cold_brew");
      const zi = d.zones.findIndex((z) => z.id === params.get("zone"));
      if (zi >= 0) setSelected(zi);
      setData(d);
    }, (e: Error) => setError(e.message));
  }, []);

  const world = useMemo(
    () => (data ? buildWorld(data.zones, data.categories, productKey) : null),
    [data, productKey],
  );

  if (error) return <div className="center">Couldn't load the map data: {error}</div>;
  if (!data || !world) return <div className="center">Loading San Francisco…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <h1>Ad Empire SF</h1>
        <label className="product-pick">
          <span>Product</span>
          <select value={productKey} onChange={(e) => setProductKey(e.target.value)}>
            {Object.entries(data.categories.products).map(([key, p]) => (
              <option key={key} value={key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small preview-note">Map preview: buying ads comes next</span>
      </header>

      <main className="stage">
        <MapView geojson={data.geojson} world={world} selected={selected} onSelect={setSelected} />

        <div className="legend" aria-label="Score legend">
          <div className="legend-title">Fit score for {world.product.name.toLowerCase()}</div>
          <ol>
            {SCORE_BINS.map((b) => (
              <li key={b.min}>
                <span className="swatch" style={{ background: b.color }} aria-hidden />
                <span>
                  {b.min}–{b.max}
                </span>
                <span className="muted">{b.label}</span>
              </li>
            ))}
          </ol>
          {selected === null && <div className="muted small">Click a neighborhood to see why</div>}
        </div>

        {selected !== null && (
          <ZonePanel
            world={world}
            zone={selected}
            examples={data.examples[world.zones[selected].id]}
            onClose={() => setSelected(null)}
          />
        )}
      </main>
    </div>
  );
}

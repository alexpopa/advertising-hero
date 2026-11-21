# Status and handoff

Last updated 2026-11-20. Read this first when picking the project up on another computer or in a new Claude session.

## Decisions so far
- Project: **Ad Empire SF** (working title), an ad-spend tycoon game. Full design and scoring model in [DESIGN.md](DESIGN.md).
- v1: online brand only, ads by San Francisco neighborhood, 6 products, 90-day run, static site on Render.
- Research behind the idea: [research-notes.md](research-notes.md).

## Where the work is
Moved to a Mac mini on 2026-11-20 (the Windows desktop wasn't workable). Built-in Python 3.9 works fine with DuckDB 1.4; no new installs needed.
Repo: private GitHub repo `alexpopa/ad-empire-sf` (push over SSH). `data/raw/` and `.venv/` are git-ignored.

Build order from DESIGN.md section 9:
1. **Data: done.** `scripts/extract.py` downloads the SF slice (~80 s), `scripts/inspect_sf.py` reports on it, `scripts/build_zones.py` writes `public/data/` (76 zones, 220 KB). Decisions in DESIGN.md section 10.
2. **Simulation engine: done (2026-11-21).** `src/sim/` (pure TypeScript, no UI), 51 tests passing (`npm test`), economy check with `npm run report`. Tuned against real data; what changed and why is in DESIGN.md 6.11. Full balance script (many seeded runs, bots) still to do, once more logic exists.
3. **Map: done (2026-11-21).** MapLibre + OpenFreeMap basemap, zones colored by score in 5 validated blue steps with a legend, hover tooltip (name + score), click for the "why" panel (fit, competition, price, cost/customers/profit per level, real place names). Phone layout: bottom sheet, map recenters on the selected zone. A temporary product picker in the top bar stands in for the start screen. `?product=late_night&zone=mission` opens a specific view. Checked by screenshot in Chrome (desktop + phone, dev + production build).
   **Next:** the game loop (step 4).
4. Game loop.
5. Start/end screens (incl. Easy/Hard choice), hints, events.
6. Polish, deploy, README.

## Open questions
- Only 11-16 of 76 zones are worth advertising in per product, and one ad level usually wins within a product. Revisit in the balance pass (DESIGN.md 6.11).
- Hard mode: keep the fit colors on the map, or remove them / show something neutral? Alexandru wants to see the map working first, then decide (2026-11-21).

## Run the app

```
npm install
npm run dev       # http://localhost:5173
npm test
npm run build     # static site in dist/
```

Gotcha: MapLibre 6 needs its worker passed in explicitly (`setWorkerUrl` in `src/MapView.tsx`) and excluded from Vite's dependency pre-bundling (`vite.config.ts`), or the map renders blank, in dev and in production.

## Rerun the data pipeline (macOS)

```
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/extract.py        # downloads into data/raw/ (not committed)
python scripts/inspect_sf.py     # optional data-quality report
python scripts/build_zones.py    # writes public/data/
```

## Trade-offs and cuts logged so far (for the README)
- 2026-11-21: economy calibrated per product (Overture has no sales data), competition per capita, $15/day campaign fee so blanketing the city fails, start cash $3,000. Details DESIGN.md 6.11.
- 2026-11-21: recommendations moved behind an **Easy** mode; **Hard** is the default and shows none. Always-on recommendations would just hand players the answer.
- Zones are H3 hexes named after the nearest Overture neighborhood point and merged by name, because Overture outlines only ~16 SF neighborhoods. Names are approximate.
- Treasure Island / Yerba Buena Island dropped: no Overture neighborhood label within 1.5 km.
- `campus` and `kindergarten` labels removed: 0 SF places.

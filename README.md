# Ad Empire SF

**Launch a brand and grow it by buying ads across San Francisco's real neighborhoods, where every neighborhood's value comes from an open map of what's actually there.**

Ad Empire SF is a small tycoon game that runs in the browser. You pick a product, start with $3,000, and spend 90 game days deciding where your next ad dollar is worth the most. A gym-heavy corner of SoMa is great for protein powder and useless for baby gear. Downtown is packed with people, but its ads are priced to match. The quiet, cheap neighborhood with exactly your audience is the one worth finding.

> **Status: playable, not yet deployed.** The full game runs locally: start screen, map, buying ads, the 90-day run and the end screen. Next: putting it online, then balancing and polish. See [Roadmap](#roadmap).

## How it plays

1. **Pick a product:** cold brew subscription, protein & supplements, premium pet food, kids & baby gear, late-night snack delivery, or clean skincare.
2. **Pick a difficulty:** **Hard** (the default) leaves the decisions to you. **Easy** adds a sidebar that suggests where to place ads next, with a plain-language reason ("31 gyms and fitness studios, only 2 sporting-goods stores, cheaper than 70% of SF").
3. **Read the map:** every neighborhood is colored by how well it fits your product. Click one to see why: what's there, who you're up against, what ads cost.
4. **Buy ads:** set each neighborhood to Off, Low, Medium or High. Ads cost money every day they run (plus a flat fee per campaign), take about a week to build up, have diminishing returns, fade after you stop, and spill over a little into neighboring areas. Advertising everywhere is the fastest way to go broke.
5. **Earn and reinvest:** customers arrive from where your ads run. Cut what loses money, expand what works, and survive events like street fairs, rainy weeks and rival campaigns.
6. **Finish:** after day 90 you see your net worth, your best and worst neighborhoods, and your cash over time. Run out of cash for three days and you're bankrupt.

## Where the numbers come from

The map comes from [Overture Maps](https://overturemaps.org/), an open dataset of places, buildings, transit and boundaries. For each neighborhood the game uses:

| Input | From |
|---|---|
| Estimated people who live or work there | building footprints × floors (96% of SF buildings have a height) |
| How well it fits your product | counts of related places, e.g. gyms, preschools, bars, pet services |
| Competition | counts of competing stores; chains count extra |
| Busyness (raises ad prices) | transit stops and overall place density |
| Example businesses in the "why" panel | real place names |

Overture has no sales, rent or foot-traffic figures, so the economy itself (prices, purchase rates, events) is invented. Each product is calibrated so that it's equally winnable, and the map data decides where the money is. The inputs are real, and the game always shows why a neighborhood scores the way it does. Full scoring model: [DESIGN.md](DESIGN.md).

## How neighborhoods are made

Overture names about 90 San Francisco neighborhoods but only draws outlines for about 16 of them, so the game builds its own:

1. Cover the city's land with ~0.74 km² hexagons ([H3](https://h3geo.org/)), clipped to the coastline.
2. Name each hexagon after the nearest Overture neighborhood point, or after a big park (Presidio, Golden Gate Park, Lake Merced, McLaren) if it's mostly park.
3. Drop nearly empty hexagons and ones too far from any named neighborhood.
4. Merge hexagons with the same name.

The result is **76 neighborhoods** in about 220 KB of data, small enough to ship straight to the browser.

## Design choices and things left out

- **Neighborhood names are approximate.** Boundaries follow the nearest named point, not official lines, so a few areas are bigger or smaller than locals would draw them.
- **Treasure Island isn't in the game.** Overture has no neighborhood name anywhere near it.
- **Online brand only.** No storefronts, property, staff or inventory. Those would double the scope without making the core decision more interesting. Storefronts are the first thing on the wishlist.
- **One city.** San Francisco keeps the data small and lets the balance be tuned against one map.
- **No accounts or leaderboards.** Progress is saved in your browser, so there's no server to run.
- **The data is precomputed,** not queried live: a one-time script turns millions of map records into a few small files.

## Run it

Needs Node.js.

```bash
npm install
npm run dev       # the game at http://localhost:5173
npm test          # 51 tests for the game rules
npm run report    # how a few simple strategies do over 90 days, per product
```

## Run the data pipeline

Needs Python 3.9+.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/extract.py        # downloads the SF slice of Overture into data/raw/ (~1-2 min)
python scripts/inspect_sf.py     # optional: data-quality report
python scripts/build_zones.py    # writes public/data/
```

| File | What it is |
|---|---|
| `scripts/extract.py` | Reads Overture's cloud GeoParquet with DuckDB: places, buildings, transit stops, boundaries, parks |
| `scripts/build_zones.py` | Builds the neighborhoods and per-neighborhood inputs |
| `scripts/categories.json` | Products, which places signal demand or competition, and their weights (easy to tune) |
| `public/data/` | `zones.geojson`, `zones.json`, `examples.json`, `meta.json` |

## Roadmap

- [x] Data pipeline and neighborhoods
- [x] Simulation engine with tests
- [ ] Balance script (bots play many runs to tune the economy)
- [x] Map with fit colors and a "why this neighborhood" panel
- [x] Game loop: ad buying, campaigns, Easy-mode suggestions
- [x] Start and end screens (with Easy / Hard), hints, events
- [ ] Polish and deploy

Planned stack: Vite, React, TypeScript, MapLibre GL, hosted as a static site.

## Credits

Map data © [Overture Maps Foundation](https://overturemaps.org/), © OpenStreetMap contributors. Release `2026-11-18.0`.

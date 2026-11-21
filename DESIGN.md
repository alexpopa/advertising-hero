# Ad Empire SF — v1 design

> Working title. One-sentence pitch: **Launch a brand and grow it by buying ads across San Francisco's real neighborhoods, where every neighborhood's value comes from Overture's map of what is actually there.**

## 1. Why this, and who it's for

- **Player:** people who like tycoon and sim games, and anyone curious how location-targeted advertising works. San Francisco players recognize the neighborhoods, which makes the decisions feel real.
- **Why a game, not a tool:** Overture has no revenue, rent, foot-traffic or demographic data. A "where should my business advertise" *tool* would have to present invented revenue as a forecast, which would be misleading. In a *game*, a synthetic economy is expected. What we keep honest is the **input**: every neighborhood's score comes from real Overture data, and the game always shows why.
- **Why ads:** the core question of the game ("where is my next ad dollar worth the most, and why?") is the everyday question of anyone buying local ads, and it maps cleanly onto what open map data can and can't tell you.

## 2. Scope of v1

**In**
- San Francisco only, data precomputed into static files.
- An online-only brand: no storefronts, no property.
- 6 product types to pick from (section 5).
- Ads bought per neighborhood at 4 levels (Off / Low / Medium / High).
- Daily income, overhead, a bit of randomness, occasional events.
- Two difficulty modes, chosen at the start, **Hard by default**. Easy adds top-5 recommendations (where to place ads, with plain-language reasons). Hard shows no recommendations; the player reads the map and works it out.
- A 90-day run with an end-of-game summary. Progress saved in the browser.

**Cut (and why), to be repeated in the README**
| Cut | Why |
|---|---|
| Physical storefronts and buying land | Doubles the scope (placement UI, rent model, cannibalization). It's the first stretch goal once v1 is solid. |
| Pricing existing businesses / land | No data to price it credibly; it would be pure invention. |
| Employees, salaries, inventory | Micromanagement isn't the fun part. Rolled into one "overhead" line. |
| Multiple cities | SF keeps the data small and lets us tune the balance against one map. |
| Accounts, leaderboards, multiplayer | Needs a backend. Save to localStorage instead. |
| Census demographics | A good v2 addition ("Overture + one dataset"), but v1 proves the idea on Overture alone. |
| Live Overture queries in the browser | Slow and fragile. Precompute once, ship small files. |

**Stretch goals, in order:** storefront unlock at a revenue milestone → census income layer → shareable end-of-run card → second city.

## 3. Core loop

1. **Start:** name your brand (or take a random one), pick a product, and pick **Easy or Hard** (Hard preselected). Starting cash: $5,000.
2. **Read the map:** every neighborhood is colored by its **score** (0–100) for your product. On Easy, the sidebar also lists the **top 5 recommendations** with reasons.
3. **Buy ads:** click a neighborhood, choose Low / Medium / High. Ads cost money every day while active.
4. **Earn:** each day, customers arrive from neighborhoods where your ads are running. Revenue minus ad spend minus overhead is your daily profit. It can be negative.
5. **Reinvest:** move budget toward what works, expand to new neighborhoods, cut what doesn't pay.
6. **End:** after day 90, show final net worth, best and worst neighborhoods, and total ad spend. Bankrupt if cash stays below $0 for 3 days in a row.

Time runs on its own: 1 game day every 3 s at 1×, with Pause, 1×, 2× and 4×. A full run is about 4–5 minutes at 1×.

## 4. Screens and UX

- **Start screen:** one sentence on what the game is, the 6 product cards (icon, name, one-line "who buys this"), a brand-name field, a **difficulty toggle: Hard (default) / Easy** with one line each ("Hard: read the map and decide for yourself" / "Easy: get suggestions on where to place ads"), and Start. No signup.
- **Main screen**
  - Full-screen MapLibre map of SF with neighborhood polygons colored by score (sequential scale). Neighborhoods with active ads get an outline and a small level badge.
  - **Top bar:** brand name, day X/90, cash, profit per day (green/red), speed controls.
  - **Sidebar, "Recommended" tab (Easy only; default tab on Easy):** top 5 actions, e.g. "Medium ads in Mission — +$41/day, $60/day cost", each with a one-line reason and a Buy button.
  - **Sidebar, "Your campaigns" tab (both modes; the only/default tab on Hard):** each active neighborhood with level, cost, customers/day and profit/day, sortable. This is where you find losers to cut.
  - **Neighborhood panel (on click):** score, "why" breakdown (section 6.6), price per level, projected customers and profit per level, the 3 most relevant real places as examples ("Equinox, Barry's, 29 other gyms").
  - **Event toasts** in a corner, with a log.
- **First-run hints:** three short tooltips: "Colors show where your product fits", then on Easy "Start with a recommendation" / on Hard "Click a neighborhood to see why it scores that way", then "Watch profit per day; cut what's red". Dismissible, shown once.
- **Difficulty** is fixed for the run (no switching mid-game) and shown on the end screen.
- **End screen:** summary stats, a line chart of cash over time, Play again.

Accessibility: the color scale also has number labels on hover and in the panel; nothing depends on color alone.

## 5. Products

Each product defines which kinds of places signal its audience (demand signals), which places compete with it, and its unit economics. Labels are Overture `basic_category` values (release 2026-10-21.0 taxonomy). A place matches a label if the label is its `basic_category` or appears anywhere in `taxonomy.hierarchy`.

| Product | Demand signals (weight) | Competitors (weight) | Order value | Margin |
|---|---|---|---|---|
| **Cold brew subscription** | corporate_or_business_office 1.0, college_university 0.7, campus 0.5, fitness_studio 0.4, b2b_office_and_professional_service 0.6 | coffee_shop 1.0, cafe 0.7 | $24 | 45% |
| **Protein & supplements** | gym 1.0, fitness_studio 1.0, sport_or_fitness_facility 0.8, smoothie_juice_bar 0.6, sport_court 0.4, swimming_pool 0.4, park 0.3 | sporting_goods_store 0.8, pharmacy_and_drug_store 0.4 | $45 | 35% |
| **Premium pet food** | animal_or_pet_service 1.0, dog_park 1.0, park 0.4 | animal_and_pet_store 1.0 | $60 | 30% |
| **Kids & baby gear** | preschool 1.0, kindergarten 1.0, elementary_school 0.8, playground 0.8, pediatric_clinic 0.7 | toys_and_games_store 1.0, department_store 0.4 | $55 | 35% |
| **Late-night snack delivery** | bar 1.0, nightlife_venue 1.0, dance_club 0.8, music_venue 0.7, lounge 0.6, college_university 0.4 | fast_food_restaurant 0.6, convenience_store 0.6, food_truck_stand 0.4 | $22 | 40% |
| **Clean skincare** | personal_or_beauty_service 1.0, wellness_service 0.8, fitness_studio 0.5, fashion_and_apparel_store 0.5, shopping_mall 0.4 | personal_care_and_beauty_store 1.0, pharmacy_and_drug_store 0.5 | $38 | 55% |

These weights are design choices, not facts. The README says so, and they live in one JSON file so they're easy to tune.

## 6. Scoring model

Everything is computed per **zone** (a neighborhood) and per **product**. All inputs except the tuning constants come from Overture.

### 6.1 Zones
- Source: Overture `divisions` → `division_area`, `is_land = true`, inside the San Francisco locality, `subtype` in (`neighborhood`, `macrohood`).
- Pick the level that gives roughly 30–120 zones. Neighborhood coverage is patchy in some places. If SF's set is incomplete or overlapping, fall back to H3 resolution-8 hexes (~0.7 km² each) labeled with the neighborhood they mostly fall in.
- Precompute zone adjacency (zones that share a border) for the spillover rule.

### 6.2 Per-zone raw inputs (precomputed)
| Symbol | Meaning | Source |
|---|---|---|
| `area` | land area, km² | divisions |
| `floorArea` | Σ footprint area × floors over buildings in the zone. Floors = `num_floors`, else `height / 3.5 m`, else 2 | buildings |
| `n[label]` | count of places matching each category label | places |
| `nAll` | count of all places | places |
| `transit` | count of transit stops/stations (`infrastructure`, `subtype = transit`, `class` in bus_stop, bus_station, platform, stop_position, railway_station, railway_halt, ferry_terminal, subway_station) | base |

Place filtering: `operating_status` ≠ `permanently_closed`/`temporarily_closed`, `confidence ≥ 0.5`, and dedupe places with the same normalized name within 30 m. Known Overture issues (duplicates, junk) are why this matters.

### 6.3 Derived zone values
- **People** `H = floorArea / 60` — "estimated people who live or work here". It's a proxy and the UI says "estimated from building floor space".
- **Busyness** `B = pct(transit / area) · 0.5 + pct(nAll / area) · 0.5`, where `pct()` is the percentile rank across all SF zones (0..1).

### 6.4 Product fit and competition
- **Fit** (0..1): how much the zone looks like your audience.
  `Fit = Σ_g w_g · pct(n_g / area) / Σ_g w_g` over the product's demand signals g.
- **Competition** `C = Σ_c v_c · n_c` over competitor labels c, where branded places (non-null `brand`) count 1.5×.
  `compFactor = 1 / (1 + C / κ)`, with κ = 6. So 6 weighted competitors halve your potential.

### 6.5 Potential, ad price, reach
- **Max customers/day** if everyone in the zone knew your brand:
  `Pmax = H · r · (0.2 + 0.8 · Fit) · compFactor`, base purchase rate `r = 0.002`.
- **Ad price per day** for the Low level:
  `price = c0 · (H / 10,000)^0.9 · (0.75 + 0.5 · B)`, `c0 = $20`.
  Bigger zones cost more because they hold more people. Busy zones charge a premium. That creates the core tension: prime areas are expensive; high-fit, low-busyness areas are hidden gems.
- **Levels:** Low = 1× price, Medium = 2×, High = 4×.
- **Ad pressure** (memory of past ads), updated daily:
  `a_z ← 0.8 · a_z + spend_z + 0.15 · Σ_{neighbors} spend_n`
  Ads fade by 20% a day after you stop. Neighbors get 15% spillover.
- **Reach** (share of the zone's potential you capture):
  `ρ = 1 − exp(−a_z / (8 · price))`
  At steady state that's Low ≈ 46%, Medium ≈ 71%, High ≈ 92%. Doubling spend always buys less than double the result (diminishing returns).

### 6.6 Daily result
- **Brand awareness** multiplier: `brand = 1 + 0.02 · (zones with ρ > 0.5)`, capped at 1.25. Being in many places helps a bit everywhere.
- **Customers** `cust_z = Pmax · ρ · brand · noise_z · eventMult_z`, where `noise_z` is drawn from a seeded normal distribution with mean 1 and sd 0.08, clamped to 0.75–1.25.
- **Revenue** = Σ cust_z · orderValue · margin.
- **Costs** = Σ ad spend + overhead, where overhead = $120/day + 10% of revenue (rent, fulfillment, staff, all rolled into one line).
- **Profit/day** = revenue − costs. Can be negative.

### 6.7 Score and recommendations (recommendations: Easy mode only)
- **Score (0–100)** for the choropleth: steady-state profit per ad dollar at Medium, `(revenue_at_medium − 0.1 · revenue_at_medium − cost_at_medium) / cost_at_medium`, mapped to 0–100 by percentile across zones. It ignores current campaigns so the map stays stable.
- **Recommendations (Easy only):** for every zone and every one-step change (Off→Low, Low→Med, Med→High, and downgrades), compute the steady-state Δprofit/day. Show the 5 best positive ones. Downgrades appear when a campaign loses money ("Cut High ads in Marina: saves $32/day").
- **Reasons** shown with each: the two demand signals contributing most to Fit, with real counts ("31 gyms and fitness studios"), the competition line ("only 2 sporting-goods stores"), and the price line ("cheaper than 70% of SF"). Text comes from the numbers above, not hand-written per zone.

### 6.8 Events (roughly every 8–12 days, seeded)
| Event | Effect | Data link |
|---|---|---|
| Street fair in [zone] | +40% customers there for 2 days | zone chosen weighted by event_venue + festival_venue + park counts |
| Rainy week | −10% citywide for 3 days | none |
| Competitor campaign in [zone] | −20% there for 5 days | weighted by competitor counts |
| Viral post | brand +10% for 3 days | none |
| Ad prices up in [zone] | +25% price for 4 days | weighted by busyness |

Events are fictional. They never name real businesses.

### 6.9 Sanity check of the numbers
Example zone: 15,000 people, Fit 0.7, compFactor 0.6, product with $25 order at 40% margin.
- Pmax = 15,000 × 0.002 × 0.76 × 0.6 ≈ 13.7 customers/day.
- Medium: ρ ≈ 0.71 → 9.7 customers → $97 gross margin → $87 after the 10% overhead share.
- Price ≈ $20 × 1.44 × ~1.0 ≈ $29 → Medium costs $58/day → **+$29/day**.
- With 10 decent zones that's ~$290/day − $120 fixed overhead ≈ $170/day. Starting at $5,000, a good player who expands steadily ends around $20k or more; a careless one burns cash.

These constants are a starting point. The balance script (section 8) tunes them.

### 6.10 Tuning constants (all in `src/sim/constants.ts`)
| Name | Start value |
|---|---|
| startCash | $5,000 |
| days | 90 |
| m² per person | 60 |
| base purchase rate r | 0.002 |
| κ (competition) | 6 |
| branded competitor weight | 1.5 |
| c0 (ad price base) | $20 |
| level multipliers | 1, 2, 4 |
| ad decay | 0.8/day |
| spillover | 0.15 |
| reach scale | 8 |
| brand bonus | 0.02/zone, cap 1.25 |
| noise sd | 0.08 |
| fixed overhead | $120/day |
| variable overhead | 10% of revenue |
| bankruptcy | 3 days below $0 |

## 7. Data pipeline (in the repo)

```
scripts/
  extract.py        # DuckDB over Overture GeoParquet on S3, SF bbox, latest release from the STAC catalog
  build_zones.py    # clips to zones, computes the inputs in 6.2, writes public/data/*
  categories.json   # product → demand/competitor labels and weights (section 5)
public/data/
  zones.geojson     # simplified zone polygons + id + name   (target < 1 MB)
  zones.json        # per-zone inputs: area, floorArea, transit, nAll, n[label] for used labels only
  examples.json     # up to 5 example place names per zone per used label, for the "why" panel
  meta.json         # Overture release, extraction date, counts, attribution text
```

- SF bounding box: roughly −122.52, 37.70 to −122.35, 37.83, then clipped to the SF locality.
- Only the per-zone aggregates ship to the browser, not raw places or buildings. Target total < 3 MB.
- The scripts are reruns-from-scratch and record the Overture release in `meta.json`.
- Attribution: "© Overture Maps Foundation, © OpenStreetMap contributors" on the map, per Overture's attribution page (buildings, divisions and base are ODbL).

## 8. App architecture

- **Stack:** Vite + React + TypeScript, MapLibre GL JS, OpenFreeMap basemap (free, no key). No backend.
- **Simulation is a pure TypeScript module** (`src/sim/`): `initGame(seed, product, difficulty)`, `step(state, actions) → state`, `recommend(state)`, `explain(zone)`. Difficulty only gates what the UI shows; the economy is identical in both modes. No React, no DOM, so it can be unit-tested and run headless.
- **Seeded RNG** so a run can be reproduced from its seed (useful for debugging and tests).
- **Persistence:** game state in localStorage, wrapped in try/catch. If storage fails, the game still runs.
- **Tests (Vitest):** reach curve monotonic with diminishing returns, ads decay after stopping, competition lowers potential, bankruptcy triggers, recommendations never suggest a negative Δprofit action, same seed gives the same run.
- **Balance script (later, once the economy is in place):** `npm run balance` plays 200 seeded runs per product with three bots (do nothing, random, always-take-top-recommendation) and prints final cash. Target: top-recommendation > random > do nothing, do-nothing slowly loses money, random sometimes goes bankrupt, nobody gets rich by day 20.
- **Hosting:** static site on Render's free tier. Static sites don't sleep, so the first load is fast.

## 9. Build order

1. Extraction script → inspect SF zones, category counts and building heights. Decide neighborhoods vs hexes. *(Check this first: it's the biggest data unknown.)*
2. Simulation module + tests, before any UI. Balance script once there's enough logic to be worth balancing.
3. Map with score choropleth and the neighborhood "why" panel.
4. Game loop: top bar, ad buying, campaigns tab, recommendations (Easy).
5. Start and end screens (incl. Easy/Hard choice), first-run hints, events.
6. Polish, mobile check, deploy, README.

## 10. Data decisions (settled 2026-11-20 from `scripts/inspect_sf.py`, release 2026-11-18.0)

**Neighborhoods vs hexes → hexes, merged by name.** Overture has `division_area` outlines for only ~16 SF neighborhoods (Hayes Valley, SoMa, Noe Valley...), plus plazas; Marina, Castro, Mission, North Beach, Financial District etc. have no outline. The SF city outline exists, but as the *county* "San Francisco" (consolidated city-county), not a locality. Overture does have ~90 neighborhood/macrohood/microhood **label points**. So `build_zones.py`:
1. covers SF land with H3 res-8 hexes (~0.74 km²), clipped to the coast (183 hexes);
2. names each hex after the nearest label point (plazas excluded), or after a big park (Presidio, Golden Gate Park, Lake Merced, McLaren) covering ≥ 50% of it — the smallest park wins, so the Presidio isn't called "Golden Gate National Recreation Area";
3. drops 18 hexes: 11 nearly empty (< 200 est. people and < 10 places: coast, slivers) and 7 more than 1.5 km from any label (Treasure Island / Yerba Buena Island, a few coastal edges);
4. merges hexes with the same name into one zone → **76 zones** (inside the 30–120 target).
Trade-off: names are approximate (nearest-point boundaries, not official ones), and zone sizes vary (1–7 hexes). Merging was chosen over 165 hex zones named "Mission · NE 2": players think "buy ads in the Mission". Ad prices scale with people, so bigger zones aren't a free lunch. Treasure Island is a cut.

**Building heights → good.** 96% of SF buildings have `height`, 2% have `num_floors`. Floors = `num_floors`, else `round(height / 3.5)`, else 2, so People (H) is a reasonable proxy.

**Sparse labels.** `campus` and `kindergarten` have 0 SF places in this release and were removed from `categories.json`. Thin but kept as minor weights: `dog_park` 25, `swimming_pool` 23, `department_store` 23, `toys_and_games_store` 34, `shopping_mall` 35. Every product still has ≥ 2 demand labels with 100+ places, except pet food, which leans on `animal_or_pet_service` (226) and `park` (637). Watch it in the balance script.

**Duplicates and junk → minor.** 77.5k places in the box → 64k after: inside SF, confidence ≥ 0.5, not closed (3.8k were permanently closed), and same-name-within-30 m dedupe (142 removed).

**Output size:** 220 KB total in `public/data/` (target < 3 MB).

# Status and handoff

Last updated 2026-11-22. Read this first when picking the project up on another computer or in a new Claude session.

## Decisions so far
- Project: **Ad Empire SF** (working title), an ad-spend tycoon game. Full design and scoring model in [DESIGN.md](DESIGN.md).
- v1: ads by San Francisco neighborhood, 20 products, 90-day run, static site on Render.
- Research behind the idea: [research-notes.md](research-notes.md).

## Where the work is
Moved to a Mac mini on 2026-11-20 (the Windows desktop wasn't workable). Built-in Python 3.9 works fine with DuckDB 1.4; no new installs needed.
Repo: private GitHub repo `alexpopa/ad-empire-sf` (push over SSH). `data/raw/` and `.venv/` are git-ignored.

Build order from DESIGN.md section 9:
1. **Data: done.** `scripts/extract.py` downloads the SF slice (~80 s), `scripts/inspect_sf.py` reports on it, `scripts/build_zones.py` writes `public/data/` (76 zones, 220 KB). Decisions in DESIGN.md section 10.
2. **Simulation engine: done (2026-11-21).** `src/sim/` (pure TypeScript, no UI), 51 tests passing (`npm test`), economy check with `npm run report`. Tuned against real data; what changed and why is in DESIGN.md 6.11. Full balance script (many seeded runs, bots) still to do, once more logic exists.
3. **Map: done (2026-11-21).** MapLibre + OpenFreeMap basemap, zones colored by score in 5 validated blue steps with a legend, hover tooltip (name + score), click for the "why" panel (fit, competition, price, cost/customers/profit per level, real place names). Phone layout: bottom sheet, map recenters on the selected zone. A temporary product picker in the top bar stands in for the start screen. `?product=late_night&zone=mission` opens a specific view. Checked by screenshot in Chrome (desktop + phone, dev + production build).
4. **Game loop: done (2026-11-22).** Top bar (day, cash, profit/day, pause/1x/2x/4x/+1 day, Space pauses), buy ads from the neighborhood panel (Off/Low/Medium/High with live cost, awareness meter, yesterday's result), Campaigns tab (sortable, worst first, change level inline), Suggestions tab on Easy only, Events tab, event toasts, below-$0 warning banner, campaign outlines + L/M/H badges on the map. Starts paused on day 0.
5. **Start/end screens, hints, events: done (2026-11-22).** Start: brand name (random default), 6 product cards, Hard/Easy (Hard default), Continue a saved run. End: final cash, profit, ad spend, customers, cash-over-time chart with hover, best neighborhoods and money losers, a tip that depends on why you went bankrupt. First-run "How to play" card, shown once. Run saved to localStorage after every change.
   Tested with scripted playthroughs in Chrome (Easy desktop, Hard phone, production build, save/reload/continue): no errors. Not tested: real phones, Safari/Firefox.
   **Next:** deploy (step 6), then balance and polish.
   **Map layers (2026-11-22):** the legend opens a "Map layers" picker listing all 38 place types in the data, grouped by theme, with search. Picking one colors each neighborhood by that type's places per km² (4 orange steps by quartile, gray for none; hover shows count and density). Hard starts with a plain map and has no fit-score layer; Easy starts on the fit score and can switch. Code: `src/layers.ts`, `src/LayersPanel.tsx`. Checked by screenshot in Chrome (Hard and Easy, desktop and phone): no errors.
   **UI overhaul (2026-11-22): one screen.** The map fills the window the whole time and is mounted once; everything else floats over it, and nothing shows until it's needed. Menu card over a plain map (Continue / New game); New game asks one thing per step (product → name → difficulty). In play, one pill at the top: brand, day, cash, profit/day, play/pause, speed. Clicking the brand opens a dropdown with Campaigns / Events / Map colors (+ Suggestions on Easy) and Main menu. Neighborhood card floats top-right (bottom sheet on phones), closes on Esc or a click on empty map. Legend only when the map is colored. Results are a card over the map. Map colors are saved with the run. Files: `App.tsx` (shell), `Menu.tsx`, `GameHud.tsx`, `Lists.tsx`; `StartScreen`/`GameScreen`/`Sidebar` are gone. Checked by scripted Chrome runs (desktop + phone: new game, buy, dropdown, map colors, run clock, reload + Continue, results, Play again): no errors. Not tested: real phones, Safari/Firefox.
   **Map button + multi-select (2026-11-22):** what the map shows moved out of the brand dropdown into its own floating button bottom-left, which names the current view with a mini color ramp; hovering it shows the key, clicking opens the picker (bottom sheet on phones). Place types are checkboxes: tick several and each neighborhood is colored by their combined count per km²; hover shows the split ("5 beauty stores, 4 pharmacies"). Fit score is a separate toggle on Easy. Old saves with a single layer still load. Fixed: a long list squashed the dropdown's tab row out of sight. Phones start with the map credits collapsed behind (i). Checked by scripted Chrome runs, desktop + phone: no errors.
   **Deeper gameplay (2026-11-22).** 20 products in 5 groups, each tagged Starter / Tricky / Expert (was 6). Every product now has customers, **stockists** (stores that carry it; a place type can also be a competitor at the same time) and competitors, plus **decoys** that look relevant but don't matter. Each neighborhood has **Out-of-home and Digital checkboxes** (tick either, both or neither) plus one level (2026-11-23: replaced four formats and a weekly schedule, see DESIGN.md 6.12). Three difficulties: Easy (everything shown), **Normal** (new default suggestion: audience + 1–2 hints, estimates unlock after a week of ads in a neighborhood), Hard (no estimates at all). A week of ads in a neighborhood teaches one new thing ("Juice bars compete with you"); the new "What you know" tab lists it all. The map picker now has ~110 place types in 12 groups, from `categories.json` (`layers`); data rebuilt (zones.json 98 KB, examples.json 300 KB). Rules and tuning history in DESIGN.md 5, 6.12, 6.13. Old saved games migrate (to out-of-home ads). 155 tests pass; `npm run report` covers all 20 products. Checked by scripted Chrome runs (Normal desktop: buy cheap ads, run 9 days, insight toast and tab; Easy desktop: zone panel and suggestions; Hard phone: menu and zone panel): no errors, no sideways scroll on phones. Not tested: real phones, Safari/Firefox, a full 90-day game by hand.
6. Polish, deploy, README.

## Deploy notes (for step 6)
- Plan: Render **static site** on the free tier (static sites don't sleep, unlike free web services). No backend.
- **`render.yaml` added (2026-11-22)**: Render Blueprint for a free static site. Build `npm ci && npm run build`, publish `dist`, Node 24 (also pinned in `.node-version`), long cache on hashed `/assets/*`. Clean install + build checked locally. **Deployed 2026-11-22: https://ad-empire-sf.onrender.com** (build passes; page, JS/CSS and `public/data/` files all load; map rendering in a real browser not yet checked).
- To deploy: Render dashboard → New → Blueprint → pick `alexpopa/ad-empire-sf` → Apply. Pushes to `main` redeploy automatically. The map data in `public/data/` is committed, so the build needs no Python or Overture download.
- Render needs Alexandru's account connected to the GitHub repo `alexpopa/ad-empire-sf` (currently private; Render can read private repos once GitHub access is granted).
- After deploy, check the map actually renders on the live URL (the MapLibre worker gotcha in "Run the app" broke production once).
- Nothing private goes in render.yaml, the site, or commit messages (see CLAUDE.local.md).

## Open questions
- The map picker now has ~110 place types (2026-11-22), still not all 260 of Overture's SF categories (banks, law firms, places of worship… are left out). Quick win without touching the pipeline: People per km² and Transit stops per km² as map options (DESIGN.md 11.1).
- If a browser has no WebGL2 the map throws and the whole page is blank (same before the overhaul). Add an error boundary with a plain "your browser can't show the map" card.
- On phones the opening map view is small (SF fits the width). Consider starting a little zoomed in.
- Only 9-15 of 76 zones are worth advertising in per product, and Low is almost never the best level (the $15/day fee makes small campaigns poor value); Medium and High split the rest.
- Checked only by the balance report and scripted screenshots: whether ticking both feels worth it in play, and whether the "strong / average / weak here" hints are enough to choose without estimates. Revisit in the balance pass (DESIGN.md 6.11, 6.12).
- Product weights for the 14 new products are first guesses, checked only by the balance report, not by playing each one. Some signals are thin in the data (ticket booths: 9 places, souvenir shops: 14), so those mostly act as flavor.
- Overture quirks show up in hints: e.g. a "beach" place in the Financial District (a business with that category), which makes hard seltzer's top zone downtown.
- Playtest finding: on Hard, one good campaign still goes bankrupt because the $120/day running cost needs ~5 campaigns to cover. The hints and end-screen tip now say so; consider whether the early game is too punishing.
- ~~Hard mode still shows each neighborhood's score on click.~~ Fixed 2026-11-22: Hard never shows scores or estimates; Normal shows them after a week of ads there.

## Run the app

```
npm install
npm run dev       # always http://localhost:5174 (pinned, 127.0.0.1 only; fails rather than moving port)
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
- 2026-11-22: **Hard mode map is plain.** Fit colors made Hard too easy ("Medium in the top 10 by score" is near perfect). Instead players color the map by any place type's density and work out which ones matter for their product. The picker groups by theme, not "customers vs competitors", so it doesn't hand that answer over either. Density is per zone (counts per km²), not individual place dots: the map ships zone counts only, keeping the data small.
- 2026-11-22: **One screen, nothing on it until you click.** The separate start screen, top bar and sidebar are gone; the map is always the background and controls float over it. Cut in the process: the "+1 day" step button and the zoom +/- buttons (scroll, pinch and double-click still zoom). Speed is one button that cycles 1×/2×/4×.
- 2026-11-22: **Several place types are added together, not shown side by side.** "Beauty stores + pharmacies" answers "where is my product sold?" with one color ramp anyone can read. Showing two types as separate color layers (bivariate maps, dots) would show how they differ but is much harder to read at a glance; the hover tooltip gives the per-type split instead.
- 2026-11-22: **More products, each with hidden structure, instead of more of the same.** 20 products where some place types draw buyers, some carry the product, some compete, some are both, and some are red herrings. The map picker groups place types by theme, never by role, so the map can mislead a careless player. Cut: per-product hand-tuning by playtest (weights checked by the balance report only).
- 2026-11-22: **Difficulty is about information, not numbers.** The economy is identical on Easy, Normal and Hard; what changes is what you're told, and you learn the rest by running ads (one insight per neighborhood per week). Low digital ads became the cheap way to test a neighborhood.
- 2026-11-23: **Two stackable ad channels, no schedules.** Four formats plus every-day / Mon–Fri / Fri–Sun balanced in the numbers but made every neighborhood three decisions. A first cut to "local or online, pick one" left Online as a cheaper copy of Local that never won. Now Out-of-home (foot traffic and stores, downtown premium, spills over) and Digital (follows your buyers, no premium, no spillover) are checkboxes that stack, each with its own awareness. Best choice splits roughly both 106 / out-of-home 85 / digital 54 neighborhoods across the 20 products. Named with advertising terms: "Local" was dropped because in advertising it usually means local TV. Lost: the weekly rhythm (offices on weekdays, bars on weekends).
- Zones are H3 hexes named after the nearest Overture neighborhood point and merged by name, because Overture outlines only ~16 SF neighborhoods. Names are approximate.
- Treasure Island / Yerba Buena Island dropped: no Overture neighborhood label within 1.5 km.
- `campus` and `kindergarten` labels removed: 0 SF places.

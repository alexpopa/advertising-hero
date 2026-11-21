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
2. **Next:** simulation module (`src/sim/`) + Vitest tests, before any UI. Balance script later, once there's enough logic to balance.
3. Map with score colors and "why" panel.
4. Game loop.
5. Start/end screens (incl. Easy/Hard choice), hints, events.
6. Polish, deploy, README.

## Open questions
- Hard mode: keep the fit colors on the map, or remove them / show something neutral? Alexandru wants to see the map working first, then decide (2026-11-21).

## Rerun the data pipeline (macOS)

```
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/extract.py        # downloads into data/raw/ (not committed)
python scripts/inspect_sf.py     # optional data-quality report
python scripts/build_zones.py    # writes public/data/
```

## Trade-offs and cuts logged so far (for the README)
- 2026-11-21: recommendations moved behind an **Easy** mode; **Hard** is the default and shows none. Always-on recommendations would just hand players the answer.
- Zones are H3 hexes named after the nearest Overture neighborhood point and merged by name, because Overture outlines only ~16 SF neighborhoods. Names are approximate.
- Treasure Island / Yerba Buena Island dropped: no Overture neighborhood label within 1.5 km.
- `campus` and `kindergarten` labels removed: 0 SF places.

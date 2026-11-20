# Status and handoff

Last updated 2026-11-20. Read this first when picking the project up on another computer or in a new Claude session.

## Decisions so far
- Project: **Ad Empire SF** (working title), an ad-spend tycoon game. Full design and scoring model in [DESIGN.md](DESIGN.md).
- v1: online brand only, ads by San Francisco neighborhood, 6 products, 90-day run, static site on Render.
- Research behind the idea: [research-notes.md](research-notes.md).

## Where the work is
Build order from DESIGN.md section 9:
1. **Extraction script: written, not yet run.** `scripts/extract.py` (download SF slice), `scripts/inspect_sf.py` (report on data quality), `scripts/categories.json` (products and weights).
2. Simulation module + tests + balance script.
3. Map with score colors and "why" panel.
4. Game loop.
5. Start/end screens, hints, events.
6. Polish, deploy, README.

## Next step
On a computer with Python 3.10+:

```
python -m venv .venv
.venv\Scripts\activate          (Windows)  or  source .venv/bin/activate  (macOS/Linux)
pip install -r requirements.txt
python scripts/extract.py
python scripts/inspect_sf.py
```

Then use the inspect report to answer DESIGN.md section 10 (neighborhoods vs hexes, building height coverage, sparse product categories) and write `scripts/build_zones.py`.

Note: `scripts/extract.py` has not been run yet, so expect small fixes (Overture column names or DuckDB function details).

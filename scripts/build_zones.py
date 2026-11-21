"""Turn the raw Overture SF slice (data/raw/) into the small files the game ships (public/data/).

How zones are made (see DESIGN.md section 10 for why):
  1. Cover San Francisco's land with H3 resolution-8 hexagons (~0.74 km2), clipped to the coast.
  2. Name each hex after the nearest Overture neighborhood label point, or after a big park
     if one covers at least half of it. (Overture has outlines for only ~16 SF neighborhoods,
     but label points for ~90.)
  3. Drop hexes that are nearly empty, or too far from any label to name honestly.
  4. Merge hexes with the same name into one zone. Players buy ads in "Mission", not "hex 42".

Writes:
  public/data/zones.geojson   zone polygons: id, name
  public/data/zones.json      per-zone inputs (DESIGN.md 6.2) + adjacency
  public/data/examples.json   up to 5 real place names per zone per label
  public/data/meta.json       release, date, counts, method, attribution

Usage: python scripts/build_zones.py      (run scripts/extract.py first)
"""

from __future__ import annotations

import json
import re
import time
from collections import defaultdict
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
RAW = (ROOT / "data" / "raw").as_posix()
OUT = ROOT / "public" / "data"
CATS = json.loads((ROOT / "scripts" / "categories.json").read_text())

H3_RES = 8
MIN_HEX_KM2 = 0.15           # drop coastal slivers smaller than ~20% of a hex
MIN_HEX_PEOPLE = 200         # drop hexes that are nearly empty ...
MIN_HEX_PLACES = 10          # ... (fewer than this many people AND places)
MAX_LABEL_KM = 1.5           # a hex farther than this from any label point is dropped (no honest name)
MIN_CONFIDENCE = 0.5
DEDUPE_METERS = 30
M_PER_FLOOR = 3.5
DEFAULT_FLOORS = 2
M2_PER_PERSON = 60           # only used here for the empty-hex filter; the game has its own constant
PARK_SHARE_FOR_NAME = 0.5    # a hex is named after a park if the park covers half its land
PARK_MIN_M2 = 1_000_000      # only big parks name hexes (Presidio, Golden Gate Park, ...)
EXAMPLES_PER_LABEL = 5
KM_PER_DEG_LAT = 111.32
KM_PER_DEG_LON = 88.2        # at SF's latitude
# Microhood points that are plazas or courtyards, not neighborhoods.
NOT_A_NEIGHBORHOOD = re.compile(r"Plaza|Courtyard|Mini Park|Piazza|Foundry Square|Portsmouth Square|Public Square")
ALBERS = "ST_Transform({g}, 'EPSG:4326', 'EPSG:3310', always_xy := true)"


def used_labels() -> dict[str, set[str]]:
    """Labels the game needs, and which of them are competitor labels (need brand counts)."""
    labels, comp = set(), set()
    for p in CATS["products"].values():
        labels |= set(p["demand"]) | set(p["competitors"])
        comp |= set(p["competitors"])
    for ls in CATS.get("events", {}).values():
        labels |= set(ls)
    return {"all": labels, "competitors": comp}


def geom_expr(con, table: str) -> str:
    # DuckDB >= 1.4 reads the WKB column back as GEOMETRY; older versions give a BLOB.
    t = con.execute(f"SELECT typeof(geom_wkb) FROM '{RAW}/{table}.parquet' LIMIT 1").fetchone()[0]
    return "geom_wkb" if t == "GEOMETRY" else "ST_GeomFromWKB(geom_wkb)"


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def km(a: tuple[float, float], b: tuple[float, float]) -> float:
    return (((a[0] - b[0]) * KM_PER_DEG_LON) ** 2 + ((a[1] - b[1]) * KM_PER_DEG_LAT) ** 2) ** 0.5


def main() -> None:
    t0 = time.time()
    OUT.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.load_extension("spatial")
    con.execute("INSTALL h3 FROM community; LOAD h3;")
    labels = used_labels()
    release = json.loads(Path(RAW, "release.json").read_text())

    # --- City outline: SF is a consolidated city-county; Overture stores it as the county.
    g = geom_expr(con, "divisions")
    con.execute(f"""CREATE TABLE city AS SELECT {g} AS geom FROM '{RAW}/divisions.parquet'
        WHERE subtype = 'county' AND name = 'San Francisco' AND is_land""")
    assert con.execute("SELECT count(*) FROM city").fetchone()[0] == 1, "SF county outline not found"

    # --- 1. Hex grid: every res-8 cell in the city's padded bounding box, clipped to land.
    # (Polyfill the box, not the outline: the outline is a multipolygon with islands and the
    # H3 polyfill only accepts single polygons.)
    con.execute(f"""CREATE TABLE cells AS SELECT unnest(h3_polygon_wkt_to_cells(
        ST_AsText(ST_Envelope(ST_Buffer(geom, 0.015))), {H3_RES})) AS cell FROM city""")
    con.execute("""CREATE TABLE hexes AS
        WITH c AS (SELECT h3_h3_to_string(cell) AS hex, ST_GeomFromText(h3_cell_to_boundary_wkt(cell)) AS g FROM cells)
        SELECT hex, ST_Intersection(c.g, city.geom) AS geom FROM c, city WHERE ST_Intersects(c.g, city.geom)""")
    con.execute(f"ALTER TABLE hexes ADD COLUMN area_km2 DOUBLE")
    con.execute(f"UPDATE hexes SET area_km2 = ST_Area({ALBERS.format(g='geom')}) / 1e6")
    n_hex_grid = con.execute("SELECT count(*) FROM hexes").fetchone()[0]
    con.execute(f"DELETE FROM hexes WHERE area_km2 < {MIN_HEX_KM2}")

    def assign(table: str, src: str, cols: str, where: str = "TRUE") -> None:
        """Points inside the city, tagged with their hex."""
        con.execute(f"""CREATE TABLE {table} AS
            SELECT {cols}, h3_h3_to_string(h3_latlng_to_cell(lat, lon, {H3_RES})) AS hex
            FROM '{RAW}/{src}.parquet', city
            WHERE {where} AND ST_Contains(city.geom, ST_Point(lon, lat))""")

    # Buildings -> floor area. Floors: num_floors, else height / 3.5 m, else 2.
    assign("b", "buildings", f"""area_m2 * greatest(1, coalesce(num_floors,
        round(height / {M_PER_FLOOR}), {DEFAULT_FLOORS})) AS floor_m2,
        num_floors IS NOT NULL AS has_floors, height IS NOT NULL AS has_height""")
    assign("t", "transit", "id, class")
    # Places: open or unknown status, confidence >= 0.5, then dedupe same name within 30 m.
    assign("p0", "places", "id, name, lower(trim(name)) AS nname, basic_category, hierarchy, confidence, brand, lon, lat",
           f"confidence >= {MIN_CONFIDENCE} AND coalesce(operating_status, 'open') NOT IN ('permanently_closed', 'temporarily_closed')")
    con.execute(f"""CREATE TABLE dupes AS
        SELECT DISTINCT b.id FROM p0 a JOIN p0 b ON a.nname = b.nname AND a.id < b.id
        WHERE abs(a.lat - b.lat) * {KM_PER_DEG_LAT * 1000} < {DEDUPE_METERS}
          AND sqrt(power((a.lat - b.lat) * {KM_PER_DEG_LAT * 1000}, 2)
                 + power((a.lon - b.lon) * {KM_PER_DEG_LON * 1000}, 2)) < {DEDUPE_METERS}""")
    con.execute("CREATE TABLE p AS SELECT * FROM p0 WHERE id NOT IN (SELECT id FROM dupes)")
    n_raw, n_dupes = con.execute("SELECT (SELECT count(*) FROM p0), (SELECT count(*) FROM dupes)").fetchone()

    # --- 2. Name each hex.
    pts = [(r[0], (r[1], r[2])) for r in con.execute(
        f"SELECT name, lon, lat FROM '{RAW}/division_points.parquet' WHERE name IS NOT NULL").fetchall()
        if not NOT_A_NEIGHBORHOOD.search(r[0])]
    pg = geom_expr(con, "parks")
    # If several big parks cover a hex (e.g. the Presidio sits inside the Golden Gate National
    # Recreation Area), the smallest, most specific one wins.
    park_names = dict(con.execute(f"""
        SELECT h.hex, arg_min(pk.name, pk.area_m2)
        FROM hexes h, (SELECT name, area_m2, {pg} AS g FROM '{RAW}/parks.parquet' WHERE area_m2 > {PARK_MIN_M2}) pk
        WHERE ST_Intersects(h.geom, pk.g)
          AND ST_Area(ST_Intersection(h.geom, pk.g)) / ST_Area(h.geom) >= {PARK_SHARE_FOR_NAME}
        GROUP BY h.hex""").fetchall())
    centers = {r[0]: (r[1], r[2]) for r in con.execute(
        "SELECT hex, ST_X(ST_Centroid(geom)), ST_Y(ST_Centroid(geom)) FROM hexes").fetchall()}

    people = {r[0]: r[1] / M2_PER_PERSON for r in con.execute("SELECT hex, sum(floor_m2) FROM b GROUP BY 1").fetchall()}
    nplaces = dict(con.execute("SELECT hex, count(*) FROM p GROUP BY 1").fetchall())
    hex_name, dropped = {}, defaultdict(list)
    for h, c in centers.items():
        if people.get(h, 0) < MIN_HEX_PEOPLE and nplaces.get(h, 0) < MIN_HEX_PLACES:
            dropped["nearly empty"].append(h)
            continue
        if h in park_names:
            hex_name[h] = park_names[h]
            continue
        name, pos = min(pts, key=lambda q: km(c, q[1]))
        if km(c, pos) > MAX_LABEL_KM:
            dropped["no neighborhood label nearby"].append(h)
            continue
        hex_name[h] = name
    for why, hs in dropped.items():
        print(f"  dropped {len(hs)} hexes ({why}) near "
              + ", ".join(sorted({min(pts, key=lambda q: km(centers[h], q[1]))[0] for h in hs})))

    # --- 3/4. Merge hexes into named zones.
    zone_of = {h: slug(n) for h, n in hex_name.items()}
    con.execute("CREATE TABLE hz (hex VARCHAR, zone VARCHAR, name VARCHAR)")
    con.executemany("INSERT INTO hz VALUES (?, ?, ?)", [(h, zone_of[h], n) for h, n in hex_name.items()])
    for t in ("b", "t", "p"):
        con.execute(f"CREATE TABLE {t}z AS SELECT {t}.*, hz.zone FROM {t} JOIN hz USING (hex)")
    con.execute(f"""CREATE TABLE zones AS
        SELECT hz.zone AS id, any_value(hz.name) AS name, count(*) AS hexes,
               sum(h.area_km2) AS area_km2, ST_Union_Agg(h.geom) AS geom, list(h.hex) AS hex_list
        FROM hz JOIN hexes h USING (hex) GROUP BY hz.zone""")

    # Place x label matches (a place matches a label if it is its basic_category or in its hierarchy).
    lab_list = ", ".join(f"'{l}'" for l in sorted(labels["all"]))
    con.execute(f"""CREATE TABLE pl AS
        SELECT pz.*, l.label FROM pz, (SELECT unnest([{lab_list}]) AS label) l
        WHERE pz.basic_category = l.label OR list_contains(pz.hierarchy, l.label)""")

    def by_zone(sql):
        return {r[0]: r[1:] for r in con.execute(sql).fetchall()}

    bld = by_zone("SELECT zone, sum(floor_m2), count(*) FROM bz GROUP BY 1")
    trn = by_zone("SELECT zone, count(*) FROM tz GROUP BY 1")
    allp = by_zone("SELECT zone, count(*) FROM pz GROUP BY 1")
    counts, branded = defaultdict(dict), defaultdict(dict)
    for z, lab, n, nb in con.execute("SELECT zone, label, count(*), count(brand) FROM pl GROUP BY 1, 2").fetchall():
        counts[z][lab] = n
        if lab in labels["competitors"] and nb:
            branded[z][lab] = nb

    # Adjacency: two zones are neighbors if any of their hexes touch.
    neighbors = defaultdict(set)
    for h, ring in con.execute(
            "SELECT hex, list_transform(h3_grid_disk(h3_string_to_h3(hex), 1), x -> h3_h3_to_string(x)) FROM hz").fetchall():
        for r in ring:
            if r in zone_of and zone_of[r] != zone_of[h]:
                neighbors[zone_of[h]].add(zone_of[r])

    zones = []
    for zid, name, nhex, area, lon, lat in con.execute("""
            SELECT id, name, hexes, area_km2, ST_X(ST_PointOnSurface(geom)), ST_Y(ST_PointOnSurface(geom))
            FROM zones ORDER BY name""").fetchall():
        zones.append({
            "id": zid,
            "name": name,
            "hexes": nhex,
            "center": [round(lon, 5), round(lat, 5)],
            "area": round(area, 4),
            "floorArea": round(bld.get(zid, (0, 0))[0] or 0),
            "buildings": bld.get(zid, (0, 0))[1],
            "transit": trn.get(zid, (0,))[0],
            "nAll": allp.get(zid, (0,))[0],
            "n": dict(sorted(counts[zid].items())),
            "nBranded": dict(sorted(branded[zid].items())),
            "neighbors": sorted(neighbors[zid]),
        })

    # Examples: highest-confidence named places per zone per label, for the "why" panel.
    examples = defaultdict(dict)
    for z, lab, names in con.execute(f"""
            SELECT zone, label, list(DISTINCT name ORDER BY name)[1:{EXAMPLES_PER_LABEL}] FROM (
                SELECT zone, label, name, row_number() OVER (PARTITION BY zone, label ORDER BY confidence DESC, name) AS rk
                FROM pl WHERE name IS NOT NULL) WHERE rk <= {EXAMPLES_PER_LABEL * 2}
            GROUP BY 1, 2""").fetchall():
        examples[z][lab] = names

    # GeoJSON: simplified zone polygons, 5-decimal coordinates (~1 m).
    def rnd(c):
        return [round(c[0], 5), round(c[1], 5)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]

    features = []
    for zid, name, gj in con.execute(
            "SELECT id, name, ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0001)) FROM zones ORDER BY id").fetchall():
        geom = json.loads(gj)
        geom["coordinates"] = rnd(geom["coordinates"])
        features.append({"type": "Feature", "properties": {"id": zid, "name": name}, "geometry": geom})

    b_tot, b_floors, b_height = con.execute(
        "SELECT count(*), count(*) FILTER (has_floors), count(*) FILTER (has_height) FROM bz").fetchone()
    meta = {
        "overtureRelease": release["release"],
        "extracted": release["extracted"],
        "built": time.strftime("%Y-%m-%d"),
        "zoneMethod": (f"H3 resolution-{H3_RES} hexagons clipped to San Francisco's land (Overture divisions, "
                       "county 'San Francisco'), each named after the nearest Overture neighborhood label point "
                       "(or a large park covering half of it), then merged by name."),
        "counts": {
            "zones": len(zones),
            "hexesInGrid": n_hex_grid,
            "hexesUsed": len(hex_name),
            "hexesDropped": {k: len(v) for k, v in dropped.items()},
            "places": con.execute("SELECT count(*) FROM pz").fetchone()[0],
            "placesBeforeDedupe": n_raw,
            "duplicatesRemoved": n_dupes,
            "buildings": b_tot,
            "buildingsWithHeight": b_height,
            "buildingsWithFloors": b_floors,
            "transitStops": con.execute("SELECT count(*) FROM tz").fetchone()[0],
        },
        "labels": sorted(labels["all"]),
        "attribution": "© Overture Maps Foundation, © OpenStreetMap contributors",
    }

    def write(name, obj):
        path = OUT / name
        path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
        print(f"  {path.relative_to(ROOT)}  {path.stat().st_size / 1024:,.0f} KB")

    c = meta["counts"]
    print(f"{c['zones']} zones from {c['hexesUsed']} hexes | {c['places']:,} places ({n_dupes:,} duplicates removed) | "
          f"{b_tot:,} buildings ({b_height / b_tot:.0%} with height) | {c['transitStops']:,} transit stops")
    write("zones.geojson", {"type": "FeatureCollection", "features": features})
    write("zones.json", {"zones": zones})
    write("examples.json", examples)
    write("meta.json", meta)
    print(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()

"""Print a quick report on the extracted SF data, to answer DESIGN.md section 10:

- Are Overture's SF neighborhoods complete and non-overlapping?
- How many buildings have height / num_floors?
- Do the product labels in categories.json have enough SF places?
- How bad are duplicates?

Usage: python scripts/inspect_sf.py
"""

from __future__ import annotations

import json
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
RAW = (ROOT / "data" / "raw").as_posix()
CATS = json.loads((ROOT / "scripts" / "categories.json").read_text())


def q(con, sql):
    return con.execute(sql).fetchall()


def main() -> None:
    con = duckdb.connect()
    con.install_extension("spatial")
    con.load_extension("spatial")
    con.execute(f"CREATE VIEW places AS SELECT * FROM '{RAW}/places.parquet'")
    con.execute(f"CREATE VIEW buildings AS SELECT * FROM '{RAW}/buildings.parquet'")
    con.execute(f"CREATE VIEW transit AS SELECT * FROM '{RAW}/transit.parquet'")
    # DuckDB >= 1.4 reads the WKB column back as GEOMETRY already; older versions give a BLOB.
    gtype = q(con, f"SELECT typeof(geom_wkb) FROM '{RAW}/divisions.parquet' LIMIT 1")[0][0]
    gexpr = "geom_wkb" if gtype == "GEOMETRY" else "ST_GeomFromWKB(geom_wkb)"
    con.execute(f"""CREATE TABLE div AS
        SELECT * EXCLUDE geom_wkb, {gexpr} AS geom FROM '{RAW}/divisions.parquet'""")

    print("\n== Divisions ==")
    for row in q(con, "SELECT subtype, count(*), sum(CASE WHEN is_land THEN 1 ELSE 0 END) FROM div GROUP BY 1 ORDER BY 2 DESC"):
        print(f"  {row[0]:<14} {row[1]:>5}  (is_land: {row[2]})")
    sf = q(con, "SELECT id, name, ST_Area(ST_Transform(geom,'EPSG:4326','EPSG:3310',always_xy:=true))/1e6 FROM div "
                "WHERE subtype='locality' AND name ILIKE 'San Francisco' ORDER BY 3 DESC")
    print("  SF locality candidates:", [(r[1], round(r[2], 1)) for r in sf])
    if sf:
        con.execute(f"CREATE TABLE city AS SELECT geom FROM div WHERE id = '{sf[0][0]}'")
        for st in ("macrohood", "neighborhood", "microhood"):
            con.execute(f"""CREATE OR REPLACE TABLE z AS
                SELECT d.name, ST_Intersection(d.geom, c.geom) AS g FROM div d, city c
                WHERE d.subtype = '{st}' AND d.is_land AND ST_Intersects(d.geom, c.geom)""")
            n, cover = q(con, """SELECT count(*),
                sum(ST_Area(ST_Transform(g,'EPSG:4326','EPSG:3310',always_xy:=true)))/1e6 FROM z""")[0]
            union = q(con, "SELECT ST_Area(ST_Transform(ST_Union_Agg(g),'EPSG:4326','EPSG:3310',always_xy:=true))/1e6 FROM z")[0][0]
            city = sf[0][2]
            if n:
                print(f"  {st:<13} {n:>4} zones | sum area {cover:6.1f} km2 | union {union:6.1f} km2 "
                      f"| city {city:6.1f} km2 | overlap {cover - union:5.1f} km2 | coverage {union / city:5.0%}")
                print("     e.g.", ", ".join(r[0] for r in q(con, "SELECT name FROM z ORDER BY random() LIMIT 8")))
            else:
                print(f"  {st:<13}    0 zones")

    print("\n== Buildings ==")
    n, h, f, a = q(con, "SELECT count(*), count(height), count(num_floors), sum(area_m2) FROM buildings")[0]
    print(f"  {n:,} buildings | height {h / n:.0%} | num_floors {f / n:.0%} | footprint {a / 1e6:.1f} km2")

    print("\n== Transit ==")
    for r in q(con, "SELECT class, count(*) FROM transit GROUP BY 1 ORDER BY 2 DESC"):
        print(f"  {r[0]:<16} {r[1]:>6,}")

    print("\n== Places ==")
    n, c50, c85 = q(con, "SELECT count(*), count(*) FILTER (confidence >= 0.5), count(*) FILTER (confidence >= 0.85) FROM places")[0]
    print(f"  {n:,} places | conf>=0.5: {c50:,} | conf>=0.85: {c85:,}")
    print("  status:", q(con, "SELECT operating_status, count(*) FROM places GROUP BY 1 ORDER BY 2 DESC"))
    dup = q(con, """
        WITH p AS (SELECT lower(trim(name)) AS n, lon, lat FROM places WHERE name IS NOT NULL AND confidence >= 0.5)
        SELECT count(*) FROM (SELECT n, round(lon, 3), round(lat, 3), count(*) c FROM p GROUP BY ALL HAVING c > 1)""")[0][0]
    print(f"  same name in the same ~100 m cell (rough duplicate groups): {dup:,}")

    print("\n== Product labels (places with conf>=0.5, open or unknown status) ==")
    for key, p in CATS["products"].items():
        print(f"  {p['name']}")
        for kind in ("demand", "competitors"):
            for label in p[kind]:
                cnt = q(con, f"""SELECT count(*) FROM places WHERE confidence >= 0.5
                    AND coalesce(operating_status,'open') = 'open'
                    AND (basic_category = '{label}' OR list_contains(hierarchy, '{label}'))""")[0][0]
                flag = "  <-- sparse" if cnt < 30 else ""
                print(f"    {kind[:4]} {label:<36} {cnt:>6,}{flag}")


if __name__ == "__main__":
    main()

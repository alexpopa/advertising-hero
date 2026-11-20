"""Download the San Francisco slice of Overture Maps into data/raw/.

Reads Overture's cloud-hosted GeoParquet directly with DuckDB (no account, no key)
and keeps only what the game needs:

  places.parquet         id, name, category, hierarchy, confidence, brand, status, lon, lat
  buildings.parquet      id, footprint area (m2), height, num_floors, lon, lat (centroid)
  transit.parquet        id, class, lon, lat
  divisions.parquet      locality + neighborhood-level areas with polygons (WKB)

Usage:
  python scripts/extract.py                 # latest release (from the STAC catalog)
  python scripts/extract.py --release 2026-11-18.0
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

# San Francisco (land part of the city), a little padded. Clipped to the city later.
BBOX = {"xmin": -122.53, "ymin": 37.70, "xmax": -122.35, "ymax": 37.84}

FALLBACK_RELEASE = "2026-11-18.0"
STAC_URL = "https://stac.overturemaps.org/catalog.json"
S3 = "s3://overturemaps-us-west-2/release/{release}/theme={theme}/type={type}/*"

TRANSIT_CLASSES = (
    "bus_stop", "bus_station", "platform", "stop_position",
    "railway_station", "railway_halt", "ferry_terminal", "subway_station",
)


def latest_release() -> str:
    """Find the newest release id in the STAC catalog; fall back to a known one."""
    try:
        with urllib.request.urlopen(STAC_URL, timeout=20) as r:
            text = r.read().decode("utf-8")
        found = sorted(set(re.findall(r"\d{4}-\d{2}-\d{2}\.\d+", text)))
        if found:
            return found[-1]
    except Exception as e:  # network or format problem: use the fallback
        print(f"  could not read STAC catalog ({e}); using {FALLBACK_RELEASE}")
    return FALLBACK_RELEASE


def bbox_filter() -> str:
    b = BBOX
    return (
        f"bbox.xmin <= {b['xmax']} AND bbox.xmax >= {b['xmin']} "
        f"AND bbox.ymin <= {b['ymax']} AND bbox.ymax >= {b['ymin']}"
    )


def connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    for ext in ("httpfs", "spatial"):
        con.install_extension(ext)
        con.load_extension(ext)
    con.execute("SET s3_region='us-west-2'")
    return con


def run(con, name: str, sql: str, out: Path) -> None:
    t = time.time()
    print(f"- {name} ...", flush=True)
    con.execute(f"COPY ({sql}) TO '{out.as_posix()}' (FORMAT parquet)")
    n = con.execute(f"SELECT count(*) FROM read_parquet('{out.as_posix()}')").fetchone()[0]
    print(f"  {n:,} rows in {time.time() - t:.0f}s -> {out.relative_to(ROOT)}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--release", help="Overture release id, e.g. 2026-11-18.0")
    args = ap.parse_args()

    release = args.release or latest_release()
    print(f"Overture release: {release}")
    RAW.mkdir(parents=True, exist_ok=True)
    con = connect()
    where = bbox_filter()

    def src(theme: str, type_: str) -> str:
        return f"read_parquet('{S3.format(release=release, theme=theme, type=type_)}', hive_partitioning=1)"

    run(con, "places", f"""
        SELECT id,
               names.primary              AS name,
               basic_category,
               taxonomy.primary           AS taxonomy_primary,
               taxonomy.hierarchy         AS hierarchy,
               confidence,
               brand.names.primary        AS brand,
               operating_status,
               ST_X(geometry)             AS lon,
               ST_Y(geometry)             AS lat
        FROM {src('places', 'place')}
        WHERE {where}
    """, RAW / "places.parquet")

    # Area in m2 via California Albers (EPSG:3310), an equal-area projection.
    run(con, "buildings", f"""
        SELECT id,
               ST_Area(ST_Transform(geometry, 'EPSG:4326', 'EPSG:3310', always_xy := true)) AS area_m2,
               height,
               num_floors,
               ST_X(ST_Centroid(geometry)) AS lon,
               ST_Y(ST_Centroid(geometry)) AS lat
        FROM {src('buildings', 'building')}
        WHERE {where}
    """, RAW / "buildings.parquet")

    classes = ", ".join(f"'{c}'" for c in TRANSIT_CLASSES)
    run(con, "transit stops", f"""
        SELECT id, class,
               ST_X(ST_Centroid(geometry)) AS lon,
               ST_Y(ST_Centroid(geometry)) AS lat
        FROM {src('base', 'infrastructure')}
        WHERE {where} AND subtype = 'transit' AND class IN ({classes})
    """, RAW / "transit.parquet")

    run(con, "divisions", f"""
        SELECT id, division_id, subtype, names.primary AS name, is_land, country,
               ST_AsWKB(geometry) AS geom_wkb
        FROM {src('divisions', 'division_area')}
        WHERE {where} AND country = 'US'
          AND subtype IN ('locality', 'localadmin', 'borough', 'macrohood', 'neighborhood', 'microhood')
    """, RAW / "divisions.parquet")

    (RAW / "release.json").write_text(json.dumps(
        {"release": release, "bbox": BBOX, "extracted": time.strftime("%Y-%m-%d")}, indent=2))
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())

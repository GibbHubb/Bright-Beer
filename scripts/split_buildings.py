"""
split_buildings.py
──────────────────
Splits amsterdam_buildings.geojson into a 4x4 grid of tiles.
Each tile is written to public/buildings/tile_{row}_{col}.json
and includes a top-level `bounds` object so useBuildingTiles.ts
can skip fetching tiles outside the viewport without parsing the file.

Also runs fetch_buildings.py first if the source file is missing.

Usage:
    python scripts/split_buildings.py

Grid layout (4 rows × 4 cols):
    Row 0 = north, Row 3 = south
    Col 0 = west,  Col 3 = east
"""

import json, os, sys, subprocess

# Must match AMSTERDAM_BOUNDS in src/constants/amsterdam.ts
# [west, south, east, north]
WEST, SOUTH, EAST, NORTH = 4.72, 52.28, 5.10, 52.43

ROWS = 8
COLS = 8

SOURCE = "public/buildings/amsterdam_buildings.geojson"
OUT_DIR = "public/buildings"

def tile_bounds(row: int, col: int) -> dict:
    lat_step = (NORTH - SOUTH) / ROWS
    lng_step = (EAST  - WEST)  / COLS
    s = SOUTH + row       * lat_step
    n = SOUTH + (row + 1) * lat_step
    w = WEST  + col       * lng_step
    e = WEST  + (col + 1) * lng_step
    return {"south": s, "north": n, "west": w, "east": e}

def feature_centroid(feat: dict) -> tuple[float, float]:
    coords = feat["geometry"]["coordinates"][0]
    lngs = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return sum(lngs) / len(lngs), sum(lats) / len(lats)

def assign_tile(lng: float, lat: float) -> tuple[int, int]:
    lat_step = (NORTH - SOUTH) / ROWS
    lng_step = (EAST  - WEST)  / COLS
    row = int((lat - SOUTH) / lat_step)
    col = int((lng - WEST)  / lng_step)
    row = max(0, min(ROWS - 1, row))
    col = max(0, min(COLS - 1, col))
    return row, col

def main():
    # Fetch if missing
    if not os.path.exists(SOURCE):
        print(f"{SOURCE} not found — running fetch_buildings.py first …")
        subprocess.run([sys.executable, "scripts/fetch_buildings.py"], check=True)

    print(f"Loading {SOURCE} …")
    with open(SOURCE, encoding="utf-8") as f:
        fc = json.load(f)

    features = fc["features"]
    print(f"  -> {len(features)} features loaded")

    # Sort into tile buckets
    tiles: dict[tuple[int,int], list] = {(r, c): [] for r in range(ROWS) for c in range(COLS)}

    for feat in features:
        lng, lat = feature_centroid(feat)
        key = assign_tile(lng, lat)
        tiles[key].append(feat)

    # Write tiles
    total_written = 0
    for (row, col), feats in tiles.items():
        bounds = tile_bounds(row, col)
        out = {
            "type": "FeatureCollection",
            "bounds": bounds,
            "features": feats,
        }
        path = os.path.join(OUT_DIR, f"tile_{row}_{col}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(out, f, separators=(",", ":"))
        size_kb = os.path.getsize(path) / 1024
        print(f"  tile_{row}_{col}.json  {len(feats):>6} features  {size_kb:>7.1f} KB")
        total_written += len(feats)

    print(f"\nDone. {total_written} features across {ROWS*COLS} tiles.")
    print("You can now remove public/buildings/amsterdam_buildings.geojson from git.")

if __name__ == "__main__":
    main()

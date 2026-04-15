"""
split_buildings.py
──────────────────
Splits amsterdam_buildings.geojson into an 8x8 grid of tiles.
Each tile is written to public/buildings/tile_{row}_{col}.json.

Optimisations applied before writing:
  - Convex hull per building  (shadow casting only needs the hull;
    reduces avg vertices from ~20 to ~6, cuts tile size ~65%)
  - Minimum height 8 m        (skip sheds / single-storey garages)
  - 4 dp coordinate rounding  (already applied by fetch step)

Also runs fetch_buildings.py first if the source file is missing.

Usage:
    python scripts/split_buildings.py
"""

import json, os, sys, subprocess

WEST, SOUTH, EAST, NORTH = 4.72, 52.28, 5.10, 52.43
ROWS = 8
COLS = 8
MIN_HEIGHT = 8.0   # metres — skip buildings too short to matter

SOURCE  = "public/buildings/amsterdam_buildings.geojson"
OUT_DIR = "public/buildings"


# ── Inline convex hull (no dependencies) ──────────────────────────────

def _cross(O, A, B):
    return (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0])

def convex_hull(points):
    pts = sorted(set(map(tuple, points)))
    if len(pts) < 3:
        return pts + [pts[0]] if pts else []
    lower = []
    for p in pts:
        while len(lower) >= 2 and _cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and _cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    if hull:
        hull.append(hull[0])  # close ring
    return hull


# ── Grid helpers ───────────────────────────────────────────────────────

def tile_bounds(row, col):
    lat_step = (NORTH - SOUTH) / ROWS
    lng_step = (EAST  - WEST)  / COLS
    return {
        "south": SOUTH + row * lat_step,
        "north": SOUTH + (row+1) * lat_step,
        "west":  WEST  + col * lng_step,
        "east":  WEST  + (col+1) * lng_step,
    }

def assign_tile(lng, lat):
    lat_step = (NORTH - SOUTH) / ROWS
    lng_step = (EAST  - WEST)  / COLS
    r = int((lat - SOUTH) / lat_step)
    c = int((lng - WEST)  / lng_step)
    return max(0, min(ROWS-1, r)), max(0, min(COLS-1, c))

def centroid(coords):
    lngs = [p[0] for p in coords]
    lats = [p[1] for p in coords]
    return sum(lngs)/len(lngs), sum(lats)/len(lats)


# ── Main ───────────────────────────────────────────────────────────────

def main():
    if not os.path.exists(SOURCE):
        print(f"{SOURCE} not found — running fetch_buildings.py first ...")
        subprocess.run([sys.executable, "scripts/fetch_buildings.py"], check=True)

    print(f"Loading {SOURCE} ...")
    with open(SOURCE, encoding="utf-8") as f:
        fc = json.load(f)

    features = fc["features"]
    print(f"  -> {len(features)} features loaded")

    tiles = {(r, c): [] for r in range(ROWS) for c in range(COLS)}
    skipped = 0

    for feat in features:
        h = feat["properties"].get("h", 0) or 0
        if h < MIN_HEIGHT:
            skipped += 1
            continue

        ring = feat["geometry"]["coordinates"][0]
        if len(ring) < 4:
            skipped += 1
            continue

        # Replace polygon with its convex hull
        hull = convex_hull(ring)
        if len(hull) < 4:
            skipped += 1
            continue

        simplified = {
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [hull]},
            "properties": {"h": h},
        }

        lng, lat = centroid(ring)
        key = assign_tile(lng, lat)
        tiles[key].append(simplified)

    total = 0
    for (row, col), feats in tiles.items():
        out = {
            "type": "FeatureCollection",
            "bounds": tile_bounds(row, col),
            "features": feats,
        }
        path = os.path.join(OUT_DIR, f"tile_{row}_{col}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(out, f, separators=(",", ":"))
        size_kb = os.path.getsize(path) / 1024
        if feats:
            print(f"  tile_{row}_{col}.json  {len(feats):>6} features  {size_kb:>7.1f} KB")
        total += len(feats)

    print(f"\nDone. {total} features written, {skipped} skipped (h<{MIN_HEIGHT}m or bad geometry).")

if __name__ == "__main__":
    main()

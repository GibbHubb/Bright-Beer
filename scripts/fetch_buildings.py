"""
fetch_buildings.py
──────────────────
One-time script: download Amsterdam building footprints with height data
from Overpass API and write them as a GeoJSON FeatureCollection to
public/buildings/amsterdam_buildings.geojson

Usage:
    python scripts/fetch_buildings.py

Requirements:
    pip install requests

The output file is consumed by src/hooks/useBuildingTiles.ts at runtime.
"""

import json
import time
import requests

# Amsterdam rough bounding box (south, west, north, east)
BBOX = "52.33,4.82,52.42,5.00"

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
]

QUERY = f"""
[out:json][timeout:120];
(
  way["building"]({BBOX});
  relation["building"]["type"="multipolygon"]({BBOX});
);
out body geom;
"""

OUT_FILE = "public/buildings/amsterdam_buildings.geojson"

DEFAULT_HEIGHT_PER_LEVEL = 3.0   # metres per floor
DEFAULT_LEVELS           = 3     # assumed if no tag at all
MIN_HEIGHT               = 2.0   # anything shorter than this is skipped


def extract_height(tags: dict) -> float:
    """Return building height in metres from OSM tags."""
    if "height" in tags:
        try:
            return float(str(tags["height"]).replace("m", "").strip())
        except ValueError:
            pass
    if "building:levels" in tags:
        try:
            return float(tags["building:levels"]) * DEFAULT_HEIGHT_PER_LEVEL
        except ValueError:
            pass
    # Guess by building type
    btype = tags.get("building", "yes")
    level_guess = {
        "house": 2, "detached": 2, "semidetached_house": 2,
        "church": 10, "cathedral": 15,
        "apartments": 5, "residential": 4,
        "commercial": 4, "office": 6,
        "industrial": 3, "warehouse": 4,
        "retail": 2, "shop": 2,
    }.get(btype, DEFAULT_LEVELS)
    return level_guess * DEFAULT_HEIGHT_PER_LEVEL


def way_to_polygon(geometry: list) -> list[list[float]] | None:
    """Convert Overpass geometry list to a ring of [lon, lat] pairs."""
    if not geometry or len(geometry) < 3:
        return None
    ring = [[n["lon"], n["lat"]] for n in geometry]
    # Close the ring if not already closed
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def fetch() -> list[dict]:
    for url in OVERPASS_ENDPOINTS:
        print(f"Querying {url} …")
        try:
            resp = requests.post(url, data={"data": QUERY}, timeout=180)
            resp.raise_for_status()
            elements = resp.json()["elements"]
            print(f"  -> {len(elements)} elements received")
            return elements
        except Exception as e:
            print(f"  ! failed ({e}), trying next endpoint …")
    raise RuntimeError("All Overpass endpoints failed")


def build_geojson(elements: list[dict]) -> dict:
    features = []
    skipped  = 0

    for el in elements:
        tags   = el.get("tags", {})
        height = extract_height(tags)

        if height < MIN_HEIGHT:
            skipped += 1
            continue

        geometry = el.get("geometry")

        if el["type"] == "way" and geometry:
            ring = way_to_polygon(geometry)
            if not ring:
                skipped += 1
                continue
            features.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [ring]},
                "properties": {
                    "height":           height,
                    "building:levels":  tags.get("building:levels"),
                    "building":         tags.get("building", "yes"),
                    "name":             tags.get("name"),
                },
            })

        elif el["type"] == "relation":
            # Use the outer members from the resolved geometry
            members = el.get("members", [])
            outer_rings = []
            for m in members:
                if m.get("role") == "outer" and "geometry" in m:
                    ring = way_to_polygon(m["geometry"])
                    if ring:
                        outer_rings.append(ring)
            if not outer_rings:
                skipped += 1
                continue
            # Multi-polygon: each outer ring becomes a separate feature for simplicity
            for ring in outer_rings:
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Polygon", "coordinates": [ring]},
                    "properties": {
                        "height":          height,
                        "building:levels": tags.get("building:levels"),
                        "building":        tags.get("building", "yes"),
                        "name":            tags.get("name"),
                    },
                })

    print(f"  -> {len(features)} features written, {skipped} skipped (too short / no geometry)")
    return {"type": "FeatureCollection", "features": features}


if __name__ == "__main__":
    t0 = time.time()
    elements = fetch()
    geojson  = build_geojson(elements)

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_mb = len(json.dumps(geojson).encode()) / 1_048_576
    print(f"  -> Wrote {OUT_FILE}  ({size_mb:.1f} MB)  in {time.time()-t0:.1f}s")

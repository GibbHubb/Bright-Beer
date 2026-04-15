"""
fetch_venues.py
───────────────
Fetch Amsterdam outdoor terrace venues from Overpass and save to
public/venues.json — a static snapshot loaded by the app instead of
live Overpass on every session load.

Run this whenever you want fresh venue data:
    python scripts/fetch_venues.py

The app falls back to live Overpass if the file is absent.
"""

import json, time, requests

BBOX = "52.28,4.72,52.43,5.10"
OUT  = "public/venues.json"

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

QUERY = f"""
[out:json][timeout:60][bbox:{BBOX}];
(
  node["amenity"~"bar|pub|restaurant|cafe"]["outdoor_seating"="yes"];
  way["amenity"~"bar|pub|restaurant|cafe"]["outdoor_seating"="yes"];
);
out center tags;
""".strip()

def fetch_elements():
    for url in ENDPOINTS:
        print(f"  Trying {url} ...")
        try:
            r = requests.post(url, data={"data": QUERY}, timeout=90)
            r.raise_for_status()
            return r.json()["elements"]
        except Exception as e:
            print(f"  ! {e}")
    raise RuntimeError("All endpoints failed")

def parse(el):
    tags = el.get("tags", {})
    if el["type"] == "way":
        c = el.get("center", {})
        lat, lng = c.get("lat"), c.get("lon")
    else:
        lat, lng = el.get("lat"), el.get("lon")
    if not lat or not lng:
        return None

    street  = tags.get("addr:street", "")
    housenr = tags.get("addr:housenumber", "")
    address = f"{street} {housenr}".strip() if street else None

    def cap(key):
        v = tags.get(key)
        try: return int(v) if v else None
        except: return None

    return {
        "id":               str(el["id"]),
        "name":             tags.get("name") or tags.get("amenity") or "Terrace",
        "lat":              round(lat, 6),
        "lng":              round(lng, 6),
        "address":          address,
        "openingHours":     tags.get("opening_hours"),
        "amenity":          tags.get("amenity"),
        "craft":            tags.get("craft"),
        "capacity":         cap("capacity"),
        "terraceCapacity":  cap("outdoor_seating:capacity"),
    }

if __name__ == "__main__":
    t0 = time.time()
    print("Fetching venues ...")
    elements = fetch_elements()
    venues = [v for v in (parse(e) for e in elements) if v]
    out = {"fetchedAt": int(time.time()), "venues": venues}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    size_kb = len(json.dumps(out).encode()) / 1024
    print(f"Wrote {OUT}: {len(venues)} venues, {size_kb:.1f} KB, {time.time()-t0:.1f}s")

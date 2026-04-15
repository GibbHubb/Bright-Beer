# ☀️ Sunny Amsterdam

> Find the sunniest terrace in Amsterdam — live sun tracker for outdoor bars and cafés.

**Live:** https://gibbhubb.github.io/Bright-Beer/

## What it does

Shows a map of Amsterdam with every outdoor terrace colour-coded by whether it is currently in direct sunlight. Drag the time slider to plan ahead, pick any date to see how the season affects shadows, and click a venue for its full-day sun window.

- **Yellow** = in direct sun right now
- **Grey** = in shade
- **Dark** = night (sun below horizon)

## How it works

1. **Venue data** — Overpass API query for `outdoor_seating=yes` bars, pubs, restaurants, cafés; cached in localStorage for 24 hours.
2. **Sun position** — [SunCalc.js](https://github.com/mourner/suncalc) gives azimuth + altitude for Amsterdam at any date/time.
3. **Shadow engine** — For each building in the current viewport, `shadowGeometry.ts` projects the footprint into a shadow polygon using `height / tan(altitude)`. Runs in a Web Worker (off main thread, 100 ms debounce).
4. **Classification** — [Turf.js](https://turfjs.org) `booleanPointInPolygon` tests each venue against the shadow union.
5. **Building data** — 149 k Amsterdam building footprints from OpenStreetMap (heights from `building:levels` tags; defaults to 10 m where missing). Pre-baked GeoJSON in `public/buildings/`.

## Local development

```bash
npm install
npm run dev          # http://localhost:5173/Bright-Beer/
```

## Refresh building data

Run once to re-download Amsterdam buildings from Overpass:

```bash
pip install requests
python scripts/fetch_buildings.py
```

Output: `public/buildings/amsterdam_buildings.geojson` (~35 MB raw, ~2 MB gzip).

## Tech stack

| | |
|---|---|
| Framework | React 19 + TypeScript + Vite 8 |
| Map | MapLibre GL JS |
| Basemap | CARTO dark-matter (free, no API key) |
| Sun position | SunCalc.js |
| Shadow geometry | Custom convex-hull projection |
| Geo ops | Turf.js |
| Build | GitHub Actions → GitHub Pages |

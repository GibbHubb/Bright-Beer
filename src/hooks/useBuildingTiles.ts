import { useState, useEffect, useRef } from 'react';
import type { Feature, Polygon } from 'geojson';

// Must match scripts/split_buildings.py
const ROWS = 8;
const COLS = 8;
const WEST  = 4.72;
const SOUTH = 52.28;
const EAST  = 5.10;
const NORTH = 52.43;
const LAT_STEP = (NORTH - SOUTH) / ROWS;
const LNG_STEP = (EAST  - WEST)  / COLS;

export type MapBounds = {
  north: number; south: number; east: number; west: number;
};

function tileUrl(row: number, col: number): string {
  return import.meta.env.BASE_URL + `buildings/tile_${row}_${col}.json`;
}

/** Return all (row, col) tile indices that overlap the given bounds. */
function overlappingTiles(b: MapBounds): [number, number][] {
  const colMin = Math.max(0, Math.floor((b.west  - WEST)  / LNG_STEP));
  const colMax = Math.min(COLS - 1, Math.floor((b.east  - WEST)  / LNG_STEP));
  const rowMin = Math.max(0, Math.floor((b.south - SOUTH) / LAT_STEP));
  const rowMax = Math.min(ROWS - 1, Math.floor((b.north - SOUTH) / LAT_STEP));

  const pairs: [number, number][] = [];
  for (let r = rowMin; r <= rowMax; r++)
    for (let c = colMin; c <= colMax; c++)
      pairs.push([r, c]);
  return pairs;
}

// Module-level tile cache — survives re-renders, cleared only on page reload
const tileCache = new Map<string, Feature<Polygon>[]>();

async function loadTile(row: number, col: number): Promise<Feature<Polygon>[]> {
  const key = `${row}_${col}`;
  if (tileCache.has(key)) return tileCache.get(key)!;

  try {
    const res = await fetch(tileUrl(row, col));
    if (!res.ok) { tileCache.set(key, []); return []; }
    const fc = await res.json();
    const features: Feature<Polygon>[] = fc.features ?? [];
    tileCache.set(key, features);
    return features;
  } catch {
    tileCache.set(key, []);
    return [];
  }
}

const MIN_TILE_ZOOM = 13; // no shadows below this zoom → skip tile load entirely

/** Stable empty result — a fresh [] each render would re-trigger useShadows. */
const NO_BUILDINGS: Feature<Polygon>[] = [];

export function useBuildingTiles(bounds: MapBounds | null, zoom = 14): Feature<Polygon>[] {
  const [buildings, setBuildings] = useState<Feature<Polygon>[]>([]);
  // Track which tile keys are currently loaded so we only re-fetch on tile change
  const loadedKeys = useRef<string>('');

  // Below the shadow zoom there is nothing to draw. S31-fu2 — this is derived
  // during render instead of being pushed into state by the effect, which is
  // what the set-state-in-effect rule was objecting to.
  const active = !!bounds && zoom >= MIN_TILE_ZOOM;

  // Round bounds to 2dp so minor pan jitter doesn't re-trigger. Extracted to
  // named values so the dependency array holds simple expressions the linter
  // can check statically.
  const north = bounds ? Math.round(bounds.north * 100) : null;
  const south = bounds ? Math.round(bounds.south * 100) : null;
  const east  = bounds ? Math.round(bounds.east  * 100) : null;
  const west  = bounds ? Math.round(bounds.west  * 100) : null;

  useEffect(() => {
    if (!active || !bounds) {
      // Forget what was loaded so re-entering the zoom range refetches rather
      // than short-circuiting on a stale key. A ref write is not state, so it
      // does not cascade a render.
      loadedKeys.current = '';
      return;
    }

    const tiles = overlappingTiles(bounds);
    const key = tiles.map(([r, c]) => `${r}_${c}`).sort().join(',');
    if (key === loadedKeys.current) return; // same tiles, skip
    loadedKeys.current = key;

    let cancelled = false;
    Promise.all(tiles.map(([r, c]) => loadTile(r, c))).then((results) => {
      if (cancelled) return;
      setBuildings(results.flat());
    });

    return () => { cancelled = true; };
    // `bounds` is represented by the four rounded values above; depending on
    // the object itself would refire on every pan frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, north, south, east, west]);

  return active ? buildings : NO_BUILDINGS;
}

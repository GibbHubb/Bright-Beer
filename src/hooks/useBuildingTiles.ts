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

export function useBuildingTiles(bounds: MapBounds | null): Feature<Polygon>[] {
  const [buildings, setBuildings] = useState<Feature<Polygon>[]>([]);
  // Track which tile keys are currently loaded so we only re-fetch on tile change
  const loadedKeys = useRef<string>('');

  useEffect(() => {
    if (!bounds) return;

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
  }, [
    // Round bounds to 2dp so minor pan jitter doesn't re-trigger
    bounds ? Math.round(bounds.north * 100) : null,
    bounds ? Math.round(bounds.south * 100) : null,
    bounds ? Math.round(bounds.east  * 100) : null,
    bounds ? Math.round(bounds.west  * 100) : null,
  ]);

  return buildings;
}

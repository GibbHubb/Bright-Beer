import { useState, useEffect } from 'react';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

interface Bounds {
  north: number;
  south: number;
  east:  number;
  west:  number;
}

// Simple bbox intersection check for a polygon feature
function intersectsBounds(feature: Feature<Polygon>, b: Bounds): boolean {
  const coords = feature.geometry.coordinates[0];
  if (!coords) return false;
  for (const [lng, lat] of coords) {
    if (lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north) return true;
  }
  return false;
}

let cachedAll: Feature<Polygon>[] | null = null;

async function loadAll(): Promise<Feature<Polygon>[]> {
  if (cachedAll) return cachedAll;
  try {
    const res = await fetch('/Bright-Beer/buildings/amsterdam_buildings.geojson');
    if (!res.ok) throw new Error('buildings not found');
    const fc: FeatureCollection<Polygon> = await res.json();
    cachedAll = fc.features;
    return cachedAll;
  } catch (_) {
    return [];
  }
}

export function useBuildingTiles(bounds: Bounds | null): Feature<Polygon>[] {
  const [buildings, setBuildings] = useState<Feature<Polygon>[]>([]);

  useEffect(() => {
    if (!bounds) return;
    loadAll().then((all) => {
      setBuildings(all.filter((f) => intersectsBounds(f, bounds)));
    });
  }, [
    bounds?.north.toFixed(3),
    bounds?.south.toFixed(3),
    bounds?.east.toFixed(3),
    bounds?.west.toFixed(3),
  ]);

  return buildings;
}

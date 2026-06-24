import type { Feature, Polygon } from 'geojson';
import { point } from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { projectShadow } from '../lib/shadowGeometry';
import type { Venue } from '../lib/overpass';

/** Maximum buildings to process per city — mirrors the cap in useShadows. */
const MAX_SHADOW_BUILDINGS = 400;

export interface RadarWorkerInput {
  cityId:    string;
  venues:    Venue[];
  buildings: Feature<Polygon>[];
  azimuth:   number;
  altitude:  number;
}

export interface RadarWorkerOutput {
  cityId:     string;
  sunnyCount: number;
}

self.onmessage = (e: MessageEvent<RadarWorkerInput>) => {
  const { cityId, venues, buildings, azimuth, altitude } = e.data;

  // Sun below effective horizon → nothing is sunny.
  if (altitude <= 0.017) {
    self.postMessage({ cityId, sunnyCount: 0 } satisfies RadarWorkerOutput);
    return;
  }

  // Sort by height desc, keep top N — mirrors useShadows height-based cap.
  const capped = buildings.length > MAX_SHADOW_BUILDINGS
    ? [...buildings].sort((a, b) =>
        ((b.properties?.h as number) || 0) - ((a.properties?.h as number) || 0)
      ).slice(0, MAX_SHADOW_BUILDINGS)
    : buildings;

  // Build shadow polygons for each capped building.
  const shadowFeatures = capped
    .map(b => projectShadow(b, azimuth, altitude))
    .filter((s): s is Feature<Polygon> => s !== null);

  // Classify each venue: sunny = not inside any shadow.
  let sunnyCount = 0;
  for (const venue of venues) {
    const pt = point([venue.lng, venue.lat]);
    const inShadow = shadowFeatures.some(s => booleanPointInPolygon(pt, s));
    if (!inShadow) sunnyCount++;
  }

  self.postMessage({ cityId, sunnyCount } satisfies RadarWorkerOutput);
};

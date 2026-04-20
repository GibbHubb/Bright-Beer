import type { Feature, Polygon } from 'geojson';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { getSunPosition } from './sunCalc';
import { projectShadow } from './shadowGeometry';
import type { Venue } from './overpass';

const NEARBY_DEG = 0.004; // ~400m bbox around venue

export type Slot = 'sunny' | 'shaded' | 'night';

/** Filter buildings to only those within ±NEARBY_DEG of the venue. */
export function nearbyBuildings(venue: Venue, all: Feature<Polygon>[]): Feature<Polygon>[] {
  const { lat, lng } = venue;
  return all.filter((f) => {
    const coords = f.geometry.coordinates[0];
    return coords.some(([bLng, bLat]) =>
      Math.abs(bLng - lng) < NEARBY_DEG && Math.abs(bLat - lat) < NEARBY_DEG,
    );
  });
}

/** Compute sun status for a venue at a specific date/time. */
export function computeSlotStatus(
  venue: Venue,
  nearby: Feature<Polygon>[],
  date: Date,
): Slot {
  const sun = getSunPosition(date);
  if (!sun.isAboveHorizon) return 'night';

  const pt = point([venue.lng, venue.lat]);

  for (const building of nearby) {
    const shadow = projectShadow(building, sun.azimuth, sun.altitude);
    if (shadow && booleanPointInPolygon(pt, shadow)) return 'shaded';
  }
  return 'sunny';
}

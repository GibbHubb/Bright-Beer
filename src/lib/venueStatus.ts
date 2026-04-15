import type { Feature, FeatureCollection, Polygon, Point } from 'geojson';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { Venue } from './overpass';

export type SunStatus = 'sunny' | 'shaded' | 'night';

export interface VenueWithStatus extends Venue {
  status: SunStatus;
}

/**
 * Classify each venue as sunny or shaded given the current merged shadow union.
 * 'night' means the sun is below the horizon entirely.
 */
export function classifyVenues(
  venues: Venue[],
  shadows: FeatureCollection<Polygon>,
  isAboveHorizon: boolean,
): VenueWithStatus[] {
  if (!isAboveHorizon) {
    return venues.map((v) => ({ ...v, status: 'night' }));
  }

  return venues.map((v) => {
    const pt = point([v.lng, v.lat]) as Feature<Point>;
    const inShadow = shadows.features.some((shadow) =>
      booleanPointInPolygon(pt, shadow),
    );
    return { ...v, status: inShadow ? 'shaded' : 'sunny' };
  });
}

export function statusColor(status: SunStatus): string {
  switch (status) {
    case 'sunny':  return '#FFD700';
    case 'shaded': return '#6b7280';
    case 'night':  return '#374151';
  }
}

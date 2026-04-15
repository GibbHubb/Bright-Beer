import type { Feature, FeatureCollection, Polygon, Point } from 'geojson';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { Venue } from './overpass';
import { isNearCanal } from './canals';

export type SunStatus = 'sunny' | 'shaded' | 'night';
export type VenueFilter = 'wine' | 'canal' | 'big' | 'cafe';

export interface VenueWithStatus extends Venue {
  status: SunStatus;
}

const WINE_RE = /wine|wijn|vinothek|vino|wein/i;
const BIG_CAPACITY = 40;
const BIG_TERRACE_CAPACITY = 20;

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
    const inShadow = shadows.features.some((s) => booleanPointInPolygon(pt, s));
    return { ...v, status: inShadow ? 'shaded' : 'sunny' };
  });
}

export function applyFilters(
  venues: VenueWithStatus[],
  activeFilters: VenueFilter[],
): VenueWithStatus[] {
  if (!activeFilters.length) return venues;
  return venues.filter((v) =>
    activeFilters.every((f) => {
      switch (f) {
        case 'wine':
          return WINE_RE.test(v.name) || v.craft === 'winery';
        case 'canal':
          return isNearCanal(v.lat, v.lng);
        case 'big':
          return (v.capacity ?? 0) >= BIG_CAPACITY
            || (v.terraceCapacity ?? 0) >= BIG_TERRACE_CAPACITY;
        case 'cafe':
          return v.amenity === 'cafe';
      }
    }),
  );
}

export function statusColor(status: SunStatus): string {
  switch (status) {
    case 'sunny':  return '#FFD700';
    case 'shaded': return '#6b7280';
    case 'night':  return '#374151';
  }
}

import type { Feature, Polygon } from 'geojson';
import type { VenueWithStatus } from './venueStatus';
import { nearbyBuildings, computeSlotStatus } from './windowSlots';

const SLOTS = 48;
const MAX_VENUES = 10;

export interface BestWindow {
  venue:    VenueWithStatus;
  startMin: number;  // minutes since midnight
  endMin:   number;
  slots:    number;  // duration in 30-min slots
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute the single best sunny window across the top-10 nearest venues.
 * Returns null if no venue has any sunny slot today.
 */
export function computeBestWindow(
  venues: VenueWithStatus[],
  buildings: Feature<Polygon>[],
  dateStr: string,
  center: [number, number], // [lng, lat]
): BestWindow | null {
  if (!venues.length || !buildings.length) return null;

  const [cLng, cLat] = center;

  // Pick the closest 10 venues
  const nearest = venues
    .map((v) => ({ v, d: distKm(v.lat, v.lng, cLat, cLng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_VENUES)
    .map(({ v }) => v);

  const base = new Date(dateStr + 'T00:00:00');
  let best: BestWindow | null = null;

  for (const venue of nearest) {
    const nearby = nearbyBuildings(venue, buildings);

    // Compute 48 half-hour slots
    let maxRun = 0;
    let maxStart = 0;
    let run = 0;
    let runStart = 0;

    for (let i = 0; i < SLOTS; i++) {
      const d = new Date(base.getTime() + i * 30 * 60 * 1000);
      const status = computeSlotStatus(venue, nearby, d);
      if (status === 'sunny') {
        if (run === 0) runStart = i;
        run++;
        if (run > maxRun) {
          maxRun = run;
          maxStart = runStart;
        }
      } else {
        run = 0;
      }
    }

    if (maxRun > 0 && (!best || maxRun > best.slots)) {
      best = {
        venue,
        startMin: maxStart * 30,
        endMin: (maxStart + maxRun) * 30,
        slots: maxRun,
      };
    }
  }

  return best;
}

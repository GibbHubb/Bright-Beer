/**
 * Radar count accuracy tests.
 *
 * Shadow-classification behaviour for the pure `classifyVenues` /
 * `projectShadow` primitives extracted from venueStatus.ts and
 * shadowGeometry.ts. The worker (radarWorker.ts) calls these same
 * primitives.
 */

import { describe, it, expect } from 'vitest';
import { classifyVenues } from '../venueStatus';
import { projectShadow } from '../shadowGeometry';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import type { Venue } from '../overpass';

// Minimal venue factory
function mkVenue(id: string, lat: number, lng: number): Venue {
  return { id, name: id, lat, lng, hasOutdoorSeating: true };
}

// Minimal building factory: a small square footprint centred on (lat, lng)
function mkBuilding(lat: number, lng: number, h = 10): Feature<Polygon> {
  const d = 0.0002; // ~22 m
  return {
    type: 'Feature',
    properties: { h },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ]],
    },
  };
}

describe('shadow classification', () => {
  // S32 (fixed): projectShadow now casts the shadow to the correct side.
  // With a sun due south (azimuth = 0) the shadow falls NORTH of the building,
  // so a venue placed just north of it is shaded. A 10 m building at ~15°
  // altitude throws a ~37 m shadow, so the venue must sit within that reach of
  // the building's north edge (≈22 m north of centre) — 52.3703 is ~33 m north
  // of centre, comfortably inside the projected hull.
  it('classifies a venue inside a projected shadow as shaded', () => {
    // Sun low in the south (azimuth ≈ 0, altitude ≈ 15°)
    const azimuth = 0;
    const altitude = 0.26; // ~15°

    const building = mkBuilding(52.37, 4.90);
    const shadow = projectShadow(building, azimuth, altitude);
    if (!shadow) throw new Error('Expected shadow to be projected');

    // The shadow falls north of the building (opposite the sun in the south).
    // Place a venue just north of the building, within the shadow's reach.
    const venueNorth = mkVenue('v1', 52.3703, 4.90);

    const fc: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [shadow] };
    const classified = classifyVenues([venueNorth], fc, true);

    expect(classified[0].status).toBe('shaded');
  });

  it('classifies a venue clear of all shadows as sunny', () => {
    const azimuth = 0;
    const altitude = 0.26;

    const building = mkBuilding(52.37, 4.90);
    const shadow = projectShadow(building, azimuth, altitude);
    if (!shadow) throw new Error('Expected shadow');

    // Place venue far south (opposite of shadow direction) — well outside
    // the shadow's reach regardless of which way it's cast.
    const venueSouth = mkVenue('v2', 52.369, 4.90);

    const fc: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [shadow] };
    const classified = classifyVenues([venueSouth], fc, true);

    expect(classified[0].status).toBe('sunny');
  });

  it('marks all venues as night when the sun is below the horizon', () => {
    const venues = [mkVenue('v3', 52.37, 4.90)];
    const emptyFc: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };
    const classified = classifyVenues(venues, emptyFc, false);

    expect(classified[0].status).toBe('night');
  });

  it('classifies all terrace venues as sunny when there are no buildings', () => {
    const venues = [mkVenue('v4', 52.37, 4.90)];
    const emptyFc: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };
    const classified = classifyVenues(venues, emptyFc, true);

    expect(classified[0].status).toBe('sunny');
  });
});

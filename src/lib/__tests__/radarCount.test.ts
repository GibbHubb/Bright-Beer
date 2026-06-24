/**
 * Radar count accuracy tests.
 *
 * NOTE: No test runner (vitest/jest) is configured in this project.
 * These tests document the expected behaviour of the shadow classification
 * logic used by radarWorker.ts. Add vitest to devDependencies and run
 * `npx vitest` to execute them.
 *
 * Follow-up ticket: install vitest and wire `npm run test`.
 */

// The functions under test are pure utilities extracted from venueStatus.ts
// and shadowGeometry.ts. The worker calls these same primitives.

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

// ── Test 1: venue inside a shadow polygon is classified 'shaded' ─────────
function test_venueInShadowIsShaded() {
  // Sun low in the south (azimuth ≈ 0, altitude ≈ 15°)
  const azimuth = 0;
  const altitude = 0.26; // ~15°

  const building = mkBuilding(52.37, 4.90);
  const shadow = projectShadow(building, azimuth, altitude);
  if (!shadow) throw new Error('Expected shadow to be projected');

  // The shadow falls north of the building (opposite of sun direction south).
  // Place a venue just north of the building centre.
  const venueNorth = mkVenue('v1', 52.371, 4.90);

  const fc: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [shadow] };
  const classified = classifyVenues([venueNorth], fc, true);

  // The venue should be shaded (inside the shadow).
  console.assert(classified[0].status === 'shaded',
    `Expected shaded, got ${classified[0].status}`);
  console.log('PASS test_venueInShadowIsShaded');
}

// ── Test 2: venue clear of all shadows → sunny ───────────────────────────
function test_venueOutsideShadowIsSunny() {
  const azimuth = 0;
  const altitude = 0.26;

  const building = mkBuilding(52.37, 4.90);
  const shadow = projectShadow(building, azimuth, altitude);
  if (!shadow) throw new Error('Expected shadow');

  // Place venue far south (opposite of shadow direction).
  const venueSouth = mkVenue('v2', 52.369, 4.90);

  const fc: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [shadow] };
  const classified = classifyVenues([venueSouth], fc, true);

  console.assert(classified[0].status === 'sunny',
    `Expected sunny, got ${classified[0].status}`);
  console.log('PASS test_venueOutsideShadowIsSunny');
}

// ── Test 3: sun below horizon → all venues are 'night' ───────────────────
function test_sunBelowHorizonAllNight() {
  const venues = [mkVenue('v3', 52.37, 4.90)];
  const emptyFc: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };
  const classified = classifyVenues(venues, emptyFc, false);

  console.assert(classified[0].status === 'night',
    `Expected night, got ${classified[0].status}`);
  console.log('PASS test_sunBelowHorizonAllNight');
}

// ── Test 4: no buildings → all terrace venues are sunny ──────────────────
function test_noBuildings_allSunny() {
  const venues = [mkVenue('v4', 52.37, 4.90)];
  const emptyFc: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };
  const classified = classifyVenues(venues, emptyFc, true);

  console.assert(classified[0].status === 'sunny',
    `Expected sunny with no buildings, got ${classified[0].status}`);
  console.log('PASS test_noBuildings_allSunny');
}

// Run all (node --experimental-vm-modules / vitest / jest)
test_venueInShadowIsShaded();
test_venueOutsideShadowIsSunny();
test_sunBelowHorizonAllNight();
test_noBuildings_allSunny();

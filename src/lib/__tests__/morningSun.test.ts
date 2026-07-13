/**
 * Morning-sun derivation tests (S31).
 *
 * Minimal coverage of the two exported functions that are cleanly unit
 * -testable without heavy setup (real SunCalc math, no mocking needed):
 *  - getMorningSampleTime: sunrise + 60min, clamped to 06:00–12:00
 *  - isMorningSunVenue: terrace gate (S11) applied before shadow lookup
 *
 * computeMorningShadows / filterMorningSun are thin wrappers over
 * projectShadow + classifyVenues, already covered indirectly via
 * radarCount.test.ts.
 */

import { describe, it, expect } from 'vitest';
import type { FeatureCollection, Polygon } from 'geojson';
import { getMorningSampleTime, isMorningSunVenue } from '../morningSun';
import { AMSTERDAM_CENTER } from '../../constants/amsterdam';
import type { Venue } from '../overpass';

describe('getMorningSampleTime', () => {
  it('returns a sample time clamped to 06:00–12:00 local', () => {
    const date = new Date('2026-03-15T00:00:00');
    const sample = getMorningSampleTime(date, AMSTERDAM_CENTER);

    expect(sample).not.toBeNull();
    const minutesOfDay = sample!.getHours() * 60 + sample!.getMinutes();
    expect(minutesOfDay).toBeGreaterThanOrEqual(6 * 60);
    expect(minutesOfDay).toBeLessThanOrEqual(12 * 60);
  });
});

describe('isMorningSunVenue', () => {
  const emptyShadows: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };

  it('excludes venues without outdoor seating, even with sun up and no shadows', () => {
    const venue: Venue = {
      id: 'v1',
      name: 'Indoor Only Cafe',
      lat: 52.37,
      lng: 4.90,
      hasOutdoorSeating: false,
    };

    expect(isMorningSunVenue(venue, emptyShadows, true)).toBe(false);
  });

  it('includes a terrace venue with no shadows in range while the sun is up', () => {
    const venue: Venue = {
      id: 'v2',
      name: 'Terrace Cafe',
      lat: 52.37,
      lng: 4.90,
      hasOutdoorSeating: true,
    };

    expect(isMorningSunVenue(venue, emptyShadows, true)).toBe(true);
  });
});

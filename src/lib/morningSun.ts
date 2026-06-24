/**
 * S31 — Morning-sun derivation helpers.
 *
 * "East-facing / catches morning sun" is derived, not stored: a terrace is
 * considered a morning-sun venue if it is classified 'sunny' at a fixed
 * morning sample time (sunrise + 60 minutes, clamped to 06:00–12:00 local).
 * This reuses the real building-shadow occlusion pipeline (`projectShadow` +
 * `classifyVenues`), so it is accurate for Amsterdam (where tiles are
 * available) and degrades to a horizon-only "is the sun up?" approximation
 * for other cities (same fallback as S29).
 *
 * The shadow set for the morning sample is **memoised per date + city** —
 * the sample time is fixed for a given day, so there is no reason to
 * recompute it on every slider tick.
 */

import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { getSunTimes, getSunPosition } from './sunCalc';
import { projectShadow } from './shadowGeometry';
import { classifyVenues } from './venueStatus';
import type { Venue } from './overpass';
import type { VenueWithStatus } from './venueStatus';

// ── Morning sample time ────────────────────────────────────────────────────

const MORNING_OFFSET_MIN  = 60;   // minutes after sunrise
const MORNING_CLAMP_MIN   = 6 * 60;   // 06:00 — floor (don't go before dawn)
const MORNING_CLAMP_MAX   = 12 * 60;  // 12:00 — ceiling (only "morning")

/**
 * Returns a Date for the morning sample time on the given date + city.
 * Sample = sunrise + 60 min, clamped to [06:00, 12:00].
 * Returns null if sunrise is an Invalid Date (polar edge case).
 */
export function getMorningSampleTime(
  date: Date,
  cityCentre: [number, number],
): Date | null {
  const times = getSunTimes(date, cityCentre) as unknown as Record<string, Date>;
  const sunrise = times['sunrise'];
  if (!sunrise || isNaN(sunrise.getTime())) return null;

  const sunriseMin = sunrise.getHours() * 60 + sunrise.getMinutes();
  const sampleMin  = Math.min(
    MORNING_CLAMP_MAX,
    Math.max(MORNING_CLAMP_MIN, sunriseMin + MORNING_OFFSET_MIN),
  );

  const sample = new Date(date);
  sample.setHours(Math.floor(sampleMin / 60), sampleMin % 60, 0, 0);
  return sample;
}

// ── Morning shadow computation ─────────────────────────────────────────────

const MAX_SHADOW_BUILDINGS = 400;

/**
 * Compute building shadows at the morning sample time synchronously.
 * Returns an empty FeatureCollection when sun is below the effective horizon
 * (which becomes the horizon-only fallback for cities without tiles).
 */
export function computeMorningShadows(
  buildings: Feature<Polygon>[],
  morningSampleTime: Date,
  cityCentre: [number, number],
): FeatureCollection<Polygon> {
  const sun = getSunPosition(morningSampleTime, cityCentre);

  // Cap tall-building priority (mirrors the worker cap)
  const capped = buildings.length > MAX_SHADOW_BUILDINGS
    ? [...buildings]
        .sort((a, b) =>
          ((b.properties?.h as number) || 0) - ((a.properties?.h as number) || 0),
        )
        .slice(0, MAX_SHADOW_BUILDINGS)
    : buildings;

  const features: Feature<Polygon>[] = [];

  if (sun.isAboveHorizon) {
    for (const building of capped) {
      const shadow = projectShadow(building, sun.azimuth, sun.altitude);
      if (shadow) features.push(shadow);
    }
  }

  return { type: 'FeatureCollection', features };
}

// ── Venue filtering ────────────────────────────────────────────────────────

/**
 * Returns true if the venue catches morning sun:
 *   - has outdoor seating (terrace-aware, per S11)
 *   - is classified 'sunny' at the morning sample time
 *
 * When no morning sample time is available (polar edge case), returns false.
 */
export function isMorningSunVenue(
  venue: Venue,
  morningShadows: FeatureCollection<Polygon>,
  morningSunIsAboveHorizon: boolean,
): boolean {
  if (!venue.hasOutdoorSeating) return false;
  const classified = classifyVenues([venue], morningShadows, morningSunIsAboveHorizon);
  return classified[0]?.status === 'sunny';
}

/**
 * Filter a list of VenueWithStatus to those that catch morning sun.
 * Accepts the morning shadows + isAboveHorizon from the morning sample time.
 *
 * For cities without building tiles (buildings array empty), this degrades to
 * "sun is up in the east at the sample time" — i.e. all terraces pass if
 * morningSunIsAboveHorizon is true (mirrors S29's fallback behaviour).
 */
export function filterMorningSun(
  venues: VenueWithStatus[],
  morningShadows: FeatureCollection<Polygon>,
  morningSunIsAboveHorizon: boolean,
): VenueWithStatus[] {
  return venues.filter((v) =>
    isMorningSunVenue(v, morningShadows, morningSunIsAboveHorizon),
  );
}

import { AMSTERDAM_BBOX } from '../constants/amsterdam';
import type { City } from '../constants/cities';

// S30 — durable (no-TTL) cache for pinned cities.
// Key: bright-beer-pinned-venues-v1-<cityId>
// Value: JSON { venues: Venue[] }  — no timestamp, never expires on its own.
const PINNED_KEY_PREFIX = 'bright-beer-pinned-venues-v1-';

/** Write venue data to the durable pinned cache for a city. */
export function writePinnedCache(cityId: string, venues: Venue[]): void {
  try {
    localStorage.setItem(PINNED_KEY_PREFIX + cityId, JSON.stringify({ venues }));
  } catch {
    /* quota exceeded — skip */
  }
}

/** Read venue data from the durable pinned cache (returns null if absent). */
export function readPinnedCache(cityId: string): Venue[] | null {
  try {
    const raw = localStorage.getItem(PINNED_KEY_PREFIX + cityId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.venues)) return parsed.venues as Venue[];
  } catch {
    /* malformed */
  }
  return null;
}

export interface Venue {
  id:           string;
  name:         string;
  lat:          number;
  lng:          number;
  address?:     string;
  openingHours?: string;
  website?:     string;
  phone?:       string;
  amenity?:     string;
  craft?:       string;
  capacity?:    number;
  terraceCapacity?: number;
  // S11 — explicit terrace flag. true only when OSM tags outdoor_seating=yes;
  // unknown/missing/no tag treated as false (conservative — user opts in to
  // see indoor venues by leaving the Terrace filter off).
  hasOutdoorSeating: boolean;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];
// v5 — S12 multi-city: cache key partitions by city id so Amsterdam venues
// don't bleed into Rotterdam (or vice versa) on city switch.
const CACHE_KEY_BASE = 'bright-beer-venues-v5';
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000;

function buildQuery(bbox: string): string {
  return `
[out:json][timeout:60][bbox:${bbox}];
(
  node["amenity"~"bar|pub|restaurant|cafe"];
  way["amenity"~"bar|pub|restaurant|cafe"];
);
out center tags;
`.trim();
}

function cacheKey(cityId: string): string {
  return `${CACHE_KEY_BASE}-${cityId}`;
}

// Legacy default (back-compat for any caller that doesn't pass a city).
const QUERY = buildQuery(AMSTERDAM_BBOX);

function parseCapacity(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

function parseElement(el: Record<string, unknown>): Venue | null {
  const tags = (el.tags as Record<string, string>) || {};
  const lat = el.type === 'way'
    ? (el as { center: { lat: number } }).center.lat
    : (el as { lat: number }).lat;
  const lng = el.type === 'way'
    ? (el as { center: { lon: number } }).center.lon
    : (el as { lon: number }).lon;

  if (!lat || !lng) return null;

  const street  = tags['addr:street'] || '';
  const housenr = tags['addr:housenumber'] || '';
  const address = street ? `${street}${housenr ? ' ' + housenr : ''}` : undefined;

  return {
    id:                 String(el.id),
    name:               tags['name'] || tags['amenity'] || 'Venue',
    lat, lng, address,
    openingHours:       tags['opening_hours'],
    website:            tags['website'] || tags['contact:website'],
    phone:              tags['phone'] || tags['contact:phone'],
    amenity:            tags['amenity'],
    craft:              tags['craft'],
    capacity:           parseCapacity(tags['capacity']),
    terraceCapacity:    parseCapacity(tags['outdoor_seating:capacity']),
    // S11 — strict literal "yes" check; anything else (no / missing / "garden")
    // stays false so the filter behaves predictably.
    hasOutdoorSeating:  tags['outdoor_seating'] === 'yes',
  };
}

export async function fetchVenues(city?: City): Promise<Venue[]> {
  // S12 — when no city is supplied, fall back to legacy Amsterdam query +
  // cache slot so callers that pre-date the city refactor keep working.
  const id    = city?.id ?? 'amsterdam';
  const key   = cacheKey(id);
  const query = city ? buildQuery(city.overpassBbox) : QUERY;

  // 1. Short-lived TTL cache (24 h) — serves fresh data most of the time.
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts < CACHE_TTL_MS) return cached.venues;
    }
  } catch (_) {}

  // 2. Try live Overpass.
  let json: { elements: Record<string, unknown>[] } | null = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) continue;
      json = await res.json();
      break;
    } catch (_) { /* try next */ }
  }

  if (json) {
    const venues: Venue[] = json.elements
      .map(parseElement)
      .filter((v): v is Venue => v !== null);
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), venues })); } catch (_) {}
    return venues;
  }

  // 3. S30 — offline fallback: durable pinned cache (no TTL).
  //    Only populated when the user explicitly pins a city.
  const pinned = readPinnedCache(id);
  if (pinned) return pinned;

  throw new Error('All Overpass endpoints failed');
}

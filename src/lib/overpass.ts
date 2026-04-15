import { AMSTERDAM_BBOX } from '../constants/amsterdam';

export interface Venue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  openingHours?: string;
  amenity?: string;
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];
const CACHE_KEY    = 'bright-beer-venues-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const QUERY = `
[out:json][timeout:60][bbox:${AMSTERDAM_BBOX}];
(
  node["amenity"~"bar|pub|restaurant|cafe"]["outdoor_seating"="yes"];
  way["amenity"~"bar|pub|restaurant|cafe"]["outdoor_seating"="yes"];
);
out center tags;
`.trim();

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
    id:           String(el.id),
    name:         tags['name'] || tags['amenity'] || 'Terrace',
    lat,
    lng,
    address,
    openingHours: tags['opening_hours'],
    amenity:      tags['amenity'],
  };
}

export async function fetchVenues(): Promise<Venue[]> {
  // Try cache
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts < CACHE_TTL_MS) return cached.venues;
    }
  } catch (_) {}

  let json: { elements: Record<string, unknown>[] } | null = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `data=${encodeURIComponent(QUERY)}`,
      });
      if (!res.ok) continue;
      json = await res.json();
      break;
    } catch (_) { /* try next */ }
  }
  if (!json) throw new Error('All Overpass endpoints failed');
  const venues: Venue[] = (json.elements)
    .map(parseElement)
    .filter((v): v is Venue => v !== null);

  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), venues })); } catch (_) {}
  return venues;
}

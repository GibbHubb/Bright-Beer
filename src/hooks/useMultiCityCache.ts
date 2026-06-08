import { useCallback, useRef, useState } from 'react';
import type { City } from '../constants/cities';
import type { Venue } from '../lib/overpass';
import { fetchVenues } from '../lib/overpass';

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_PREFIX = 'bright-beer-mc-v1-';

interface CacheEntry {
  venues: Venue[];
  ts: number;
}

function readCache(cityId: string): Venue[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + cityId);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry.venues;
  } catch {
    return null;
  }
}

function writeCache(cityId: string, venues: Venue[]): void {
  try {
    const entry: CacheEntry = { venues, ts: Date.now() };
    localStorage.setItem(STORAGE_PREFIX + cityId, JSON.stringify(entry));
  } catch {
    /* quota exceeded — skip */
  }
}

interface MultiCityCache {
  venuesByCity: Map<string, Venue[]>;
  loadingCities: Set<string>;
  /** Call on dropdown open to trigger lazy-fetch of all non-active cities. */
  fetchAll: (cities: City[], activeCityId: string) => void;
}

/** Lazy-fetches venue data for all cities when the dropdown opens.
 *  Results are cached in memory + localStorage (15-min TTL). */
export function useMultiCityCache(): MultiCityCache {
  const [venuesByCity, setVenuesByCity] = useState<Map<string, Venue[]>>(new Map());
  const [loadingCities, setLoadingCities] = useState<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  const fetchAll = useCallback((cities: City[], activeCityId: string) => {
    const toFetch = cities.filter(c => c.id !== activeCityId && !inFlightRef.current.has(c.id));
    if (!toFetch.length) return;

    for (const city of toFetch) {
      const cached = readCache(city.id);
      if (cached) {
        setVenuesByCity(prev => new Map(prev).set(city.id, cached));
        continue;
      }

      inFlightRef.current.add(city.id);
      setLoadingCities(prev => new Set(prev).add(city.id));

      fetchVenues(city)
        .then(venues => {
          writeCache(city.id, venues);
          setVenuesByCity(prev => new Map(prev).set(city.id, venues));
        })
        .catch(() => {
          /* network error — leave this city without data */
        })
        .finally(() => {
          inFlightRef.current.delete(city.id);
          setLoadingCities(prev => {
            const next = new Set(prev);
            next.delete(city.id);
            return next;
          });
        });
    }
  }, []);

  return { venuesByCity, loadingCities, fetchAll };
}

import { useCallback, useRef, useState } from 'react';
import type { City } from '../constants/cities';
import type { Venue } from '../lib/overpass';
import { fetchVenues, writePinnedCache, readPinnedCache } from '../lib/overpass';

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

/** Read initial "durable cached" state from localStorage for all known city IDs. */
function readInitialCached(): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('bright-beer-pinned-venues-v1-')) {
      result.add(k.slice('bright-beer-pinned-venues-v1-'.length));
    }
  }
  return result;
}

interface MultiCityCache {
  venuesByCity: Map<string, Venue[]>;
  loadingCities: Set<string>;
  /** City IDs that have durable (offline-ready) data in the pinned cache. */
  cachedCities: Set<string>;
  /** Call on dropdown open to trigger lazy-fetch of all non-active cities. */
  fetchAll: (cities: City[], activeCityId: string) => void;
  /** On pin: fetch (if needed) and write to the durable pinned cache.
   *  Resolves with true on success, false on failure. */
  prefetchAndPersist: (city: City) => Promise<boolean>;
  /** On unpin: remove city from the cached indicator set. */
  evictCached: (cityId: string) => void;
}

/** Lazy-fetches venue data for all cities when the dropdown opens.
 *  Results are cached in memory + localStorage (15-min TTL).
 *  S30: adds a durable pinned-cache write path for offline use. */
export function useMultiCityCache(): MultiCityCache {
  const [venuesByCity, setVenuesByCity] = useState<Map<string, Venue[]>>(new Map());
  const [loadingCities, setLoadingCities] = useState<Set<string>>(new Set());
  // S30 — initialise from localStorage so "available offline" badges survive reload.
  const [cachedCities, setCachedCities] = useState<Set<string>>(readInitialCached);
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

  const prefetchAndPersist = useCallback(async (city: City): Promise<boolean> => {
    try {
      // Use in-memory data if already fetched, otherwise go to the TTL cache or live.
      let venues = venuesByCity.get(city.id) ?? null;
      if (!venues) {
        venues = readCache(city.id);
      }
      if (!venues) {
        // Re-use an existing pinned durable cache entry if present (avoid redundant fetch).
        venues = readPinnedCache(city.id);
      }
      if (!venues) {
        venues = await fetchVenues(city);
        // Also write the short-lived cache to keep fetchAll happy.
        writeCache(city.id, venues);
        setVenuesByCity(prev => new Map(prev).set(city.id, venues!));
      }
      writePinnedCache(city.id, venues);
      setCachedCities(prev => new Set(prev).add(city.id));
      return true;
    } catch {
      return false;
    }
  }, [venuesByCity]);

  const evictCached = useCallback((cityId: string) => {
    setCachedCities(prev => {
      const next = new Set(prev);
      next.delete(cityId);
      return next;
    });
  }, []);

  return { venuesByCity, loadingCities, cachedCities, fetchAll, prefetchAndPersist, evictCached };
}

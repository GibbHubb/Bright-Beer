import { useCallback, useEffect, useRef, useState } from 'react';
import type { Feature, Polygon } from 'geojson';
import type { City } from '../constants/cities';
import type { Venue } from '../lib/overpass';
import { getSunPosition } from '../lib/sunCalc';
import type { RadarWorkerInput, RadarWorkerOutput } from '../workers/radarWorker';

// ── Amsterdam tile grid constants (must match useBuildingTiles / split_buildings.py) ──
const AMSTERDAM_CITY_ID = 'amsterdam';
const ROWS = 8;
const COLS = 8;
const WEST  = 4.72;
const SOUTH = 52.28;
const EAST  = 5.10;
const NORTH = 52.43;
const LAT_STEP = (NORTH - SOUTH) / ROWS;
const LNG_STEP = (EAST  - WEST)  / COLS;

/**
 * Inter-job delay between radar cities (ms).
 * One city at a time keeps the active-city shadow worker unstarved.
 * Counts appear lazily over a second or two for the full city list.
 */
const RADAR_JOB_DELAY_MS = 200;

/** Maximum venues to classify per city — mirrors the App.tsx MAX_VENUES cap. */
const MAX_VENUES = 250;

/** Module-level tile cache (same key format as useBuildingTiles). */
const tileCache = new Map<string, Feature<Polygon>[]>();

function tileUrl(row: number, col: number): string {
  // import.meta.env.BASE_URL is resolved at bundle time by Vite.
  return import.meta.env.BASE_URL + `buildings/tile_${row}_${col}.json`;
}

async function loadTile(row: number, col: number): Promise<Feature<Polygon>[]> {
  const key = `${row}_${col}`;
  if (tileCache.has(key)) return tileCache.get(key)!;
  try {
    const res = await fetch(tileUrl(row, col));
    if (!res.ok) { tileCache.set(key, []); return []; }
    const fc = await res.json() as { features?: Feature<Polygon>[] };
    const features = fc.features ?? [];
    tileCache.set(key, features);
    return features;
  } catch {
    tileCache.set(key, []);
    return [];
  }
}

/** Load all Amsterdam building tiles that overlap the given city bounds. */
async function loadAmsterdamTilesForCity(city: City): Promise<Feature<Polygon>[]> {
  const [west, south, east, north] = city.bounds;
  const colMin = Math.max(0, Math.floor((west  - WEST)  / LNG_STEP));
  const colMax = Math.min(COLS - 1, Math.floor((east  - WEST)  / LNG_STEP));
  const rowMin = Math.max(0, Math.floor((south - SOUTH) / LAT_STEP));
  const rowMax = Math.min(ROWS - 1, Math.floor((north - SOUTH) / LAT_STEP));

  // No overlap with the Amsterdam tile grid → no tiles available.
  if (colMin > colMax || rowMin > rowMax) return [];

  const pairs: [number, number][] = [];
  for (let r = rowMin; r <= rowMax; r++)
    for (let c = colMin; c <= colMax; c++)
      pairs.push([r, c]);

  const results = await Promise.all(pairs.map(([r, c]) => loadTile(r, c)));
  return results.flat();
}

/** Haversine distance in km — used to mirror App.tsx's MAX_VENUES cap. */
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface RadarCounts {
  /** Shadow-accurate counts for non-active cities that have building tiles. */
  accurateCounts: Map<string, number>;
  /** Cities whose accurate count is still being computed by the worker. */
  computingCities: Set<string>;
}

/**
 * Computes shadow-accurate sunny-terrace counts for non-active cities.
 *
 * For each city in `venuesByCity` that is not the active city:
 *   - If the city is Amsterdam (has tiles): loads tiles, posts to radarWorker,
 *     updates `accurateCounts` when the worker replies.
 *   - If the city has no building tiles: skips (caller falls back to sunnyCountFor).
 *
 * The queue processes ONE city at a time with RADAR_JOB_DELAY_MS between jobs
 * so the active-city shadow worker is never starved.
 *
 * Recomputes whenever `date` changes by more than 5 minutes or `venuesByCity` changes.
 */
export function useRadarCounts(
  venuesByCity: Map<string, Venue[]>,
  activeCityId: string,
  cities: City[],
  date: Date,
): RadarCounts {
  const [accurateCounts, setAccurateCounts] = useState<Map<string, number>>(new Map());
  const [computingCities, setComputingCities] = useState<Set<string>>(new Set());

  const workerRef     = useRef<Worker | null>(null);
  const queueRef      = useRef<string[]>([]);
  const processingRef = useRef(false);
  const pendingRef    = useRef<Map<string, (count: number) => void>>(new Map());

  // Track last-used time (quantised to 5-min buckets) and venuesByCity ref
  // to detect when a recompute is actually needed.
  const lastMinuteBucketRef = useRef<number>(-1);
  const lastVenueKeyRef     = useRef<string>('');

  // Stable refs so the processNext callback doesn't close over stale values.
  const venuesByCityRef  = useRef(venuesByCity);
  const citiesRef        = useRef(cities);
  const dateRef          = useRef(date);
  useEffect(() => { venuesByCityRef.current = venuesByCity; }, [venuesByCity]);
  useEffect(() => { citiesRef.current = cities; }, [cities]);
  useEffect(() => { dateRef.current = date; }, [date]);

  // ── Worker lifecycle: create once, handle messages ──────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/radarWorker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent<RadarWorkerOutput>) => {
      const { cityId, sunnyCount } = e.data;
      const resolve = pendingRef.current.get(cityId);
      if (resolve) {
        pendingRef.current.delete(cityId);
        resolve(sunnyCount);
      }
    };

    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // ── Queue processing: one city at a time with inter-job delay ───────────
  const processNext = useCallback(async () => {
    if (processingRef.current || !queueRef.current.length) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const cityId = queueRef.current.shift()!;

      const worker = workerRef.current;
      const venues  = venuesByCityRef.current.get(cityId);

      // Worker gone or venues evicted — stop processing.
      if (!worker || !venues) break;

      const city = citiesRef.current.find(c => c.id === cityId);
      if (!city) continue;

      // Only Amsterdam has building tiles — all others remain horizon-only.
      if (city.id !== AMSTERDAM_CITY_ID) continue;

      setComputingCities(prev => new Set(prev).add(cityId));

      const buildings = await loadAmsterdamTilesForCity(city);

      // No buildings resolved (city outside Amsterdam tile grid) → skip silently.
      if (!buildings.length) {
        setComputingCities(prev => { const s = new Set(prev); s.delete(cityId); return s; });
        continue;
      }

      const sun = getSunPosition(dateRef.current, city.center);

      // Cap venues to MAX_VENUES closest to city centre (mirrors App.tsx).
      const [cLng, cLat] = city.center;
      const cappedVenues = venues.length > MAX_VENUES
        ? venues
            .map(v => ({ v, d: distKm(v.lat, v.lng, cLat, cLng) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, MAX_VENUES)
            .map(({ v }) => v)
        : venues;

      // Post to worker and await response via promise.
      const count = await new Promise<number>((resolve) => {
        pendingRef.current.set(cityId, resolve);
        const msg: RadarWorkerInput = {
          cityId,
          venues:    cappedVenues,
          buildings,
          azimuth:   sun.azimuth,
          altitude:  sun.altitude,
        };
        worker.postMessage(msg);
      });

      setAccurateCounts(prev => new Map(prev).set(cityId, count));
      setComputingCities(prev => { const s = new Set(prev); s.delete(cityId); return s; });

      // Inter-job delay — keeps the active-city shadow worker unstarved.
      if (queueRef.current.length > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, RADAR_JOB_DELAY_MS));
      }
    }

    processingRef.current = false;
  }, []); // stable — reads all reactive values through refs

  // ── Trigger recompute when time bucket or venue set changes ─────────────
  useEffect(() => {
    // Quantise to 5-minute buckets so slider drags don't flood the queue.
    const bucket   = Math.floor(date.getTime() / (5 * 60 * 1000));
    const venueKey = [...venuesByCity.keys()].sort().join(',');

    if (bucket === lastMinuteBucketRef.current && venueKey === lastVenueKeyRef.current) return;
    lastMinuteBucketRef.current = bucket;
    lastVenueKeyRef.current     = venueKey;

    // Clear stale counts so the dropdown shows the computing state.
    // Deferred via setTimeout so the state update is not synchronous within
    // the effect body (avoids react-hooks/set-state-in-effect violation).
    setTimeout(() => {
      setAccurateCounts(new Map());
      setComputingCities(new Set());
    }, 0);
    pendingRef.current.clear();
    processingRef.current = false;

    // Queue: only non-active cities with tile support (currently Amsterdam only).
    const toCities = cities.filter(
      c => c.id !== activeCityId && venuesByCity.has(c.id) && c.id === AMSTERDAM_CITY_ID,
    );
    queueRef.current = toCities.map(c => c.id);

    processNext();
  }, [date, venuesByCity, activeCityId, cities, processNext]);

  return { accurateCounts, computingCities };
}

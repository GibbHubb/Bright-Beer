import { useState, useEffect, useRef, useCallback } from 'react';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import type { ShadowWorkerOutput } from '../workers/shadowWorker';
import type { SunPosition } from '../lib/sunCalc';

const EMPTY: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };

const MIN_SHADOW_ZOOM = 13; // don't compute shadows below this zoom

export function useShadows(
  buildings: Feature<Polygon>[],
  sun: SunPosition,
  zoom?: number,
): FeatureCollection<Polygon> {
  const [shadows, setShadows] = useState<FeatureCollection<Polygon>>(EMPTY);
  const workerRef  = useRef<Worker | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialise worker once
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/shadowWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current.onmessage = (e: MessageEvent<ShadowWorkerOutput>) => {
      setShadows(e.data.shadows);
    };
    return () => { workerRef.current?.terminate(); };
  }, []);

  const compute = useCallback(() => {
    if (!workerRef.current || !sun.isAboveHorizon || !buildings.length
        || (zoom !== undefined && zoom < MIN_SHADOW_ZOOM)) {
      setShadows(EMPTY);
      return;
    }
    workerRef.current.postMessage({
      buildings,
      azimuth:  sun.azimuth,
      altitude: sun.altitude,
    });
  }, [buildings, sun.azimuth, sun.altitude, sun.isAboveHorizon, zoom]);

  // Debounce 100ms so slider drags don't flood the worker
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(compute, 100);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [compute]);

  return shadows;
}

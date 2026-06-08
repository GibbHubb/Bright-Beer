import SunCalc from 'suncalc';
import { AMSTERDAM_CENTER } from '../constants/amsterdam';

export interface SunPosition {
  azimuth: number;    // radians, measured from south clockwise
  altitude: number;   // radians, above horizon
  isAboveHorizon: boolean;
}

// S12 — city-aware reference point. Module-level mutable so legacy callers
// that don't thread coords keep working; the active city should call
// `setSunReferencePoint([lng, lat])` once per change.
let _refLng = AMSTERDAM_CENTER[0];
let _refLat = AMSTERDAM_CENTER[1];

export function setSunReferencePoint(center: [number, number]) {
  _refLng = center[0];
  _refLat = center[1];
}

export function getSunPosition(date: Date, center?: [number, number]): SunPosition {
  const lng = center ? center[0] : _refLng;
  const lat = center ? center[1] : _refLat;
  const pos = SunCalc.getPosition(date, lat, lng);
  return {
    azimuth:        pos.azimuth,          // radians from south, clockwise
    altitude:       pos.altitude,         // radians above horizon
    isAboveHorizon: pos.altitude > 0.017, // ~1° threshold (avoid grazing edge cases)
  };
}

/** Returns the sun times for a given date (sunrise, sunset, golden hour, etc.) */
export function getSunTimes(date: Date, center?: [number, number]) {
  const lng = center ? center[0] : _refLng;
  const lat = center ? center[1] : _refLat;
  return SunCalc.getTimes(date, lat, lng);
}

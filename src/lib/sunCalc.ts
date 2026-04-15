import SunCalc from 'suncalc';
import { AMSTERDAM_CENTER } from '../constants/amsterdam';

export interface SunPosition {
  azimuth: number;    // radians, measured from south clockwise
  altitude: number;   // radians, above horizon
  isAboveHorizon: boolean;
}

const [lng, lat] = AMSTERDAM_CENTER;

export function getSunPosition(date: Date): SunPosition {
  const pos = SunCalc.getPosition(date, lat, lng);
  return {
    azimuth:        pos.azimuth,          // radians from south, clockwise
    altitude:       pos.altitude,         // radians above horizon
    isAboveHorizon: pos.altitude > 0.017, // ~1° threshold (avoid grazing edge cases)
  };
}

/** Returns the sun times for a given date (sunrise, sunset, golden hour, etc.) */
export function getSunTimes(date: Date) {
  return SunCalc.getTimes(date, lat, lng);
}

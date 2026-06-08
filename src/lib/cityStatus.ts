import type { City } from '../constants/cities';
import type { Venue } from './overpass';
import { getSunPosition } from './sunCalc';

/** Approximate sunny-terrace count for a city at the given time.
 *  Uses sun-above-horizon check only (no building shadows for non-active cities). */
export function sunnyCountFor(city: City, venues: Venue[], date: Date): number {
  const pos = getSunPosition(date, city.center);
  if (!pos.isAboveHorizon) return 0;
  return venues.filter(v => v.hasOutdoorSeating).length;
}

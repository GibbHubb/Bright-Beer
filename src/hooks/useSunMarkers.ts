import { useMemo } from 'react';
import { getSunTimes } from '../lib/sunCalc';

export interface SunMarker {
  type: 'dawn' | 'sunrise' | 'goldenHourEnd' | 'goldenHour' | 'sunsetStart' | 'sunset' | 'dusk';
  label: string;
  minutes: number;
}

function toSliderMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Returns morning + evening sun-event markers for the given date + city.
 *  Morning: dawn, sunrise, goldenHourEnd (S31).
 *  Evening: goldenHour, sunsetStart, sunset, dusk (S26).
 *  Invalid-Date entries (polar edge cases) are silently dropped. */
export function useSunMarkers(date: Date, cityCentre: [number, number]): SunMarker[] {
  return useMemo(() => {
    const times = getSunTimes(date, cityCentre) as unknown as Record<string, Date>;

    const candidates: Array<{ key: string; type: SunMarker['type']; name: string }> = [
      // Morning cluster (S31)
      { key: 'dawn',          type: 'dawn',          name: 'Dawn' },
      { key: 'sunrise',       type: 'sunrise',       name: 'Sunrise' },
      { key: 'goldenHourEnd', type: 'goldenHourEnd', name: 'Golden hr end' },
      // Evening cluster (S26)
      { key: 'goldenHour',    type: 'goldenHour',    name: 'Golden hour' },
      { key: 'sunsetStart',   type: 'sunsetStart',   name: 'Sunset start' },
      { key: 'sunset',        type: 'sunset',        name: 'Sunset' },
      { key: 'dusk',          type: 'dusk',          name: 'Dusk' },
    ];

    return candidates
      .map(({ key, type, name }) => {
        const d = times[key];
        if (!d || isNaN(d.getTime())) return null;
        const minutes = toSliderMinutes(d);
        const hhmm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return { type, label: `${name} ${hhmm}`, minutes };
      })
      .filter((m): m is SunMarker => m !== null);
  }, [date, cityCentre]);
}

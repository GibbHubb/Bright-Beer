import { useMemo } from 'react';
import { getSunTimes } from '../lib/sunCalc';

export interface SunMarker {
  type: 'goldenHour' | 'sunsetStart' | 'sunset' | 'dusk';
  label: string;
  minutes: number;
}

function toSliderMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Returns evening sun-event markers (golden hour, sunset, dusk) for the given date + city. */
export function useSunMarkers(date: Date, cityCentre: [number, number]): SunMarker[] {
  return useMemo(() => {
    const times = getSunTimes(date, cityCentre) as unknown as Record<string, Date>;

    const candidates: Array<{ key: string; type: SunMarker['type']; name: string }> = [
      { key: 'goldenHour',  type: 'goldenHour',  name: 'Golden hour' },
      { key: 'sunsetStart', type: 'sunsetStart',  name: 'Sunset start' },
      { key: 'sunset',      type: 'sunset',       name: 'Sunset' },
      { key: 'dusk',        type: 'dusk',         name: 'Dusk' },
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

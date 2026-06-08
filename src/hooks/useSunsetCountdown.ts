import { useMemo } from 'react';
import { getSunTimes } from '../lib/sunCalc';
import { useNow } from './useNow';

export interface SunsetCountdown {
  minutesLeft: number;
  sunsetTime: Date;
  isToday: boolean;
  afterSunset: boolean;
}

/** Countdown to sunset for the given date + city, ticking every minute via useNow. */
export function useSunsetCountdown(
  dateStr: string,
  cityCentre: [number, number],
): SunsetCountdown | null {
  const now = useNow();

  return useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const noon = new Date(y, m - 1, d, 12, 0, 0);
    const times = getSunTimes(noon, cityCentre);
    const sunset = (times as unknown as Record<string, Date>).sunset;
    if (!sunset || isNaN(sunset.getTime())) return null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = dateStr === todayStr;
    const diffMs = sunset.getTime() - now.getTime();
    const minutesLeft = Math.round(diffMs / 60000);
    const afterSunset = diffMs <= 0;

    return { minutesLeft, sunsetTime: sunset, isToday, afterSunset };
  }, [dateStr, cityCentre, now]);
}

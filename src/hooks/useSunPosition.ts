import { useMemo } from 'react';
import { getSunPosition, type SunPosition } from '../lib/sunCalc';

export function useSunPosition(date: Date): SunPosition {
  return useMemo(() => getSunPosition(date), [date.getTime()]);
}

import { useMemo } from 'react';
import { getSunPosition, type SunPosition } from '../lib/sunCalc';

export function useSunPosition(date: Date): SunPosition {
  // S31-fu1 — the dependency must be a simple expression the linter can check
  // statically, so the timestamp is extracted first. Memoising on the number
  // (not the Date object) is also what we actually want: two distinct Date
  // instances for the same instant should not recompute.
  const timestamp = date.getTime();
  return useMemo(() => getSunPosition(new Date(timestamp)), [timestamp]);
}

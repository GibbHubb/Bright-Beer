// S9 — single shared "current minute" ticker. One setInterval per page,
// no per-component timers — anything that needs to recompute on the
// minute reads from this hook.

import { useEffect, useState } from 'react';

const TICK_MS = 60 * 1000;

export function useNow(): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    // Align the first tick to the *next* minute boundary so all consumers
    // tick simultaneously, then fall back to a regular interval.
    const ms = new Date();
    const msUntilNextMinute = TICK_MS - (ms.getSeconds() * 1000 + ms.getMilliseconds());

    let interval: ReturnType<typeof setInterval> | null = null;
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), TICK_MS);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, []);

  return now;
}

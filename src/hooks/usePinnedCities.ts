import { useState, useCallback } from 'react';

const STORAGE_KEY = 'bright-beer-pinned-v1';

function readPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {
    /* malformed — start fresh */
  }
  return new Set();
}

function writePinned(pinned: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinned]));
  } catch {
    /* quota exceeded — skip */
  }
}

export interface PinnedCities {
  /** City IDs currently pinned by the user. */
  pinned: Set<string>;
  /** Returns true if a city is in the pinned set. */
  isPinned: (cityId: string) => boolean;
  /** Pin a city — persists the update to localStorage. */
  pin: (cityId: string) => void;
  /** Unpin a city — persists the update and evicts its durable cache. */
  unpin: (cityId: string) => void;
}

/** Persists the user's pinned city set in localStorage. */
export function usePinnedCities(): PinnedCities {
  const [pinned, setPinned] = useState<Set<string>>(readPinned);

  const isPinned = useCallback((cityId: string) => pinned.has(cityId), [pinned]);

  const pin = useCallback((cityId: string) => {
    setPinned(prev => {
      const next = new Set(prev);
      next.add(cityId);
      writePinned(next);
      return next;
    });
  }, []);

  const unpin = useCallback((cityId: string) => {
    setPinned(prev => {
      const next = new Set(prev);
      next.delete(cityId);
      writePinned(next);
      // Evict the durable cache slot for this city.
      try {
        localStorage.removeItem('bright-beer-pinned-venues-v1-' + cityId);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { pinned, isPinned, pin, unpin };
}

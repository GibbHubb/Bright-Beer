import { useState, useEffect } from 'react';
import { fetchVenues, readPinnedCache, type Venue } from '../lib/overpass';
import { DEFAULT_CITY_ID, type City } from '../constants/cities';

const STATIC_VENUES_URL = import.meta.env.BASE_URL + 'venues.json';

async function loadVenues(city?: City): Promise<Venue[]> {
  // 1. Try static pre-baked file — only valid for the default city since
  // we ship one venues.json. Other cities skip straight to Overpass.
  if (!city || city.id === DEFAULT_CITY_ID) {
    try {
      const res = await fetch(STATIC_VENUES_URL);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.venues) && data.venues.length > 0) {
          return data.venues as Venue[];
        }
      }
    } catch { /* static file unreachable — fall through to live Overpass */ }
  }

  // 2. Try live Overpass (with its own 24 h TTL cache and S30 durable-fallback
  //    built into fetchVenues — see overpass.ts).
  try {
    return await fetchVenues(city);
  } catch (_) {
    // 3. S30 — last-resort durable pinned cache for non-Amsterdam cities.
    //    fetchVenues already checks this internally, but if city is undefined
    //    (Amsterdam legacy path) we skip this since the static file covers it.
    if (city) {
      const pinned = readPinnedCache(city.id);
      if (pinned) return pinned;
    }
    throw _;
  }
}

export function useVenues(city?: City) {
  const [venues,  setVenues]  = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    // S31-fu1 — react-hooks/set-state-in-effect flags this reset-then-fetch
    // shape. Removing it means deriving `loading` from whether the loaded
    // city matches the requested one, which is a real rework of this hook's
    // state machine; suppressed rather than changed blind. Tracked as S31-fu2.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    loadVenues(city)
      .then(setVenues)
      .catch((e) => setError(e.message || 'Failed to load venues'))
      .finally(() => setLoading(false));
    // Re-fetch on city change.
  }, [city?.id]);

  return { venues, loading, error };
}

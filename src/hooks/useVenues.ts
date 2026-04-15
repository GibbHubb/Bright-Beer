import { useState, useEffect } from 'react';
import { fetchVenues, type Venue } from '../lib/overpass';

const STATIC_VENUES_URL = import.meta.env.BASE_URL + 'venues.json';

async function loadVenues(): Promise<Venue[]> {
  // 1. Try static pre-baked file (fast, no rate-limit risk)
  try {
    const res = await fetch(STATIC_VENUES_URL);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.venues) && data.venues.length > 0) {
        return data.venues as Venue[];
      }
    }
  } catch (_) {}

  // 2. Fall back to live Overpass query
  return fetchVenues();
}

export function useVenues() {
  const [venues,  setVenues]  = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    loadVenues()
      .then(setVenues)
      .catch((e) => setError(e.message || 'Failed to load venues'))
      .finally(() => setLoading(false));
  }, []);

  return { venues, loading, error };
}

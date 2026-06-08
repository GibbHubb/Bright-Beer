import { useState, useEffect } from 'react';
import { fetchVenues, type Venue } from '../lib/overpass';
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
    } catch (_) {}
  }

  // 2. Fall back to live Overpass query for the active city
  return fetchVenues(city);
}

export function useVenues(city?: City) {
  const [venues,  setVenues]  = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
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

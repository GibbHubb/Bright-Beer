import { useState, useEffect } from 'react';
import { fetchVenues, type Venue } from '../lib/overpass';

export function useVenues() {
  const [venues, setVenues]   = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetchVenues()
      .then(setVenues)
      .catch((e) => setError(e.message || 'Failed to load venues'))
      .finally(() => setLoading(false));
  }, []);

  return { venues, loading, error };
}

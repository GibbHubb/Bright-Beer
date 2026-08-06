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

/** Distinct from every real city id (including `undefined`, the Amsterdam
 *  legacy path), so the first render always reads as "not loaded yet". */
const UNLOADED = Symbol('unloaded');

interface VenuesState {
  /** Which city the venues/error below belong to. */
  loadedFor: string | undefined | typeof UNLOADED;
  venues: Venue[];
  error: string | null;
}

export function useVenues(city?: City) {
  const requestedId = city?.id;
  const [state, setState] = useState<VenuesState>({
    loadedFor: UNLOADED,
    venues: [],
    error: null,
  });

  useEffect(() => {
    // S31-fu2 — no setState before the await. `loading` is derived below from
    // whether the settled result belongs to the city currently being asked
    // for, which is the same signal `setLoading(true)` used to encode, minus
    // the cascading render the rule objects to.
    let cancelled = false;
    loadVenues(city)
      .then((venues) => {
        if (!cancelled) setState({ loadedFor: requestedId, venues, error: null });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            loadedFor: requestedId,
            venues: [],
            error: e?.message || 'Failed to load venues',
          });
        }
      });
    // Also fixes a latent race: switching city A -> B quickly could land A's
    // slower response after B's and show the wrong city's venues.
    return () => { cancelled = true; };
    // `city` is identified by its id here; depending on the object itself
    // would refetch on every parent render that rebuilds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId]);

  const loading = state.loadedFor !== requestedId;

  // Deliberately keeps the previous city's venues visible while the next set
  // loads, and hides a stale error — exactly what setVenues-on-success plus
  // setError(null)-on-start used to do.
  return { venues: state.venues, loading, error: loading ? null : state.error };
}

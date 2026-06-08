// S12 — active city, sourced from `?city=<slug>` (defaults to amsterdam).
// Switching writes back via history.replaceState so the URL stays shareable.

import { useCallback, useState } from 'react';
import { CITIES, DEFAULT_CITY_ID, getCity, type City } from '../constants/cities';

function readCityFromUrl(): City {
  const params = new URLSearchParams(window.location.search);
  return getCity(params.get('city') || DEFAULT_CITY_ID);
}

export function useCity(): {
  city: City;
  cities: City[];
  setCityId: (id: string) => void;
} {
  const [city, setCity] = useState<City>(() => readCityFromUrl());

  const setCityId = useCallback((id: string) => {
    const next = getCity(id);
    setCity(next);
    const url = new URL(window.location.href);
    if (next.id === DEFAULT_CITY_ID) url.searchParams.delete('city');
    else url.searchParams.set('city', next.id);
    // Clear old neighbourhood/venue params — they're city-scoped.
    url.searchParams.delete('hood');
    url.searchParams.delete('venue');
    window.history.replaceState({}, '', url.toString());
  }, []);

  return { city, cities: CITIES, setCityId };
}

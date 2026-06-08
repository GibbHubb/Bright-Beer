// S12 — multi-city registry. Adding a third city = appending to this object.
// No code change required elsewhere if the new city follows the same shape.

export interface City {
  id:           string;                                // URL slug
  name:         string;
  center:       [number, number];                      // [lng, lat]
  defaultZoom:  number;
  minZoom:      number;
  /** Overpass `[bbox:...]` macro form: 'south,west,north,east'. */
  overpassBbox: string;
  /** MapLibre/Mapbox bounds: [west, south, east, north]. */
  bounds:       [number, number, number, number];
}

export const CITIES: City[] = [
  {
    id:           'amsterdam',
    name:         'Amsterdam',
    center:       [4.9041, 52.3676],
    defaultZoom:  14,
    minZoom:      12,
    overpassBbox: '52.28,4.72,52.43,5.10',
    bounds:       [4.72, 52.28, 5.10, 52.43],
  },
  {
    id:           'rotterdam',
    name:         'Rotterdam',
    center:       [4.4777, 51.9244],
    defaultZoom:  14,
    minZoom:      12,
    // Rough rectangle around Rotterdam metro.
    overpassBbox: '51.85,4.35,52.00,4.62',
    bounds:       [4.35, 51.85, 4.62, 52.00],
  },
];

export const DEFAULT_CITY_ID = 'amsterdam';

export function getCity(id: string | null | undefined): City {
  if (!id) return CITIES[0];
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}

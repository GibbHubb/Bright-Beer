export const AMSTERDAM_CENTER: [number, number] = [4.9041, 52.3676]; // [lng, lat]
export const DEFAULT_ZOOM = 14;
export const DEFAULT_MIN_ZOOM = 12;

// Bounding box for Overpass queries [south, west, north, east]
export const AMSTERDAM_BBOX = '52.28,4.72,52.43,5.10';

// Mapbox-style bbox [west, south, east, north]
export const AMSTERDAM_BOUNDS: [number, number, number, number] = [4.72, 52.28, 5.10, 52.43];

export const DEFAULT_BUILDING_HEIGHT_M = 10;

// Stadia Maps free dark basemap — no API key required
export const BASEMAP_STYLE =
  'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json';

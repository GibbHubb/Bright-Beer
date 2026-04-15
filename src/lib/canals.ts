/**
 * Approximate corridor bounding boxes for Amsterdam's main canals.
 * Used for the "Canal-side" venue filter.
 * Each box is a ~60m-wide strip centred on the canal.
 */
interface CanalBox {
  name:   string;
  minLat: number; maxLat: number;
  minLng: number; maxLng: number;
}

const CANAL_CORRIDORS: CanalBox[] = [
  // Singel
  { name: 'Singel',         minLat: 52.364, maxLat: 52.381, minLng: 4.887, maxLng: 4.901 },
  // Herengracht
  { name: 'Herengracht',    minLat: 52.360, maxLat: 52.381, minLng: 4.884, maxLng: 4.899 },
  // Keizersgracht
  { name: 'Keizersgracht',  minLat: 52.357, maxLat: 52.381, minLng: 4.880, maxLng: 4.897 },
  // Prinsengracht
  { name: 'Prinsengracht',  minLat: 52.355, maxLat: 52.382, minLng: 4.876, maxLng: 4.895 },
  // Amstel (south section)
  { name: 'Amstel',         minLat: 52.355, maxLat: 52.370, minLng: 4.899, maxLng: 4.910 },
  // Brouwersgracht (north end of canal ring)
  { name: 'Brouwersgracht', minLat: 52.381, maxLat: 52.386, minLng: 4.879, maxLng: 4.902 },
  // Reguliersgracht
  { name: 'Reguliersgracht',minLat: 52.360, maxLat: 52.368, minLng: 4.893, maxLng: 4.900 },
  // Leidsegracht
  { name: 'Leidsegracht',   minLat: 52.364, maxLat: 52.371, minLng: 4.877, maxLng: 4.887 },
];

export function isNearCanal(lat: number, lng: number): boolean {
  return CANAL_CORRIDORS.some(
    (c) => lat >= c.minLat && lat <= c.maxLat && lng >= c.minLng && lng <= c.maxLng,
  );
}

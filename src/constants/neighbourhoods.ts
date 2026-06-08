/**
 * S8 / S12 — Neighbourhood bounding boxes per city.
 *
 * Each bbox is [south, west, north, east] — generous enough to catch venues
 * on the edges. These are approximate rectangular clips, not true polygon
 * boundaries; they're only used for coarse venue-list filtering.
 */
export interface Neighbourhood {
  id:   string;
  name: string;
  /** [south, west, north, east] in WGS84 degrees. */
  bbox: [number, number, number, number];
}

const AMSTERDAM: Neighbourhood[] = [
  { id: 'centrum',  name: 'Centrum',  bbox: [52.364, 4.885, 52.385, 4.915] },
  { id: 'jordaan',  name: 'Jordaan',  bbox: [52.370, 4.875, 52.388, 4.895] },
  { id: 'de-pijp',  name: 'De Pijp',  bbox: [52.348, 4.885, 52.365, 4.910] },
  { id: 'oost',     name: 'Oost',     bbox: [52.350, 4.910, 52.375, 4.955] },
  { id: 'noord',    name: 'Noord',    bbox: [52.380, 4.880, 52.420, 4.960] },
  { id: 'west',     name: 'West',     bbox: [52.365, 4.840, 52.390, 4.885] },
];

const ROTTERDAM: Neighbourhood[] = [
  { id: 'centrum',     name: 'Centrum',     bbox: [51.915, 4.470, 51.930, 4.495] },
  { id: 'kralingen',   name: 'Kralingen',   bbox: [51.918, 4.500, 51.940, 4.545] },
  { id: 'delfshaven',  name: 'Delfshaven',  bbox: [51.905, 4.430, 51.925, 4.470] },
  { id: 'kop-van-zuid',name: 'Kop van Zuid',bbox: [51.895, 4.480, 51.915, 4.510] },
  { id: 'noord',       name: 'Noord',       bbox: [51.928, 4.460, 51.950, 4.500] },
  { id: 'hillegersberg',name: 'Hillegersberg',bbox: [51.945, 4.470, 51.975, 4.510] },
  { id: 'katendrecht', name: 'Katendrecht', bbox: [51.890, 4.470, 51.905, 4.495] },
  { id: 'oude-westen', name: 'Oude Westen', bbox: [51.915, 4.460, 51.925, 4.480] },
];

const REGISTRY: Record<string, Neighbourhood[]> = {
  amsterdam: AMSTERDAM,
  rotterdam: ROTTERDAM,
};

/** S12 — Get neighbourhoods for a given city slug. Empty list for unknown. */
export function getNeighbourhoods(cityId: string): Neighbourhood[] {
  return REGISTRY[cityId] ?? [];
}

/** S12 — Look up a neighbourhood by id within a given city. */
export function findNeighbourhood(id: string | null, cityId = 'amsterdam'): Neighbourhood | null {
  if (!id) return null;
  return getNeighbourhoods(cityId).find((n) => n.id === id) ?? null;
}

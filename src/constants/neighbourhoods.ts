/**
 * S8 — Amsterdam neighbourhood bounding boxes.
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

export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    id:   'centrum',
    name: 'Centrum',
    bbox: [52.364, 4.885, 52.385, 4.915],
  },
  {
    id:   'jordaan',
    name: 'Jordaan',
    bbox: [52.370, 4.875, 52.388, 4.895],
  },
  {
    id:   'de-pijp',
    name: 'De Pijp',
    bbox: [52.348, 4.885, 52.365, 4.910],
  },
  {
    id:   'oost',
    name: 'Oost',
    bbox: [52.350, 4.910, 52.375, 4.955],
  },
  {
    id:   'noord',
    name: 'Noord',
    bbox: [52.380, 4.880, 52.420, 4.960],
  },
  {
    id:   'west',
    name: 'West',
    bbox: [52.365, 4.840, 52.390, 4.885],
  },
];

export function findNeighbourhood(id: string | null): Neighbourhood | null {
  if (!id) return null;
  return NEIGHBOURHOODS.find((n) => n.id === id) ?? null;
}

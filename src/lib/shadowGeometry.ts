import type { Feature, Polygon, Position } from 'geojson';
import { DEFAULT_BUILDING_HEIGHT_M } from '../constants/amsterdam';

const DEG_PER_METER_LAT = 1 / 111320;

function metersToDegLng(meters: number, lat: number): number {
  return meters / (111320 * Math.cos((lat * Math.PI) / 180));
}

/**
 * Project a single building footprint into a shadow polygon.
 *
 * @param building  GeoJSON Polygon feature with optional height/building:levels in properties
 * @param azimuth   Sun azimuth in radians (SunCalc convention: 0 = south, east = negative, west = positive)
 * @param altitude  Sun altitude in radians above horizon
 * @returns         Shadow polygon as GeoJSON Feature<Polygon>, or null if sun is below horizon
 */
export function projectShadow(
  building: Feature<Polygon>,
  azimuth: number,
  altitude: number,
): Feature<Polygon> | null {
  if (altitude <= 0.017) return null; // sun below effective horizon

  // Resolve building height
  const props = building.properties || {};
  let height: number = DEFAULT_BUILDING_HEIGHT_M;
  if (props['height']) {
    const h = parseFloat(String(props['height']));
    if (!isNaN(h)) height = h;
  } else if (props['building:levels']) {
    const lvls = parseFloat(String(props['building:levels']));
    if (!isNaN(lvls)) height = lvls * 3.2; // ~3.2m per floor
  }

  // Shadow length in metres
  const shadowLength = height / Math.tan(altitude);
  if (shadowLength < 0.5) return null; // negligible at high sun

  // SunCalc azimuth: 0 = south, east = -π/2, west = +π/2
  // We want the direction shadows point: OPPOSITE of the sun → add π
  const shadowBearing = azimuth + Math.PI; // direction shadow falls

  const coords = building.geometry.coordinates[0];
  if (!coords || coords.length < 4) return null;

  // Average latitude of the building for lng-meter conversion
  const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;

  const dLat = Math.cos(shadowBearing) * shadowLength * DEG_PER_METER_LAT;
  const dLng = Math.sin(shadowBearing) * shadowLength * metersToDegLng(1, avgLat);

  // Shadow polygon = building ring + projected ring, convex hull approximation
  const projected: Position[] = coords.map(([lng, lat]) => [lng + dLng, lat + dLat]);

  // Combine both rings into one set of points and take a simple convex hull
  const allPoints = [...coords, ...projected];
  const hull = convexHull(allPoints);

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [hull] },
  };
}

// ── Minimal gift-wrapping convex hull ──────────────────────────────────────
function cross(O: Position, A: Position, B: Position): number {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

function convexHull(points: Position[]): Position[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const n = pts.length;
  if (n < 3) return [...pts, pts[0]];

  const lower: Position[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Position[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];
  hull.push(hull[0]); // close ring
  return hull;
}

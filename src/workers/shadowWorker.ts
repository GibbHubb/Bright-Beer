import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { projectShadow } from '../lib/shadowGeometry';

export interface ShadowWorkerInput {
  buildings: Feature<Polygon>[];
  azimuth:   number;
  altitude:  number;
}

export interface ShadowWorkerOutput {
  shadows: FeatureCollection<Polygon>;
}

self.onmessage = (e: MessageEvent<ShadowWorkerInput>) => {
  const { buildings, azimuth, altitude } = e.data;

  const features: Feature<Polygon>[] = [];

  for (const building of buildings) {
    const shadow = projectShadow(building, azimuth, altitude);
    if (shadow) features.push(shadow);
  }

  const result: ShadowWorkerOutput = {
    shadows: { type: 'FeatureCollection', features },
  };

  self.postMessage(result);
};

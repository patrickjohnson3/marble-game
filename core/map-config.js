import { resolveSeededMapConfig } from "./map-variants.js";
import {
  authoredMapVariants,
  mapVariants as staticMapVariants,
} from "../maps/map-data.js";

export { authoredMapVariants };

const mapScale = 2;

const baseMapDefaults = {
  seed: "kitchen-floor",
  variants: staticMapVariants,
  world: {
    width: 2200 * mapScale,
    height: 2200 * mapScale,
  },
  spawn: {
    x: 1100 * mapScale,
    y: 1100 * mapScale,
    r: 29,
  },
  grid: {
    size: 10,
  },
  reachability: {
    minCellSize: 5,
    gridDivisor: 2,
    spawnRadiusDivisor: 2,
  },
  intro: {
    wallThickness: 34,
    viewportMargin: 18,
  },
  camera: {
    minScale: 0.12,
    maxScale: 2.5,
    followLag: 0.08,
  },
  light: {
    x: 420,
    y: 260,
    shadowMinDistance: 5,
    shadowMaxDistance: 12,
    shadowMinBlur: 8,
    shadowMaxBlur: 15,
    contactShadowY: 3,
    contactShadowBlur: 5,
  },
};

export const mapVariants = staticMapVariants;

export const baseMapConfig = {
  ...baseMapDefaults,
  variants: mapVariants,
};

export const resolvedMapConfig = resolveSeededMapConfig(baseMapConfig);

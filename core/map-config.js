import { resolveMapVariantConfig } from "./map-variants.js";
import {
  authoredMapVariants,
  mapVariants as staticMapVariants,
} from "../maps/map-data.js";

export { authoredMapVariants };

const baseMapDefaults = {
  variants: staticMapVariants,
  world: {
    width: 4400,
    height: 4400,
  },
  spawn: {
    x: 2200,
    y: 2200,
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

export const resolvedMapConfig = resolveMapVariantConfig(
  baseMapConfig,
  "kitchen-floor",
);

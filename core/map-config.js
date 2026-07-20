import { resolveInitialMapConfig } from "./procedural-map.js";
import { mapVariants } from "../maps/map-data.js";

export { mapVariants };

const mapScale = 2;

export const baseMapConfig = {
  seed: "default",
  variants: mapVariants,
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
    predictiveLookAheadFrames: 18,
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

export const resolvedMapConfig = resolveInitialMapConfig(baseMapConfig);

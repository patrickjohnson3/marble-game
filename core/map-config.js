import { generateProceduralMapVariants } from "./procedural-generator.js";
import { resolveSeededMapConfig } from "./map-variants.js";
import { mapVariants as authoredMapVariants } from "../maps/map-data.js";

export { authoredMapVariants };

const mapScale = 2;
const generatedVariantCount = 6;

const baseMapDefaults = {
  seed: "kitchen-floor",
  variants: authoredMapVariants,
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

export const mapVariants = [
  ...authoredMapVariants,
  ...generateProceduralMapVariants({
    baseMapConfig: baseMapDefaults,
    count: generatedVariantCount,
    seed: "procedural",
  }),
];

export const baseMapConfig = {
  ...baseMapDefaults,
  variants: mapVariants,
};

export const resolvedMapConfig = resolveSeededMapConfig(baseMapConfig);

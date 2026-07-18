import {
  goal,
  mapConfig,
  obstacle,
  roughPatch,
  spawn,
} from "./map-builders.js";

export const variantSelectionFixtures = [
  { id: "a", elements: [obstacle({ x: 0, y: 0 })] },
  { id: "b", elements: [roughPatch()] },
];

export const simpleSeededMapConfig = {
  seed: "seed-a",
  variants: [
    {
      id: "only",
      elements: [obstacle({ x: 0, y: 0 })],
      goal: goal(),
    },
  ],
  spawn: spawn(),
  world: { width: 100, height: 100 },
};

export const missingElementsVariantConfig = {
  seed: "bad-variant",
  variants: [{ id: "bad-variant", goal: goal() }],
  spawn: spawn(),
  world: { width: 100, height: 100 },
};

export const malformedVariantConfig = {
  seed: "seed-a",
  variants: [
    null,
    {
      id: "safe",
      elements: [],
      goal: goal(),
    },
  ],
  spawn: spawn(),
  world: { width: 100, height: 100 },
};

export const blockedSpawnConfig = mapConfig({
  elements: [obstacle({ x: 45, y: 45 })],
  spawn: spawn({ x: 50, y: 50, r: 8 }),
});

export const invalidElementConfig = mapConfig({ elements: [null] });

export const emptyElementMapConfig = mapConfig();

export const variantWorldMismatchConfig = {
  ...emptyElementMapConfig,
  variants: [{ id: "other-size", world: { width: 120, height: 100 } }],
};

export const unreachableGoalConfig = {
  world: { width: 100, height: 100 },
  grid: { size: 10 },
  elements: [obstacle({ x: 50, y: 0, w: 10, h: 100 })],
  spawn: spawn({ x: 20, y: 50 }),
  goal: goal({ x: 80, y: 50, r: 12 }),
};

export const smallJoinOverhangRects = [
  { x: 0, y: 20, w: 100, h: 20 },
  { x: 80, y: 0, w: 20, h: 50 },
];

export const touchingJoinOverhangRects = [
  { x: 0, y: 20, w: 100, h: 20 },
  { x: 100, y: 0, w: 20, h: 50 },
];

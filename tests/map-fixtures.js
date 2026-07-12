export const variantSelectionFixtures = [
  { id: "a", elements: [{ type: "obstacle", x: 0, y: 0, w: 10, h: 10 }] },
  { id: "b", elements: [{ type: "roughPatch", x: 10, y: 10, w: 20, h: 20 }] }
];

export const simpleSeededMapConfig = {
  seed: "seed-a",
  variants: [
    {
      id: "only",
      elements: [{ type: "obstacle", x: 0, y: 0, w: 10, h: 10 }],
      goal: { x: 80, y: 80, r: 10, holdMs: 5000 }
    }
  ],
  spawn: { x: 20, y: 20, r: 5 },
  world: { width: 100, height: 100 }
};

export const missingElementsVariantConfig = {
  seed: "bad-variant",
  variants: [
    { id: "bad-variant", goal: { x: 80, y: 80, r: 10, holdMs: 5000 } }
  ],
  spawn: { x: 20, y: 20, r: 5 },
  world: { width: 100, height: 100 }
};

export const malformedVariantConfig = {
  seed: "seed-a",
  variants: [
    null,
    {
      id: "safe",
      elements: [],
      goal: { x: 80, y: 80, r: 10, holdMs: 5000 }
    }
  ],
  spawn: { x: 20, y: 20, r: 5 },
  world: { width: 100, height: 100 }
};

export const blockedSpawnConfig = {
  world: { width: 100, height: 100 },
  elements: [
    { type: "obstacle", x: 45, y: 45, w: 10, h: 10 }
  ],
  spawn: { x: 50, y: 50, r: 8 },
  goal: { x: 80, y: 80, r: 10, holdMs: 5000 }
};

export const invalidElementConfig = {
  world: { width: 100, height: 100 },
  elements: [null],
  spawn: { x: 20, y: 20, r: 5 },
  goal: { x: 80, y: 80, r: 10, holdMs: 5000 }
};

export const emptyElementMapConfig = {
  world: { width: 100, height: 100 },
  elements: [],
  spawn: { x: 20, y: 20, r: 5 },
  goal: { x: 80, y: 80, r: 10, holdMs: 5000 }
};

export const variantWorldMismatchConfig = {
  ...emptyElementMapConfig,
  variants: [
    { id: "other-size", world: { width: 120, height: 100 } }
  ]
};

export const unreachableGoalConfig = {
  world: { width: 100, height: 100 },
  grid: { size: 10 },
  elements: [
    { type: "obstacle", x: 50, y: 0, w: 10, h: 100 }
  ],
  spawn: { x: 20, y: 50, r: 5 },
  goal: { x: 80, y: 50, r: 12, holdMs: 5000 }
};

export const smallJoinOverhangRects = [
  { x: 0, y: 20, w: 100, h: 20 },
  { x: 80, y: 0, w: 20, h: 50 }
];

export const touchingJoinOverhangRects = [
  { x: 0, y: 20, w: 100, h: 20 },
  { x: 100, y: 0, w: 20, h: 50 }
];

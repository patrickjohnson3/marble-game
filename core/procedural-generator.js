import { hashMapSeed } from "./map-variants.js";
import { circleRectContact } from "./geometry.js";
import { MAP_ELEMENT_TYPES } from "./map-elements.js";
import { snapToGrid } from "./map-obstacles.js";

const proceduralMapTemplates = [
  {
    id: "long-run",
    difficulty: 1,
    spawn: { x: 0.18, y: 0.2 },
    goal: { x: 0.82, y: 0.82 },
    walls: [
      { x: 0.22, y: 0.34, w: 0.34, h: 0.012 },
      { x: 0.56, y: 0.24, w: 0.012, h: 0.24 },
      { x: 0.3, y: 0.55, w: 0.38, h: 0.012 },
      { x: 0.68, y: 0.48, w: 0.012, h: 0.28 },
      { x: 0.16, y: 0.73, w: 0.34, h: 0.012 },
    ],
    roughPatches: [
      { x: 0.3, y: 0.42, w: 0.16, h: 0.1 },
      { x: 0.58, y: 0.74, w: 0.18, h: 0.1 },
    ],
    icePatches: [{ x: 0.66, y: 0.3, w: 0.12, h: 0.1 }],
    clusters: [
      { x: 0.18, y: 0.48 },
      { x: 0.76, y: 0.62 },
    ],
  },
  {
    id: "switchbacks",
    difficulty: 2,
    spawn: { x: 0.2, y: 0.78 },
    goal: { x: 0.82, y: 0.2 },
    walls: [
      { x: 0.18, y: 0.62, w: 0.48, h: 0.012 },
      { x: 0.66, y: 0.46, w: 0.012, h: 0.28 },
      { x: 0.34, y: 0.42, w: 0.5, h: 0.012 },
      { x: 0.34, y: 0.22, w: 0.012, h: 0.28 },
      { x: 0.52, y: 0.78, w: 0.012, h: 0.14 },
    ],
    roughPatches: [
      { x: 0.2, y: 0.46, w: 0.18, h: 0.1 },
      { x: 0.58, y: 0.2, w: 0.14, h: 0.12 },
    ],
    icePatches: [{ x: 0.42, y: 0.66, w: 0.16, h: 0.1 }],
    clusters: [
      { x: 0.78, y: 0.36 },
      { x: 0.24, y: 0.28 },
    ],
  },
  {
    id: "islands",
    difficulty: 3,
    spawn: { x: 0.16, y: 0.16 },
    goal: { x: 0.84, y: 0.84 },
    walls: [
      { x: 0.34, y: 0.18, w: 0.012, h: 0.28 },
      { x: 0.5, y: 0.28, w: 0.34, h: 0.012 },
      { x: 0.18, y: 0.52, w: 0.34, h: 0.012 },
      { x: 0.62, y: 0.52, w: 0.012, h: 0.3 },
      { x: 0.34, y: 0.76, w: 0.3, h: 0.012 },
    ],
    roughPatches: [
      { x: 0.4, y: 0.42, w: 0.16, h: 0.12 },
      { x: 0.68, y: 0.66, w: 0.14, h: 0.12 },
    ],
    icePatches: [
      { x: 0.2, y: 0.3, w: 0.14, h: 0.1 },
      { x: 0.5, y: 0.62, w: 0.14, h: 0.1 },
    ],
    clusters: [
      { x: 0.42, y: 0.22 },
      { x: 0.76, y: 0.46 },
      { x: 0.22, y: 0.68 },
    ],
  },
];

function createSeededRandom(seed) {
  let state = hashMapSeed(seed) || 1;

  return function nextRandom() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random, min, max) {
  return min + (max - min) * random();
}

function pickRandom(random, values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values[Math.floor(random() * values.length)];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function jitterRect(rect, random) {
  const isHorizontal = rect.w >= rect.h;
  const longAxis = isHorizontal ? "w" : "h";
  const shortAxis = isHorizontal ? "h" : "w";
  const nextRect = {
    ...rect,
    x: clamp(rect.x + randomBetween(random, -0.018, 0.018), 0.06, 0.9),
    y: clamp(rect.y + randomBetween(random, -0.018, 0.018), 0.06, 0.9),
  };

  nextRect[longAxis] = clamp(
    rect[longAxis] * randomBetween(random, 0.9, 1.12),
    0.08,
    0.55,
  );
  nextRect[shortAxis] = rect[shortAxis];
  return nextRect;
}

function jitterPatch(rect, random) {
  return {
    ...rect,
    x: clamp(rect.x + randomBetween(random, -0.025, 0.025), 0.06, 0.86),
    y: clamp(rect.y + randomBetween(random, -0.025, 0.025), 0.06, 0.86),
    w: clamp(rect.w * randomBetween(random, 0.9, 1.16), 0.08, 0.24),
    h: clamp(rect.h * randomBetween(random, 0.9, 1.16), 0.08, 0.18),
  };
}

function clusterRects(cluster, random) {
  const size = randomBetween(random, 0.045, 0.07);
  const horizontal = {
    x: cluster.x + randomBetween(random, -0.025, 0.025),
    y: cluster.y + randomBetween(random, -0.018, 0.018),
    w: size * randomBetween(random, 1.8, 2.4),
    h: 0.012,
  };
  const vertical = {
    x: cluster.x + randomBetween(random, -0.012, 0.02),
    y: cluster.y + randomBetween(random, -0.03, 0.02),
    w: 0.012,
    h: size * randomBetween(random, 1.5, 2.1),
  };

  return [jitterRect(horizontal, random), jitterRect(vertical, random)];
}

function jitterPoint(point, random) {
  return {
    x: clamp(point.x + randomBetween(random, -0.025, 0.025), 0.1, 0.9),
    y: clamp(point.y + randomBetween(random, -0.025, 0.025), 0.1, 0.9),
  };
}

function gridAlignedSize(value, gridSize) {
  return Math.max(gridSize, snapToGrid(value, gridSize));
}

function gridAlignedPosition(value, size, max, gridSize) {
  return snapToGrid(Math.min(Math.max(0, value), max - size), gridSize);
}

function templateRectToElement({ rect, type, world, gridSize }) {
  const w = gridAlignedSize(rect.w * world.width, gridSize);
  const h = gridAlignedSize(rect.h * world.height, gridSize);

  return {
    type,
    x: gridAlignedPosition(rect.x * world.width, w, world.width, gridSize),
    y: gridAlignedPosition(rect.y * world.height, h, world.height, gridSize),
    w,
    h,
  };
}

function templatePointToWorld(point, world, gridSize) {
  return {
    x: snapToGrid(point.x * world.width, gridSize),
    y: snapToGrid(point.y * world.height, gridSize),
  };
}

function outsideClearZones(element, spawn, goal) {
  const spawnClearZone = { ...spawn, r: spawn.r * 4 };
  const goalClearZone = { ...goal, r: goal.r * 1.45 };

  return (
    !circleRectContact(spawnClearZone, element).intersects &&
    !circleRectContact(goalClearZone, element).intersects
  );
}

function proceduralElementBudget(difficulty) {
  const level = Math.min(Math.max(Math.round(difficulty), 1), 3);

  return {
    icePatch: level === 1 ? 0 : 1,
    obstacle: 6 + level,
    roughPatch: level === 1 ? 1 : 2,
  };
}

function limitElementsByBudget(elements, difficulty) {
  const budget = proceduralElementBudget(difficulty);
  const counts = {
    [MAP_ELEMENT_TYPES.icePatch]: 0,
    [MAP_ELEMENT_TYPES.obstacle]: 0,
    [MAP_ELEMENT_TYPES.roughPatch]: 0,
  };

  return elements.filter((element) => {
    const limit = budget[element.type];
    if (!Number.isFinite(limit)) return true;
    if (counts[element.type] >= limit) return false;
    counts[element.type]++;
    return true;
  });
}

function generateTemplateMapVariant({
  baseMapConfig,
  difficulty = 1,
  index = 0,
  seed = baseMapConfig?.seed,
  template = null,
}) {
  const random = createSeededRandom(seed + ":" + index + ":" + difficulty);
  const selectedTemplate =
    template ??
    pickRandom(random, proceduralMapTemplates) ??
    proceduralMapTemplates[0];
  const world = baseMapConfig.world;
  const gridSize = baseMapConfig.grid.size;
  const spawn = {
    ...baseMapConfig.spawn,
    ...templatePointToWorld(
      jitterPoint(selectedTemplate.spawn, random),
      world,
      gridSize,
    ),
  };
  const goal = {
    ...templatePointToWorld(
      jitterPoint(selectedTemplate.goal, random),
      world,
      gridSize,
    ),
    r: 95,
    holdMs: 5000,
  };
  const wallElements = selectedTemplate.walls.map((rect) =>
    templateRectToElement({
      rect: jitterRect(rect, random),
      type: MAP_ELEMENT_TYPES.obstacle,
      world,
      gridSize,
    }),
  );
  const clusterWallElements = (selectedTemplate.clusters ?? [])
    .flatMap((cluster) => clusterRects(cluster, random))
    .map((rect) =>
      templateRectToElement({
        rect,
        type: MAP_ELEMENT_TYPES.obstacle,
        world,
        gridSize,
      }),
    );
  const roughPatchElements = selectedTemplate.roughPatches.map((rect) =>
    templateRectToElement({
      rect: jitterPatch(rect, random),
      type: MAP_ELEMENT_TYPES.roughPatch,
      world,
      gridSize,
    }),
  );
  const icePatchElements = selectedTemplate.icePatches.map((rect) =>
    templateRectToElement({
      rect: jitterPatch(rect, random),
      type: MAP_ELEMENT_TYPES.icePatch,
      world,
      gridSize,
    }),
  );
  const elements = [
    ...wallElements,
    ...clusterWallElements,
    ...roughPatchElements,
    ...icePatchElements,
  ].filter((element) => outsideClearZones(element, spawn, goal));

  return {
    id: "generated-" + difficulty + "-" + index,
    difficulty,
    templateId: selectedTemplate.id,
    spawn,
    goal,
    elements: limitElementsByBudget(elements, difficulty),
  };
}

export function generateProceduralMapVariants({
  baseMapConfig,
  count = 3,
  seed = baseMapConfig?.seed,
} = {}) {
  return Array.from({ length: count }, (_, index) => {
    const difficulty = (index % proceduralMapTemplates.length) + 1;

    return generateTemplateMapVariant({
      baseMapConfig,
      difficulty,
      index,
      seed,
    });
  });
}

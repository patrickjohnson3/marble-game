import { goalRadiusForDifficulty, hashMapSeed } from "./map-variants.js";
import { circleRectContact, expandedCircle } from "./geometry.js";
import { MAP_ELEMENT_TYPES } from "./map-elements.js";
import { snapToGrid } from "./map-obstacles.js";
import { proceduralMapTemplates } from "./procedural-templates.js";

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
  return (
    !circleRectContact(expandedCircle(spawn, 4), element).intersects &&
    !circleRectContact(expandedCircle(goal, 1.45), element).intersects
  );
}

function proceduralElementBudget(difficulty) {
  const level = Math.min(Math.max(Math.round(difficulty), 1), 3);

  return {
    hazardPatch: level === 1 ? 1 : 2,
    icePatch: level === 1 ? 0 : 1,
    obstacle: 6 + level,
    roughPatch: level === 1 ? 1 : 2,
  };
}

function limitElementsByBudget(elements, difficulty) {
  const budget = proceduralElementBudget(difficulty);
  const counts = {
    [MAP_ELEMENT_TYPES.hazardPatch]: 0,
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

function focusedTerrainElements(
  template,
  type,
  rects,
  random,
  world,
  gridSize,
) {
  if (template.terrainFocus !== type) return [];

  return rects.map((rect) =>
    templateRectToElement({
      rect: jitterPatch(rect, random),
      type,
      world,
      gridSize,
    }),
  );
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
    r: goalRadiusForDifficulty(difficulty, 95),
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
  const roughPatchElements = focusedTerrainElements(
    selectedTemplate,
    MAP_ELEMENT_TYPES.roughPatch,
    selectedTemplate.roughPatches,
    random,
    world,
    gridSize,
  );
  const icePatchElements = focusedTerrainElements(
    selectedTemplate,
    MAP_ELEMENT_TYPES.icePatch,
    selectedTemplate.icePatches,
    random,
    world,
    gridSize,
  );
  const hazardPatchElements = (selectedTemplate.hazardPatches ?? []).map(
    (rect) =>
      templateRectToElement({
        rect: jitterPatch(rect, random),
        type: MAP_ELEMENT_TYPES.hazardPatch,
        world,
        gridSize,
      }),
  );
  const elements = [
    ...wallElements,
    ...hazardPatchElements,
    ...roughPatchElements,
    ...icePatchElements,
  ].filter((element) => outsideClearZones(element, spawn, goal));

  return {
    id: "generated-" + difficulty + "-" + index,
    difficulty,
    templateId: selectedTemplate.id,
    terrainFocus: selectedTemplate.terrainFocus,
    spawn,
    goal,
    elements: limitElementsByBudget(elements, difficulty),
  };
}

function normalizedVariantCount(count) {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

function hasFinitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function hasProceduralBaseMapConfig(baseMapConfig) {
  return (
    Number.isFinite(baseMapConfig?.world?.width) &&
    Number.isFinite(baseMapConfig?.world?.height) &&
    Number.isFinite(baseMapConfig?.grid?.size) &&
    hasFinitePoint(baseMapConfig?.spawn) &&
    Number.isFinite(baseMapConfig?.spawn?.r)
  );
}

export function generateProceduralMapVariants({
  baseMapConfig,
  count = 3,
  seed = baseMapConfig?.seed,
} = {}) {
  if (!hasProceduralBaseMapConfig(baseMapConfig)) return [];

  return Array.from({ length: normalizedVariantCount(count) }, (_, index) => {
    const difficulty = (index % proceduralMapTemplates.length) + 1;

    return generateTemplateMapVariant({
      baseMapConfig,
      difficulty,
      index,
      seed,
    });
  });
}

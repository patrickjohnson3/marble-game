import assert from "node:assert/strict";
import { resolvedMapConfig } from "../core/map-config.js";
import {
  hashMapSeed,
  mapObstacleElements,
  mapRoughPatchElements,
  normalizeJoinedObstacleRects,
  resolveMapVariantConfig,
  resolveSeededMapConfig,
  selectNextMapVariant,
  selectSeededMapVariant,
  snapRectToGrid,
  snapToGrid,
  validateMapConfig,
} from "../core/map.js";
import { createMapProgression } from "../core/map-progression.js";
import { hasReachableGoal } from "../core/map-reachability.js";
import { mapValidationMessages } from "../core/map-validation-messages.js";
import {
  nextProceduralMapVariant,
  resolveInitialMapConfig,
  resolveProceduralMapConfig,
} from "../core/procedural-map.js";
import { copy } from "../core/copy.js";
import { renderObstacleWalls } from "../rendering/obstacle-rendering.js";
import {
  blockedSpawnConfig,
  emptyElementMapConfig,
  invalidElementConfig,
  malformedVariantConfig,
  missingElementsVariantConfig,
  simpleSeededMapConfig,
  smallJoinOverhangRects,
  touchingJoinOverhangRects,
  unreachableGoalConfig,
  variantSelectionFixtures,
  variantWorldMismatchConfig,
} from "./map-fixtures.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function currentMapObstacles() {
  return normalizeJoinedObstacleRects(
    mapObstacleElements(resolvedMapConfig.elements),
  );
}

function testGridSnapping() {
  assert.equal(snapToGrid(264, 10), 260);
  assert.equal(snapToGrid(266, 10), 270);
  assert.deepEqual(
    snapRectToGrid({ type: "obstacle", x: 264, y: 336, w: 53, h: 47 }, 10),
    { type: "obstacle", x: 260, y: 340, w: 50, h: 50 },
  );
}

testGridSnapping();

function testSeededMapVariantSelection() {
  const variants = variantSelectionFixtures;
  const seed = "same-seed";

  assert.equal(hashMapSeed(seed), hashMapSeed(seed));
  assert.equal(
    selectSeededMapVariant(variants, seed),
    selectSeededMapVariant(variants, seed),
  );
  assert.equal(selectSeededMapVariant(variants, "b").id, "b");
  assert.equal(selectSeededMapVariant([null, variants[0]], "a").id, "a");
  assert.equal(selectSeededMapVariant([null], "a"), null);
}

testSeededMapVariantSelection();

function testProceduralMapBoundaryWrapsVariantSelection() {
  assert.equal(
    resolveInitialMapConfig(simpleSeededMapConfig).variantId,
    "only",
  );
  assert.equal(
    resolveProceduralMapConfig(simpleSeededMapConfig, "only").variantId,
    "only",
  );
  assert.equal(
    nextProceduralMapVariant(simpleSeededMapConfig, "missing").id,
    "only",
  );
}

testProceduralMapBoundaryWrapsVariantSelection();

function testNextMapVariantSelectionIsGuarded() {
  const variants = variantSelectionFixtures;

  assert.equal(selectNextMapVariant(variants, "a").id, "b");
  assert.equal(selectNextMapVariant(variants, "b").id, "a");
  assert.equal(selectNextMapVariant([null, variants[0]], "a").id, "a");
  assert.equal(selectNextMapVariant(variants, "missing").id, "a");
  assert.equal(selectNextMapVariant([], "a"), null);
  assert.equal(selectNextMapVariant(null, "a"), null);
  assert.equal(selectNextMapVariant([null], "a"), null);
}

testNextMapVariantSelectionIsGuarded();

function testMapElementFiltersHandleMalformedInput() {
  assert.deepEqual(mapObstacleElements(null), []);
  assert.deepEqual(mapRoughPatchElements(undefined), []);
}

testMapElementFiltersHandleMalformedInput();

function testMapProgressionHandlesMissingCurrentMap() {
  const hints = [];
  let renderRequests = 0;
  const progression = createMapProgression({
    baseMapConfig: simpleSeededMapConfig,
    getCurrentMap: () => null,
    applyMap() {
      throw new Error("missing current map should not apply next map");
    },
    resetForNextMap() {},
    terrainView: { updateGoalProgress() {} },
    ui: { setHint: (hint) => hints.push(hint) },
    requestRender: () => {
      renderRequests++;
    },
  });

  assert.equal(progression.advanceToNextMap(), false);
  assert.deepEqual(hints, [copy.hints.goalNoNextMap]);
  assert.equal(renderRequests, 1);
}

testMapProgressionHandlesMissingCurrentMap();

function testResolveSeededMapConfigCopiesSelectedElements() {
  const config = simpleSeededMapConfig;
  const resolved = resolveSeededMapConfig(config);

  assert.equal(resolved.seed, "seed-a");
  assert.equal(resolved.variantId, "only");
  assert.deepEqual(resolved.elements, config.variants[0].elements);
  assert.notEqual(resolved.elements, config.variants[0].elements);
}

testResolveSeededMapConfigCopiesSelectedElements();

function testResolveSeededMapConfigAllowsValidationOfMissingVariantElements() {
  const resolved = resolveSeededMapConfig(missingElementsVariantConfig);

  assert.equal(resolved.variantId, "bad-variant");
  assert.ok(
    validateMapConfig(resolved).includes(mapValidationMessages.elementsArray),
  );
}

testResolveSeededMapConfigAllowsValidationOfMissingVariantElements();

function testResolveMapVariantConfigIgnoresMalformedVariants() {
  const resolved = resolveMapVariantConfig(malformedVariantConfig, "safe");

  assert.equal(resolved.variantId, "safe");
}

testResolveMapVariantConfigIgnoresMalformedVariants();

function testMapValidationRejectsBlockedSpawn() {
  assert.ok(
    validateMapConfig(blockedSpawnConfig).includes(
      mapValidationMessages.spawnObstacleOverlap,
    ),
  );
}

testMapValidationRejectsBlockedSpawn();

function testMapValidationReportsMalformedConfig() {
  assert.deepEqual(validateMapConfig({}), [
    mapValidationMessages.elementsArray,
    mapValidationMessages.worldWidthPositive,
    mapValidationMessages.worldHeightPositive,
    mapValidationMessages.goalRequired,
    mapValidationMessages.spawnRequired,
  ]);
}

testMapValidationReportsMalformedConfig();

function testMapValidationReportsInvalidElementEntries() {
  assert.ok(
    validateMapConfig(invalidElementConfig).includes(
      mapValidationMessages.elementObject(0),
    ),
  );
}

testMapValidationReportsInvalidElementEntries();

function testMapValidationRejectsOffGridElementDimensions() {
  assert.ok(
    validateMapConfig({
      world: { width: 100, height: 100 },
      grid: { size: 10 },
      elements: [{ type: "roughPatch", x: 10, y: 10, w: 15, h: 20 }],
      spawn: { x: 20, y: 20, r: 5 },
      goal: { x: 80, y: 80, r: 10, holdMs: 5000 },
    }).includes(mapValidationMessages.elementGrid(0, "w")),
  );
}

testMapValidationRejectsOffGridElementDimensions();

function testMapValidationReportsInvalidNormalizedObstacles() {
  assert.ok(
    validateMapConfig(emptyElementMapConfig, {
      normalizedObstacles: [null],
    }).includes(mapValidationMessages.normalizedObstacleObject(0)),
  );
  assert.ok(
    validateMapConfig(emptyElementMapConfig, {
      normalizedObstacles: "bad",
    }).includes(mapValidationMessages.normalizedObstaclesArray),
  );
}

testMapValidationReportsInvalidNormalizedObstacles();

function testMapValidationRejectsVariantWorldMismatch() {
  assert.ok(
    validateMapConfig(variantWorldMismatchConfig).includes(
      mapValidationMessages.variantWorldMatch("other-size"),
    ),
  );
}

testMapValidationRejectsVariantWorldMismatch();

function testMapValidationRejectsUnreachableGoal() {
  assert.ok(
    validateMapConfig(unreachableGoalConfig).includes(
      mapValidationMessages.goalReachable,
    ),
  );
}

testMapValidationRejectsUnreachableGoal();

function testReachabilityUsesExactSpawnAndGoalSamples() {
  assert.equal(
    hasReachableGoal({
      world: { width: 100, height: 40 },
      obstacles: [{ x: 14, y: 8, w: 2, h: 4 }],
      spawn: { x: 6, y: 10, r: 5 },
      goal: { x: 86, y: 10, r: 8 },
      cellSize: 20,
    }),
    true,
  );
}

testReachabilityUsesExactSpawnAndGoalSamples();

function testObstacleVisualsTrimSmallJoinOverhangs() {
  const [horizontal, vertical] = normalizeJoinedObstacleRects(
    smallJoinOverhangRects,
  );

  assert.equal(horizontal.h, 20);
  assert.equal(vertical.h, 40);
}

testObstacleVisualsTrimSmallJoinOverhangs();

function testObstacleVisualsTrimTouchingJoinOverhangs() {
  const [, vertical] = normalizeJoinedObstacleRects(touchingJoinOverhangRects);

  assert.equal(vertical.h, 40);
  assert.equal(vertical.w, 20);
}

testObstacleVisualsTrimTouchingJoinOverhangs();

function testCurrentMapJoinedWallsSurviveNormalization() {
  const obstacles = currentMapObstacles();

  assert.deepEqual(
    obstacles.slice(0, 2),
    [
      { type: "obstacle", x: 260, y: 330, w: 510, h: 40 },
      { type: "obstacle", x: 720, y: 250, w: 50, h: 360 },
    ],
    "top joined wall group should survive normalization",
  );
  assert.deepEqual(
    obstacles.slice(4, 6),
    [
      { type: "obstacle", x: 250, y: 900, w: 720, h: 50 },
      { type: "obstacle", x: 910, y: 760, w: 60, h: 380 },
    ],
    "middle joined wall group should survive normalization",
  );
  assert.deepEqual(
    obstacles.slice(7, 9),
    [
      { type: "obstacle", x: 520, y: 1380, w: 50, h: 440 },
      { type: "obstacle", x: 520, y: 1570, w: 930, h: 50 },
    ],
    "lower joined wall group should survive normalization",
  );
}

testCurrentMapJoinedWallsSurviveNormalization();

function renderCurrentMapObstacles() {
  const originalDocument = globalThis.document;

  globalThis.document = {
    createElement(tagName) {
      return tagName === "canvas" ? new FakeCanvasElement() : new FakeElement();
    },
    createElementNS() {
      return new FakeElement();
    },
  };

  try {
    const container = new FakeElement();
    renderObstacleWalls(container, currentMapObstacles());
    return container.children[0];
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
}

function testCurrentMapObstaclesRenderToGroupedCanvas() {
  const canvas = renderCurrentMapObstacles();

  assert.equal(
    canvas.classList.contains("obstacleCanvas"),
    true,
    "current map obstacles should render to canvas",
  );
  assert.equal(
    Number(canvas.attributes["data-wall-groups"]) > 1,
    true,
    "current map obstacle groups should render separate canvas fills",
  );
  assert.equal(
    canvas.context.calls.some((call) => call[0] === "fill"),
    true,
    "current map canvas should draw fills",
  );
  assert.equal(
    canvas.context.calls.some((call) => call[0] === "stroke"),
    true,
    "current map canvas should draw outline",
  );
}

testCurrentMapObstaclesRenderToGroupedCanvas();

console.log("Map tests passed.");

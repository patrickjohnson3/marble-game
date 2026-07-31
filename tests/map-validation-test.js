import assert from "node:assert/strict";
import { validateMapConfig } from "../core/map-validation.js";
import { resolveSeededMapConfig } from "../core/map-variants.js";
import { hasReachableGoal } from "../core/map-reachability.js";
import { mapValidationMessages } from "../core/map-validation-messages.js";
import {
  blockedSpawnConfig,
  emptyElementMapConfig,
  invalidElementConfig,
  missingElementsVariantConfig,
  unreachableGoalConfig,
  variantWorldMismatchConfig,
} from "./map-fixtures.js";

function testResolveSeededMapConfigAllowsValidationOfMissingVariantElements() {
  const resolved = resolveSeededMapConfig(missingElementsVariantConfig);

  assert.equal(resolved.variantId, "bad-variant");
  assert.ok(
    validateMapConfig(resolved).includes(mapValidationMessages.elementsArray),
  );
}

function testMapValidationRejectsBlockedSpawn() {
  assert.ok(
    validateMapConfig(blockedSpawnConfig).includes(
      mapValidationMessages.spawnObstacleOverlap,
    ),
  );
}

function testMapValidationReportsMalformedConfig() {
  assert.deepEqual(validateMapConfig({}), [
    mapValidationMessages.elementsArray,
    mapValidationMessages.worldWidthPositive,
    mapValidationMessages.worldHeightPositive,
    mapValidationMessages.goalRequired,
    mapValidationMessages.spawnRequired,
  ]);
}

function testMapValidationReportsInvalidElementEntries() {
  assert.ok(
    validateMapConfig(invalidElementConfig).includes(
      mapValidationMessages.elementObject(0),
    ),
  );
}

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

function testMapValidationReportsInvalidOrientedObstacleFields() {
  const errors = validateMapConfig({
    world: { width: 100, height: 100 },
    grid: { size: 10 },
    elements: [
      {
        type: "obstacle",
        x: 10,
        y: 10,
        w: 20,
        h: 20,
        hitboxW: 0,
        hitboxH: Number.NaN,
        angle: "diagonal",
      },
    ],
    spawn: { x: 50, y: 50, r: 5 },
    goal: { x: 80, y: 80, r: 10, holdMs: 5000 },
  });

  assert.ok(
    errors.includes(
      mapValidationMessages.fieldPositive("element 0", "hitboxW"),
    ),
  );
  assert.ok(
    errors.includes(
      mapValidationMessages.fieldNonFinite("element 0", "hitboxH"),
    ),
  );
  assert.ok(
    errors.includes(mapValidationMessages.fieldNonFinite("element 0", "angle")),
  );
}

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

function testMapValidationRejectsVariantWorldMismatch() {
  assert.ok(
    validateMapConfig(variantWorldMismatchConfig).includes(
      mapValidationMessages.variantWorldMatch("other-size"),
    ),
  );
}

function testMapValidationRejectsUnreachableGoal() {
  assert.ok(
    validateMapConfig(unreachableGoalConfig).includes(
      mapValidationMessages.goalReachable,
    ),
  );
}

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

function testReachabilityAcceptsOpenMap() {
  assert.equal(
    hasReachableGoal({
      world: { width: 120, height: 120 },
      obstacles: [],
      spawn: { x: 20, y: 20, r: 5 },
      goal: { x: 100, y: 100, r: 12 },
      cellSize: 10,
    }),
    true,
  );
}

function testReachabilityRejectsFullyBlockedGoal() {
  assert.equal(
    hasReachableGoal({
      world: { width: 120, height: 120 },
      obstacles: [
        { x: 70, y: 0, w: 10, h: 120 },
        { x: 80, y: 70, w: 40, h: 10 },
      ],
      spawn: { x: 20, y: 20, r: 5 },
      goal: { x: 100, y: 100, r: 12 },
      cellSize: 10,
    }),
    false,
  );
}

function testReachabilityRespectsMarbleRadiusInNarrowCorridors() {
  const world = { width: 120, height: 80 };
  const obstacles = [
    { x: 40, y: 0, w: 10, h: 27 },
    { x: 40, y: 53, w: 10, h: 27 },
  ];
  const goal = { x: 100, y: 40, r: 18 };

  assert.equal(
    hasReachableGoal({
      world,
      obstacles,
      spawn: { x: 20, y: 40, r: 5 },
      goal,
      cellSize: 10,
    }),
    true,
  );
  assert.equal(
    hasReachableGoal({
      world,
      obstacles,
      spawn: { x: 20, y: 40, r: 14 },
      goal,
      cellSize: 10,
    }),
    false,
  );
}

function testReachabilityHandlesGoalNearCellBoundary() {
  assert.equal(
    hasReachableGoal({
      world: { width: 100, height: 100 },
      obstacles: [],
      spawn: { x: 10, y: 10, r: 5 },
      goal: { x: 89, y: 89, r: 10 },
      cellSize: 20,
    }),
    true,
  );
}

testResolveSeededMapConfigAllowsValidationOfMissingVariantElements();
testMapValidationRejectsBlockedSpawn();
testMapValidationReportsMalformedConfig();
testMapValidationReportsInvalidElementEntries();
testMapValidationRejectsOffGridElementDimensions();
testMapValidationReportsInvalidOrientedObstacleFields();
testMapValidationReportsInvalidNormalizedObstacles();
testMapValidationRejectsVariantWorldMismatch();
testMapValidationRejectsUnreachableGoal();
testReachabilityUsesExactSpawnAndGoalSamples();
testReachabilityAcceptsOpenMap();
testReachabilityRejectsFullyBlockedGoal();
testReachabilityRespectsMarbleRadiusInNarrowCorridors();
testReachabilityHandlesGoalNearCellBoundary();

console.log("Map validation tests passed.");

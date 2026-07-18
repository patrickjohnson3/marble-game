import assert from "node:assert/strict";
import { resolveSeededMapConfig, validateMapConfig } from "../core/map.js";
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

function testMapValidationRejectsSlopeWithoutDirection() {
  assert.ok(
    validateMapConfig({
      world: { width: 100, height: 100 },
      grid: { size: 10 },
      elements: [{ type: "slope", x: 10, y: 10, w: 20, h: 20, dx: 0, dy: 0 }],
      spawn: { x: 20, y: 20, r: 5 },
      goal: { x: 80, y: 80, r: 10, holdMs: 5000 },
    }).includes(mapValidationMessages.slopeDirection(0)),
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

testResolveSeededMapConfigAllowsValidationOfMissingVariantElements();
testMapValidationRejectsBlockedSpawn();
testMapValidationReportsMalformedConfig();
testMapValidationReportsInvalidElementEntries();
testMapValidationRejectsOffGridElementDimensions();
testMapValidationRejectsSlopeWithoutDirection();
testMapValidationReportsInvalidNormalizedObstacles();
testMapValidationRejectsVariantWorldMismatch();
testMapValidationRejectsUnreachableGoal();
testReachabilityUsesExactSpawnAndGoalSamples();

console.log("Map validation tests passed.");

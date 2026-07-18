import assert from "node:assert/strict";
import { hapticTuning } from "../core/haptic-config.js";
import { baseMapConfig, resolvedMapConfig } from "../core/map-config.js";
import { physicsConfig } from "../core/physics-config.js";
import { timing, tuning } from "../core/timing-config.js";
import { visualConfig } from "../core/visual-config.js";
import {
  settingsConfig,
  settingsControls,
} from "../settings/settings-config.js";
import {
  mapObstacleElements,
  normalizeJoinedObstacleRects,
  resolveMapVariantConfig,
  validateMapConfig,
} from "../core/map.js";

function assertPositiveNumber(value, label) {
  assert.equal(Number.isFinite(value), true, label + " must be finite");
  assert.equal(value > 0, true, label + " must be positive");
}

function testWorldAndMapElements() {
  assertPositiveNumber(resolvedMapConfig.world.width, "world width");
  assertPositiveNumber(resolvedMapConfig.world.height, "world height");
  assertPositiveNumber(resolvedMapConfig.grid.size, "grid size");
  assertPositiveNumber(
    resolvedMapConfig.reachability.minCellSize,
    "reachability min cell size",
  );
  assertPositiveNumber(
    resolvedMapConfig.reachability.gridDivisor,
    "reachability grid divisor",
  );
  assertPositiveNumber(
    resolvedMapConfig.reachability.spawnRadiusDivisor,
    "reachability spawn radius divisor",
  );
  assertPositiveNumber(
    resolvedMapConfig.intro.wallThickness,
    "intro wall thickness",
  );
  assertPositiveNumber(
    resolvedMapConfig.intro.viewportMargin,
    "intro viewport margin",
  );
  assert.equal(resolvedMapConfig.seed, "default", "map seed");
  assert.equal(resolvedMapConfig.variantId, "default", "map variant");
  assertPositiveNumber(resolvedMapConfig.spawn.r, "spawn radius");
  assertPositiveNumber(resolvedMapConfig.goal.r, "goal radius");
  assertPositiveNumber(resolvedMapConfig.goal.holdMs, "goal hold time");

  for (const [index, element] of resolvedMapConfig.elements.entries()) {
    assert.ok(
      ["obstacle", "roughPatch"].includes(element.type),
      "element " + index + " type",
    );
    assertPositiveNumber(element.w, "element " + index + " width");
    assertPositiveNumber(element.h, "element " + index + " height");
    assert.equal(element.x >= 0, true, "element " + index + " x");
    assert.equal(element.y >= 0, true, "element " + index + " y");
    assert.equal(
      element.x + element.w <= resolvedMapConfig.world.width,
      true,
      "element " + index + " right edge",
    );
    assert.equal(
      element.y + element.h <= resolvedMapConfig.world.height,
      true,
      "element " + index + " bottom edge",
    );
  }
}

function testMapConfigValidationPasses() {
  assert.deepEqual(validateMapConfig(resolvedMapConfig), []);
  for (const variant of baseMapConfig.variants) {
    assert.deepEqual(
      validateMapConfig(resolveMapVariantConfig(baseMapConfig, variant.id)),
      [],
      "variant " + variant.id + " should validate",
    );
  }
}

function testMapIncludesConnectedObstacleGroups() {
  const obstacles = mapObstacleElements(resolvedMapConfig.elements);
  const connectedPairs = obstacles.filter((a, index) =>
    obstacles
      .slice(index + 1)
      .some(
        (b) =>
          a.x <= b.x + b.w &&
          b.x <= a.x + a.w &&
          a.y <= b.y + b.h &&
          b.y <= a.y + a.h,
      ),
  );

  assert.equal(
    connectedPairs.length >= 3,
    true,
    "map should include connected wall groups",
  );
}

function testNormalizedMapObstaclesStayValid() {
  const obstacles = normalizeJoinedObstacleRects(
    mapObstacleElements(resolvedMapConfig.elements),
  );

  for (const [index, obstacle] of obstacles.entries()) {
    assertPositiveNumber(obstacle.w, "normalized obstacle " + index + " width");
    assertPositiveNumber(
      obstacle.h,
      "normalized obstacle " + index + " height",
    );
    assert.equal(obstacle.x >= 0, true, "normalized obstacle " + index + " x");
    assert.equal(obstacle.y >= 0, true, "normalized obstacle " + index + " y");
    assert.equal(
      obstacle.x + obstacle.w <= resolvedMapConfig.world.width,
      true,
      "normalized obstacle " + index + " right edge",
    );
    assert.equal(
      obstacle.y + obstacle.h <= resolvedMapConfig.world.height,
      true,
      "normalized obstacle " + index + " bottom edge",
    );
  }
}

function testTimingAndTuning() {
  [
    "introReleaseDelayMs",
    "countdownTickMs",
    "motionPermissionTimeoutMs",
    "sensorFallbackMs",
    "targetFrameMs",
    "minFrameStep",
    "maxFrameStep",
  ].forEach((key) => assertPositiveNumber(timing[key], "timing." + key));

  assert.equal(
    timing.maxFrameStep >= timing.minFrameStep,
    true,
    "frame step range",
  );
  assertPositiveNumber(tuning.neutralSampleCount, "neutral sample count");
  assertPositiveNumber(tuning.gestureCooldownFrames, "gesture cooldown");
  assertPositiveNumber(tuning.motionGravityScale, "motion gravity scale");
}

function testPhysicsAndSettingsRanges() {
  assertPositiveNumber(physicsConfig.accel, "physics accel");
  assertPositiveNumber(physicsConfig.maxTilt, "physics maxTilt");
  assertPositiveNumber(physicsConfig.maxSpeed, "physics maxSpeed");
  assert.equal(
    physicsConfig.friction > 0 && physicsConfig.friction <= 1,
    true,
    "physics friction",
  );
  assert.equal(
    physicsConfig.bounce >= 0 && physicsConfig.bounce <= 1,
    true,
    "physics bounce",
  );
  assert.equal(
    physicsConfig.roughPatchFriction > 0 &&
      physicsConfig.roughPatchFriction <= 1,
    true,
    "rough patch friction",
  );
  assert.equal(
    settingsControls.maxSpeed.min <= settingsConfig.maxSpeed,
    true,
    "max speed setting min",
  );
  assert.equal(
    settingsControls.maxSpeed.max >= settingsConfig.maxSpeed,
    true,
    "max speed setting max",
  );
  assert.equal(
    settingsControls.acceleration.min <= settingsConfig.acceleration,
    true,
    "accel setting min",
  );
  assert.equal(
    settingsControls.acceleration.max >= settingsConfig.acceleration,
    true,
    "accel setting max",
  );
  assert.equal(settingsConfig.trailEnabled, false, "trail defaults off");
  assert.equal(settingsConfig.fpsEnabled, false, "fps defaults off");
  assert.equal(settingsConfig.statsEnabled, false, "stats defaults off");
  assert.equal(
    settingsConfig.cameraMode,
    "follow",
    "camera mode defaults to follow",
  );
  assert.ok(
    settingsControls.cameraModes.includes(settingsConfig.cameraMode),
    "camera mode setting option",
  );
  assertPositiveNumber(
    settingsConfig.trailDefaultVersion,
    "trail default version",
  );
}

function testHapticAndVisualRanges() {
  assertPositiveNumber(hapticTuning.impactCooldownMs, "impact cooldown");
  assertPositiveNumber(hapticTuning.surfaceCooldownMs, "surface cooldown");
  assertPositiveNumber(
    hapticTuning.goalEnterDurationMs,
    "goal enter haptic duration",
  );
  assertPositiveNumber(
    hapticTuning.goalHoldDurationMs,
    "goal hold haptic duration",
  );
  assertPositiveNumber(
    hapticTuning.goalHoldCooldownMs,
    "goal hold haptic cooldown",
  );
  assert.deepEqual(
    hapticTuning.goalCompletePattern.every(
      (duration) => Number.isFinite(duration) && duration > 0,
    ),
    true,
    "goal complete haptic pattern",
  );
  assertPositiveNumber(visualConfig.trail.durationMs, "trail duration");
  assertPositiveNumber(visualConfig.trail.minDistance, "trail min distance");
  assertPositiveNumber(visualConfig.trail.minIntervalMs, "trail min interval");
  assert.equal(
    visualConfig.trail.maxOpacity > 0 && visualConfig.trail.maxOpacity <= 1,
    true,
    "trail opacity",
  );
  assertPositiveNumber(
    visualConfig.marble.impactSquashDivisor,
    "impact squash divisor",
  );
  assertPositiveNumber(
    visualConfig.marble.glintLightOffset,
    "glint light offset",
  );
  assertPositiveNumber(
    visualConfig.map.roughPatchCanvasPadding,
    "rough patch canvas padding",
  );
  assertPositiveNumber(
    visualConfig.map.obstacleCanvasPadding,
    "obstacle canvas padding",
  );
  assertPositiveNumber(
    visualConfig.map.goalFillEdgePercent,
    "goal fill edge percent",
  );
  assertPositiveNumber(visualConfig.effects.impactMin, "effect impact minimum");
  assertPositiveNumber(
    visualConfig.effects.impactReference,
    "effect impact reference",
  );
  assertPositiveNumber(
    visualConfig.effects.impactCooldownMs,
    "effect impact cooldown",
  );
  assertPositiveNumber(
    visualConfig.effects.maxParticles,
    "effect particle cap",
  );
  assertPositiveNumber(
    visualConfig.effects.surfaceMinSpeed,
    "effect surface minimum speed",
  );
  assertPositiveNumber(
    visualConfig.effects.surfaceCooldownMs,
    "effect surface cooldown",
  );
  assert.equal(
    visualConfig.effects.impactOpacity > 0 &&
      visualConfig.effects.impactOpacity <= 1,
    true,
    "impact effect opacity",
  );
  assert.equal(
    visualConfig.effects.surfaceOpacity > 0 &&
      visualConfig.effects.surfaceOpacity <= 1,
    true,
    "surface effect opacity",
  );
}

testWorldAndMapElements();
testMapConfigValidationPasses();
testMapIncludesConnectedObstacleGroups();
testNormalizedMapObstaclesStayValid();
testTimingAndTuning();
testPhysicsAndSettingsRanges();
testHapticAndVisualRanges();

console.log("Config tests passed.");

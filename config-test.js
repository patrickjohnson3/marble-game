import assert from "node:assert/strict";
import {
  hapticTuning,
  mapConfig,
  physicsConfig,
  settingsConfig,
  settingsControls,
  timing,
  tuning,
  visualConfig
} from "./config.js";

function assertPositiveNumber(value, label) {
  assert.equal(Number.isFinite(value), true, label + " must be finite");
  assert.equal(value > 0, true, label + " must be positive");
}

function testWorldAndMapElements() {
  assertPositiveNumber(mapConfig.world.width, "world width");
  assertPositiveNumber(mapConfig.world.height, "world height");
  assertPositiveNumber(mapConfig.intro.wallThickness, "intro wall thickness");
  assertPositiveNumber(mapConfig.intro.viewportMargin, "intro viewport margin");

  for (const [index, element] of mapConfig.elements.entries()) {
    assert.ok(["obstacle", "roughPatch"].includes(element.type), "element " + index + " type");
    assertPositiveNumber(element.w, "element " + index + " width");
    assertPositiveNumber(element.h, "element " + index + " height");
    assert.equal(element.x >= 0, true, "element " + index + " x");
    assert.equal(element.y >= 0, true, "element " + index + " y");
    assert.equal(element.x + element.w <= mapConfig.world.width, true, "element " + index + " right edge");
    assert.equal(element.y + element.h <= mapConfig.world.height, true, "element " + index + " bottom edge");
  }
}

function testTimingAndTuning() {
  [
    "introPromptDelayMs",
    "countdownDelayMs",
    "countdownTickMs",
    "sensorFallbackMs",
    "targetFrameMs",
    "minFrameStep",
    "maxFrameStep"
  ].forEach((key) => assertPositiveNumber(timing[key], "timing." + key));

  assert.equal(timing.maxFrameStep >= timing.minFrameStep, true, "frame step range");
  assertPositiveNumber(tuning.neutralSampleCount, "neutral sample count");
  assertPositiveNumber(tuning.gestureCooldownFrames, "gesture cooldown");
  assertPositiveNumber(tuning.motionGravityScale, "motion gravity scale");
}

function testPhysicsAndSettingsRanges() {
  assertPositiveNumber(physicsConfig.accel, "physics accel");
  assertPositiveNumber(physicsConfig.maxTilt, "physics maxTilt");
  assertPositiveNumber(physicsConfig.maxSpeed, "physics maxSpeed");
  assert.equal(physicsConfig.friction > 0 && physicsConfig.friction <= 1, true, "physics friction");
  assert.equal(physicsConfig.bounce >= 0 && physicsConfig.bounce <= 1, true, "physics bounce");
  assert.equal(physicsConfig.roughPatchFriction > 0 && physicsConfig.roughPatchFriction <= 1, true, "rough patch friction");
  assert.equal(settingsControls.maxSpeed.min <= settingsConfig.maxSpeed, true, "max speed setting min");
  assert.equal(settingsControls.maxSpeed.max >= settingsConfig.maxSpeed, true, "max speed setting max");
  assert.equal(settingsControls.acceleration.min <= settingsConfig.acceleration, true, "accel setting min");
  assert.equal(settingsControls.acceleration.max >= settingsConfig.acceleration, true, "accel setting max");
}

function testHapticAndVisualRanges() {
  assertPositiveNumber(hapticTuning.impactCooldownMs, "impact cooldown");
  assertPositiveNumber(hapticTuning.surfaceCooldownMs, "surface cooldown");
  assertPositiveNumber(visualConfig.trail.durationMs, "trail duration");
  assertPositiveNumber(visualConfig.trail.minDistance, "trail min distance");
  assertPositiveNumber(visualConfig.trail.minIntervalMs, "trail min interval");
  assert.equal(visualConfig.trail.maxOpacity > 0 && visualConfig.trail.maxOpacity <= 1, true, "trail opacity");
  assertPositiveNumber(visualConfig.marble.impactSquashDivisor, "impact squash divisor");
  assertPositiveNumber(visualConfig.marble.glintLightOffset, "glint light offset");
}

testWorldAndMapElements();
testTimingAndTuning();
testPhysicsAndSettingsRanges();
testHapticAndVisualRanges();

console.log("Config tests passed.");

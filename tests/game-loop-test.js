import assert from "node:assert/strict";
import {
  elapsedMsToFrameDelta,
  updateFrameBudgetMetric,
} from "../core/game-loop.js";
import { clamp } from "../core/geometry.js";

function testElapsedFrameDeltaUsesConfiguredClamp() {
  const timing = {
    targetFrameMs: 16.67,
    minFrameDelta: 0.25,
    maxFrameDelta: 2,
  };

  assert.equal(elapsedMsToFrameDelta(1, timing, clamp), timing.minFrameDelta);
  assert.equal(elapsedMsToFrameDelta(16.67, timing, clamp), 1);
  assert.equal(
    elapsedMsToFrameDelta(1000, timing, clamp),
    timing.maxFrameDelta,
  );
}

testElapsedFrameDeltaUsesConfiguredClamp();

function testFrameBudgetMetricUsesRollingAverage() {
  const perf = {};

  updateFrameBudgetMetric(perf, "physicsMs", 10);
  updateFrameBudgetMetric(perf, "physicsMs", 20, 0.5);

  assert.equal(perf.physicsMs, 15);
}

testFrameBudgetMetricUsesRollingAverage();

console.log("Game loop tests passed.");

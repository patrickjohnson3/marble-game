import assert from "node:assert/strict";
import { createHapticsController } from "../core/haptics.js";

const originalNavigator = globalThis.navigator;
const originalPerformance = globalThis.performance;
const vibrations = [];
let currentTime = 1000;

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    vibrate(pattern) {
      vibrations.push(pattern);
    },
  },
});
Object.defineProperty(globalThis, "performance", {
  configurable: true,
  value: {
    now() {
      return currentTime;
    },
  },
});

try {
  const haptics = createHapticsController(
    {
      enabled: true,
      impact: { cooldownMs: 90, lastPulse: 0, minImpact: 1 },
      surface: { cooldownMs: 130, lastPulse: 0, minSpeed: 1 },
      goal: { holdCooldownMs: 900, lastHoldPulse: 0 },
    },
    {
      impactScale: 3,
      impactMinDurationMs: 8,
      impactMaxDurationMs: 35,
      surfaceScale: 1.4,
      gooSurfaceScale: 1,
      waterSurfaceScale: 0.75,
      surfaceMinDurationMs: 5,
      surfaceMaxDurationMs: 16,
      goalEnterDurationMs: 12,
      goalHoldDurationMs: 6,
      goalCompletePattern: [18, 40, 28],
    },
  );

  haptics.pulseGoal("enter");
  haptics.pulseGoal("hold");
  haptics.pulseGoal("hold");
  currentTime += 901;
  haptics.pulseGoal("hold");
  haptics.pulseGoal("complete");
  currentTime += 131;
  haptics.pulseSurface(8, "gooPatch");
  currentTime += 131;
  haptics.pulseSurface(8, "waterPatch");

  assert.deepEqual(vibrations, [12, 6, 6, [18, 40, 28], 8, 6]);
} finally {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator,
  });
  Object.defineProperty(globalThis, "performance", {
    configurable: true,
    value: originalPerformance,
  });
}

console.log("Haptics tests passed.");

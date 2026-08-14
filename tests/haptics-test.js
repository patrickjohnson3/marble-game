import assert from "node:assert/strict";
import { createHapticsController } from "../core/haptics.js";

const vibrations = [];
let currentTime = 1000;

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
  {
    now: () => currentTime,
    vibrate(pattern) {
      vibrations.push(pattern);
    },
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

console.log("Haptics tests passed.");

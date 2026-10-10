import assert from "node:assert/strict";
import { createHapticsController } from "../core/haptics.js";
import { hapticTuning } from "../core/game-config.js";

const vibrations = [];
let currentTime = 1000;

const state = {
  enabled: true,
  impact: { cooldownMs: 90, lastPulse: 0, minImpact: 1 },
  surface: { cooldownMs: 130, lastPulse: 0, minSpeed: 1 },
  goal: { holdCooldownMs: 900, lastHoldPulse: 0 },
};
const haptics = createHapticsController(
  state,
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

vibrations.length = 0;
state.enabled = false;
// Expire every cooldown so only the preference can suppress these requests.
currentTime += 1000;
haptics.pulseImpact(10);
haptics.pulseSurface(8, "waterPatch");
haptics.pulseGoal("enter");
haptics.pulseGoal("hold");
haptics.pulseGoal("complete");
assert.deepEqual(vibrations, [], "disabled haptics must suppress all feedback");

state.enabled = true;
currentTime += 1000;
haptics.pulseImpact(10);
haptics.pulseSurface(8, "waterPatch");
haptics.pulseGoal("enter");
haptics.pulseGoal("hold");
haptics.pulseGoal("complete");
assert.deepEqual(
  vibrations,
  [30, 6, 12, 6, [18, 40, 28]],
  "re-enabling haptics must restore every feedback type on the same controller",
);

function testMaterialImpactsShareCooldownAndRespectPreference() {
  let time = 0;
  const pulses = [];
  const materialState = {
    enabled: true,
    impact: {
      cooldownMs: hapticTuning.impactCooldownMs,
      minImpact: hapticTuning.impactMin,
      lastPulse: -Infinity,
    },
  };
  const controller = createHapticsController(materialState, hapticTuning, {
    now: () => time,
    vibrate: (pulse) => pulses.push(pulse),
  });
  for (const material of ["metal", "wood", "sponge"]) {
    time += 1000;
    controller.pulseImpact(8, material);
    const count = pulses.length;
    controller.pulseImpact(8, material);
    controller.pulseImpact(8, material === "metal" ? "wood" : "metal");
    assert.equal(
      pulses.length,
      count,
      "switching materials cannot bypass the shared cooldown",
    );
  }
  assert.ok(
    pulses[0] < pulses[1],
    "metal ticks are shorter than wooden knocks",
  );
  assert.ok(
    Array.isArray(pulses[2]) && pulses[2].length === 3,
    "sponge has a short press/rebound pair",
  );
  assert.ok(pulses[2][0] < pulses[1] && pulses[2][2] < pulses[1]);
  time += 1000;
  controller.pulseImpact(1000, "sponge");
  assert.ok(
    pulses.at(-1).reduce((a, b) => a + b) <= materialState.impact.cooldownMs,
    "a bounded rebound pattern finishes before another impact can play",
  );
  const count = pulses.length;
  for (const material of ["metal", "wood", "sponge"]) {
    time += 1000;
    controller.pulseImpact(0.1, material);
    materialState.enabled = false;
    controller.pulseImpact(10, material);
    materialState.enabled = true;
  }
  assert.equal(
    pulses.length,
    count,
    "incidental touches and disabled haptics stay silent",
  );
  const unsupported = createHapticsController(materialState, hapticTuning);
  assert.doesNotThrow(() => unsupported.pulseImpact(8, "sponge"));
}

testMaterialImpactsShareCooldownAndRespectPreference();

console.log("Haptics tests passed.");

import assert from "node:assert/strict";
import { createHapticsController } from "../core/haptics.js";

function createState() {
  return {
    enabled: true,
    impact: { cooldownMs: 90, lastPulse: 0, minImpact: 1 },
    surface: { cooldownMs: 130, lastPulse: 0, minSpeed: 1 },
    goal: { holdCooldownMs: 900, lastHoldPulse: 0 },
  };
}

const tuning = {
  impactScale: 3,
  impactMinDurationMs: 8,
  impactMaxDurationMs: 35,
  surfaceScale: 1.4,
  surfaceMinDurationMs: 5,
  surfaceMaxDurationMs: 16,
  goalEnterDurationMs: 12,
  goalHoldDurationMs: 6,
  goalCompletePattern: [18, 40, 28],
};

function createHarness({ vibrateResult = true } = {}) {
  const state = createState();
  const vibrations = [];
  let currentTime = 1000;
  const haptics = createHapticsController(state, tuning, {
    navigatorRef: () => ({
      vibrate(pattern) {
        vibrations.push(pattern);
        return vibrateResult;
      },
    }),
    performanceRef: () => ({
      now() {
        return currentTime;
      },
    }),
  });

  return {
    advance(ms) {
      currentTime += ms;
    },
    haptics,
    state,
    vibrations,
  };
}

function testImpactSurfaceAndGoalVibrate() {
  const { advance, haptics, vibrations } = createHarness();

  haptics.pulseImpact(3);
  haptics.pulseSurface(5);
  haptics.pulseGoal("enter");
  haptics.pulseGoal("hold");
  haptics.pulseGoal("hold");
  advance(901);
  haptics.pulseGoal("hold");
  haptics.pulseGoal("complete");

  assert.deepEqual(vibrations, [9, 7, 12, 6, 6, [18, 40, 28]]);
}

testImpactSurfaceAndGoalVibrate();

function testRejectedVibrationDoesNotConsumeCooldown() {
  const { haptics, state, vibrations } = createHarness({
    vibrateResult: false,
  });

  haptics.pulseImpact(3);
  haptics.pulseSurface(5);
  haptics.pulseGoal("hold");

  assert.deepEqual(vibrations, [9, 7, 6]);
  assert.equal(state.impact.lastPulse, 0);
  assert.equal(state.surface.lastPulse, 0);
  assert.equal(state.goal.lastHoldPulse, 0);
}

testRejectedVibrationDoesNotConsumeCooldown();

function testDisabledHapticsDoNotVibrate() {
  const { haptics, state, vibrations } = createHarness();
  state.enabled = false;

  haptics.pulseImpact(3);
  haptics.pulseSurface(5);
  haptics.pulseGoal("complete");

  assert.deepEqual(vibrations, []);
}

testDisabledHapticsDoNotVibrate();

console.log("Haptics tests passed.");

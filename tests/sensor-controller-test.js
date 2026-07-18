import assert from "node:assert/strict";
import { createSensorController } from "../input/sensor-controller.js";

function createHarness() {
  let frameSchedules = 0;
  let introSchedules = 0;
  let hint = "";
  const calibration = {
    autoNeutralDone: false,
    sampleCount: 0,
    sampleX: 0,
    sampleY: 0
  };
  const game = { paused: false, phase: "calibrating" };
  const marble = { vx: 4, vy: -2 };
  const tilt = {
    neutralX: null,
    neutralY: null,
    rawX: 3,
    rawY: -5,
    smoothX: 1,
    smoothY: -1
  };
  const controller = createSensorController({
    calibration,
    game,
    introSequence: {
      schedule() {
        introSchedules++;
      }
    },
    marble,
    scheduleFrame() {
      frameSchedules++;
    },
    sensor: { gotMotion: false, gotOrientation: false, using: "none" },
    tilt,
    tuning: {
      motionGravityScale: 3,
      neutralSampleCount: 2
    },
    ui: {
      setHint(message) {
        hint = message;
      }
    },
    adjustScreen: (gamma, beta) => [gamma, beta]
  });

  return {
    calibration,
    controller,
    counts: () => ({ frameSchedules, introSchedules }),
    game,
    hint: () => hint,
    marble,
    tilt
  };
}

function testManualNeutralStartsIntroCountdown() {
  const harness = createHarness();

  harness.controller.setNeutralNow();

  assert.equal(harness.game.phase, "running");
  assert.equal(harness.calibration.autoNeutralDone, true);
  assert.equal(harness.tilt.neutralX, 3);
  assert.equal(harness.tilt.neutralY, -5);
  assert.deepEqual(harness.counts(), { frameSchedules: 1, introSchedules: 1 });
}

function testAutoNeutralStartsIntroCountdownOnce() {
  const harness = createHarness();

  harness.controller.onOrientation({ beta: 4, gamma: 2 });
  harness.controller.onOrientation({ beta: 6, gamma: 8 });
  harness.controller.onOrientation({ beta: 10, gamma: 10 });

  assert.equal(harness.game.phase, "running");
  assert.equal(harness.calibration.autoNeutralDone, true);
  assert.equal(harness.tilt.neutralX, 5);
  assert.equal(harness.tilt.neutralY, 5);
  assert.equal(harness.counts().introSchedules, 1);
}

testManualNeutralStartsIntroCountdown();
testAutoNeutralStartsIntroCountdownOnce();

console.log("Sensor controller tests passed.");

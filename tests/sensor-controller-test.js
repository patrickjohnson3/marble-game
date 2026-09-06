import assert from "node:assert/strict";
import { physicsConfig } from "../core/game-config.js";
import { updatePhysics, updatePhysicsInput } from "../core/physics.js";
import { createKeyboardController } from "../input/keyboard-controller.js";
import { createSensorController } from "../input/sensor-controller.js";
import { createSensorWatchdog } from "../input/sensor-watchdog.js";
import { screenAdjusted } from "../platform/platform.js";

function createHarness({ adjustScreen = (gamma, beta) => [gamma, beta] } = {}) {
  let frameSchedules = 0;
  let introSchedules = 0;
  let hint = "";
  let gameStatus = "calibrating";
  const calibration = {
    sampleCount: 0,
    sampleX: 0,
    sampleY: 0,
  };
  const game = { paused: false, phase: "calibrating" };
  const marble = { vx: 4, vy: -2 };
  const tilt = {
    neutralX: null,
    neutralY: null,
    rawX: 3,
    rawY: -5,
    smoothX: 1,
    smoothY: -1,
  };
  const sensor = { using: "none" };
  const controller = createSensorController({
    calibration,
    game,
    introSequence: {
      schedule() {
        introSchedules++;
      },
    },
    marble,
    scheduleFrame() {
      frameSchedules++;
    },
    sensor,
    tilt,
    tuning: {
      motionGravityScale: 3,
      neutralSampleCount: 2,
    },
    ui: {
      setHint(message) {
        hint = message;
      },
      setGameStatus(message) {
        gameStatus = message;
      },
    },
    adjustScreen,
  });

  return {
    calibration,
    controller,
    counts: () => ({ frameSchedules, introSchedules }),
    game,
    gameStatus: () => gameStatus,
    hint: () => hint,
    marble,
    sensor,
    tilt,
  };
}

function testManualNeutralStartsIntroCountdown() {
  for (const phase of ["calibrating", "running"]) {
    const harness = createHarness();
    harness.game.phase = phase;

    harness.controller.setNeutralNow();

    assert.equal(harness.game.phase, "running");
    assert.equal(harness.tilt.neutralX, 3);
    assert.equal(harness.tilt.neutralY, -5);
    assert.equal(harness.marble.vx, 0);
    assert.equal(harness.marble.vy, 0);
    assert.deepEqual(harness.counts(), {
      frameSchedules: 1,
      introSchedules: 1,
    });
    assert.equal(harness.gameStatus(), "");
  }
}

function testAutoNeutralStartsIntroCountdownOnce() {
  const harness = createHarness();

  harness.controller.onOrientation({ beta: 4, gamma: 2 });
  harness.controller.onOrientation({ beta: 6, gamma: 8 });
  harness.controller.onOrientation({ beta: 10, gamma: 10 });

  assert.equal(harness.game.phase, "running");
  assert.equal(harness.sensor.using, "deviceorientation");
  assert.equal(harness.tilt.neutralX, 5);
  assert.equal(harness.tilt.neutralY, 5);
  assert.equal(harness.marble.vx, 0);
  assert.equal(harness.marble.vy, 0);
  assert.equal(harness.counts().introSchedules, 1);
  assert.equal(harness.gameStatus(), "");
}

testManualNeutralStartsIntroCountdown();
testAutoNeutralStartsIntroCountdownOnce();

function testOrientationTakesPriorityOverMotionFallback() {
  const harness = createHarness();

  harness.controller.onMotion({
    accelerationIncludingGravity: { x: 1, y: 2 },
  });
  assert.equal(harness.sensor.using, "devicemotion fallback");
  harness.controller.onOrientation({ beta: 4, gamma: 3 });
  assert.equal(harness.sensor.using, "deviceorientation");
  const raw = { x: harness.tilt.rawX, y: harness.tilt.rawY };

  harness.controller.onMotion({
    accelerationIncludingGravity: { x: 8, y: 9 },
  });

  assert.deepEqual({ x: harness.tilt.rawX, y: harness.tilt.rawY }, raw);
}

testOrientationTakesPriorityOverMotionFallback();

function testUnusableReadingsDoNotClaimSensorOrCalibrate() {
  const harness = createHarness();
  for (const invalid of [null, undefined, NaN, Infinity, -Infinity, "4"]) {
    harness.controller.onOrientation({ beta: invalid, gamma: 0 });
    harness.controller.onOrientation({ beta: 0, gamma: invalid });
    harness.controller.onMotion({
      accelerationIncludingGravity: { x: invalid, y: 0 },
    });
    harness.controller.onMotion({
      accelerationIncludingGravity: { x: 0, y: invalid },
    });
  }
  harness.controller.onMotion({ accelerationIncludingGravity: null });

  assert.equal(harness.sensor.using, "none");
  assert.equal(harness.calibration.sampleCount, 0);
  assert.equal(harness.tilt.rawX, 3);
  assert.equal(harness.tilt.rawY, -5);
  assert.equal(harness.game.phase, "calibrating");

  harness.controller.onOrientation({ beta: 0, gamma: 0 });
  assert.equal(harness.sensor.using, "deviceorientation");
  assert.equal(harness.calibration.sampleCount, 1);
}

function testMotionUsesScreenAxes() {
  const cases = [
    [0, [-3, 6]],
    [90, [6, 3]],
    [180, [3, -6]],
    [270, [-6, -3]],
  ];
  for (const [angle, expected] of cases) {
    const harness = createHarness({
      adjustScreen: (gamma, beta) =>
        screenAdjusted(gamma, beta, {
          screenRef: { orientation: { angle } },
        }),
    });
    harness.controller.onMotion({
      accelerationIncludingGravity: { x: 1, y: 2 },
    });
    assert.deepEqual([harness.tilt.rawX, harness.tilt.rawY], expected);
  }
}

function testSourceHandoffDoesNotMixCalibrationSamples() {
  const harness = createHarness();
  harness.controller.onMotion({
    accelerationIncludingGravity: { x: 1, y: 2 },
  });
  harness.controller.onOrientation({ gamma: 30, beta: 40 });

  assert.equal(harness.calibration.sampleCount, 1);
  assert.equal(harness.tilt.neutralX, null);
  assert.equal(harness.tilt.neutralY, null);
  assert.equal(harness.game.phase, "calibrating");

  harness.controller.onOrientation({ gamma: 32, beta: 42 });
  assert.equal(harness.tilt.neutralX, 31);
  assert.equal(harness.tilt.neutralY, 41);
  assert.equal(harness.game.phase, "running");
}

function testLateSensorRecalibratesWithoutSteeringFromHoldingAngle() {
  for (const previousSource of ["keyboard", "devicemotion fallback"]) {
    const harness = createHarness();
    harness.game.phase = "running";
    harness.sensor.using = previousSource;
    harness.tilt.neutralX = 0;
    harness.tilt.neutralY = 0;
    harness.controller.onOrientation({ gamma: 12, beta: 45 });

    updatePhysicsInput(
      { tilt: harness.tilt, keyboard: { x: 0, y: 0 }, physics: physicsConfig },
      1,
    );
    assert.equal(harness.tilt.smoothX, 0);
    assert.equal(harness.tilt.smoothY, 0);
    assert.equal(harness.game.phase, "calibrating");

    harness.controller.onOrientation({ gamma: 12, beta: 45 });
    assert.equal(harness.tilt.neutralX, 12);
    assert.equal(harness.tilt.neutralY, 45);
    assert.equal(harness.game.phase, "running");
  }
}

function testPausedReadingsRemainAvailableForManualNeutral() {
  const harness = createHarness();
  harness.game.paused = true;
  harness.controller.onOrientation({ gamma: 6, beta: 35 });
  harness.controller.onOrientation({ gamma: 8, beta: 38 });

  assert.equal(harness.calibration.sampleCount, 0);
  assert.equal(harness.tilt.neutralX, null);
  harness.controller.setNeutralNow();
  assert.equal(harness.tilt.neutralX, 8);
  assert.equal(harness.tilt.neutralY, 38);
  assert.equal(harness.game.paused, true);
  assert.equal(harness.marble.vx, 0);
  assert.equal(harness.marble.vy, 0);
}

function testKeyboardCanStartAfterOneSensorSampleAndCalibrationCanResume() {
  const harness = createHarness();
  let keyboardIntroSchedules = 0;
  const keyboard = { x: 0, y: 0 };
  const keyboardController = createKeyboardController({
    game: harness.game,
    introSequence: {
      schedule() {
        keyboardIntroSchedules++;
      },
    },
    keyboard,
    scheduleFrame() {},
    sensor: harness.sensor,
    tilt: harness.tilt,
    closeSettings() {},
  });
  harness.controller.onOrientation({ gamma: 10, beta: 40 });
  keyboardController.onKeyDown({ key: "ArrowRight", preventDefault() {} });

  assert.equal(harness.game.phase, "running");
  assert.equal(keyboard.x, 1);
  assert.equal(keyboardIntroSchedules, 1);
  assert.equal(harness.calibration.sampleCount, 1);
  assert.equal(harness.tilt.neutralX, null);
  assert.equal(harness.tilt.neutralY, null);

  keyboardController.onKeyDown({ key: "ArrowUp", preventDefault() {} });
  Object.assign(harness.marble, { x: 500, y: 500, r: 29, vx: 0, vy: 0 });
  const context = {
    marble: harness.marble,
    tilt: harness.tilt,
    keyboard,
    physics: physicsConfig,
    intro: { released: true },
    bounds: { left: 0, right: 1000, top: 0, bottom: 1000 },
    mapState: { obstacles: [], terrainByType: {} },
  };
  for (let frame = 0; frame < 20; frame++) {
    updatePhysicsInput(context, 1);
    updatePhysics(context, 1, {});
  }
  const velocity = { vx: harness.marble.vx, vy: harness.marble.vy };
  assert.ok(velocity.vx > 0, "ArrowRight must establish horizontal momentum");
  assert.ok(velocity.vy < 0, "ArrowUp must establish vertical momentum");

  harness.controller.onOrientation({ gamma: 12, beta: 42 });
  assert.equal(harness.tilt.neutralX, 11);
  assert.equal(harness.tilt.neutralY, 41);
  assert.equal(harness.game.phase, "running");
  assert.equal(harness.sensor.using, "deviceorientation");
  assert.deepEqual(keyboard, { x: 1, y: -1 });
  assert.deepEqual(
    { vx: harness.marble.vx, vy: harness.marble.vy },
    velocity,
    "background calibration must preserve ongoing keyboard momentum",
  );
}

function testReadingsAndManualNeutralCannotStartBeforeStart() {
  const harness = createHarness();
  harness.game.phase = "waiting";

  harness.controller.setNeutralNow();
  harness.controller.onOrientation({ gamma: 6, beta: 35 });
  harness.controller.onOrientation({ gamma: 6, beta: 35 });
  harness.controller.onMotion({
    accelerationIncludingGravity: { x: 1, y: 2 },
  });

  assert.equal(harness.game.phase, "waiting");
  assert.equal(harness.sensor.using, "none");
  assert.equal(harness.calibration.sampleCount, 0);
  assert.equal(harness.tilt.neutralX, null);
  assert.equal(harness.tilt.neutralY, null);
  assert.deepEqual(harness.counts(), { frameSchedules: 0, introSchedules: 0 });
}

testUnusableReadingsDoNotClaimSensorOrCalibrate();
testMotionUsesScreenAxes();
testSourceHandoffDoesNotMixCalibrationSamples();
testLateSensorRecalibratesWithoutSteeringFromHoldingAngle();
testPausedReadingsRemainAvailableForManualNeutral();
testKeyboardCanStartAfterOneSensorSampleAndCalibrationCanResume();
testReadingsAndManualNeutralCannotStartBeforeStart();

function testSensorWatchdogResumesWithRemainingDelay() {
  const delays = [];
  const callbacks = [];
  let fallbackCount = 0;
  let now = 0;
  const game = { paused: false };
  const sensor = { using: "none" };
  const watchdog = createSensorWatchdog({
    delayMs: 100,
    game,
    sensor,
    onFallback() {
      fallbackCount++;
    },
    now: () => now,
    setTimeoutFn(callback, delay) {
      callbacks.push(callback);
      delays.push(delay);
      return callbacks.length;
    },
    clearTimeoutFn() {},
  });

  watchdog.schedule();
  now = 40;
  watchdog.pause();
  watchdog.resume(() => true);
  assert.deepEqual(delays, [100, 60]);

  callbacks.at(-1)();
  assert.equal(fallbackCount, 1);

  watchdog.schedule();
  sensor.using = "deviceorientation";
  callbacks.at(-1)();
  assert.equal(fallbackCount, 1);
}

testSensorWatchdogResumesWithRemainingDelay();

console.log("Sensor controller tests passed.");

import assert from "node:assert/strict";
import { createKeyboardController } from "../input/keyboard-controller.js";
import { GAME_PHASES, SENSOR_MODES } from "../core/runtime-states.js";

function createHarness(phase = GAME_PHASES.waiting) {
  let prevented = 0;
  let scheduled = 0;
  let introScheduled = 0;
  let inputReady = 0;
  const keyboard = { x: 0, y: 0 };
  const game = { paused: false, phase };
  const sensor = { using: SENSOR_MODES.none };
  const tilt = { neutralX: 8, neutralY: 9 };
  const controller = createKeyboardController({
    game,
    introSequence: {
      schedule() {
        introScheduled++;
      },
    },
    keyboard,
    scheduleFrame() {
      scheduled++;
    },
    sensor,
    tilt,
    closeSettings() {},
    onInputReady() {
      inputReady++;
    },
  });

  function keyEvent(key) {
    return {
      key,
      preventDefault() {
        prevented++;
      },
    };
  }

  return {
    controller,
    counts: () => ({ inputReady, introScheduled, prevented, scheduled }),
    game,
    keyEvent,
    keyboard,
    sensor,
    tilt,
  };
}

function testMovementKeysDoNotStartGameBeforeStart() {
  const { controller, counts, keyEvent, keyboard } = createHarness();

  controller.onKeyDown(keyEvent("ArrowRight"));

  assert.equal(keyboard.x, 0);
  assert.deepEqual(counts(), {
    inputReady: 0,
    introScheduled: 0,
    prevented: 1,
    scheduled: 0,
  });
}

testMovementKeysDoNotStartGameBeforeStart();

function testMovementKeysStillActivateKeyboardAfterStart() {
  const { controller, counts, game, keyEvent, keyboard, sensor, tilt } =
    createHarness(GAME_PHASES.calibrating);

  controller.onKeyDown(keyEvent("ArrowRight"));

  assert.equal(keyboard.x, 1);
  assert.equal(game.phase, GAME_PHASES.running);
  assert.equal(sensor.using, SENSOR_MODES.keyboard);
  assert.deepEqual(
    { neutralX: tilt.neutralX, neutralY: tilt.neutralY },
    { neutralX: 0, neutralY: 0 },
  );
  assert.deepEqual(counts(), {
    inputReady: 1,
    introScheduled: 1,
    prevented: 1,
    scheduled: 1,
  });
}

testMovementKeysStillActivateKeyboardAfterStart();

function testKeyboardStartsWithoutReplacingPendingSensorCalibration() {
  for (const source of [SENSOR_MODES.motion, SENSOR_MODES.orientation]) {
    const { controller, counts, game, keyEvent, keyboard, sensor, tilt } =
      createHarness(GAME_PHASES.calibrating);
    sensor.using = source;
    tilt.neutralX = null;
    tilt.neutralY = null;

    controller.onKeyDown(keyEvent("ArrowRight"));
    controller.onKeyDown(keyEvent("ArrowRight"));

    assert.equal(keyboard.x, 1);
    assert.equal(sensor.using, source);
    assert.equal(game.phase, GAME_PHASES.running);
    assert.equal(tilt.neutralX, null);
    assert.equal(tilt.neutralY, null);
    assert.deepEqual(counts(), {
      inputReady: 1,
      introScheduled: 1,
      prevented: 2,
      scheduled: 1,
    });
  }
}

testKeyboardStartsWithoutReplacingPendingSensorCalibration();

console.log("Keyboard controller tests passed.");

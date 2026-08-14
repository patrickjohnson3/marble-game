import assert from "node:assert/strict";
import { createKeyboardController } from "../input/keyboard-controller.js";
import { GAME_PHASES, SENSOR_MODES } from "../core/runtime-states.js";

function createHarness(phase = GAME_PHASES.waiting) {
  let prevented = 0;
  let scheduled = 0;
  let introScheduled = 0;
  let inputReady = 0;
  const keyboard = { x: 0, y: 0 };
  const controller = createKeyboardController({
    calibration: { autoNeutralDone: false },
    game: { paused: false, phase },
    introSequence: {
      schedule() {
        introScheduled++;
      },
    },
    keyboard,
    scheduleFrame() {
      scheduled++;
    },
    sensor: { using: SENSOR_MODES.none },
    tilt: { neutralX: 8, neutralY: 9 },
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
    keyEvent,
    keyboard,
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
  const { controller, counts, keyEvent, keyboard } = createHarness(
    GAME_PHASES.calibrating,
  );

  controller.onKeyDown(keyEvent("ArrowRight"));

  assert.equal(keyboard.x, 1);
  assert.deepEqual(counts(), {
    inputReady: 1,
    introScheduled: 1,
    prevented: 1,
    scheduled: 1,
  });
}

testMovementKeysStillActivateKeyboardAfterStart();

console.log("Keyboard controller tests passed.");

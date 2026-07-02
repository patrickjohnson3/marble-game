import assert from "node:assert/strict";
import {
  hapticTuning,
  mapConfig,
  physicsConfig,
  timing
} from "./config.js";
import { createGameController } from "./game-controller.js";
import { resetIntroTimerState } from "./intro-timers.js";
import { createGameState } from "./state.js";

function createLifecycleHarness() {
  const state = createGameState({
    world: mapConfig.world,
    mapConfig,
    timing,
    hapticTuning,
    physicsConfig
  });
  let resets = 0;
  let pausedBySettings = false;

  const controller = createGameController({
    start() {
      controller.reset();
      state.game.phase = "calibrating";
    },
    reset() {
      state.game.phase = "waiting";
      state.game.paused = false;
      state.intro.released = false;
      state.intro.started = false;
      state.sensor.using = "none";
      state.keyboard.x = 0;
      state.keyboard.y = 0;
      resetIntroTimerState(state.intro);
      pausedBySettings = false;
      resets++;
    },
    pause() {
      if (state.game.phase === "waiting" || state.game.paused) return false;
      state.game.paused = true;
      return true;
    },
    resume() {
      if (!state.game.paused) return;
      state.game.paused = false;
    },
    openSettings() {
      pausedBySettings = controller.pause();
    },
    closeSettings() {
      if (!pausedBySettings) return;
      pausedBySettings = false;
      controller.resume();
    },
    tick() {}
  });

  function releaseMap() {
    state.intro.released = true;
    state.game.phase = "running";
  }

  return {
    controller,
    releaseMap,
    get resets() {
      return resets;
    },
    state
  };
}

function testStartPauseResumeReleaseReset() {
  const harness = createLifecycleHarness();
  const { controller, releaseMap, state } = harness;

  state.keyboard.x = 1;
  state.sensor.using = "keyboard";

  controller.start();
  assert.equal(state.game.phase, "calibrating");
  assert.equal(state.game.paused, false);
  assert.equal(harness.resets, 1);
  assert.equal(state.keyboard.x, 0);
  assert.equal(state.sensor.using, "none");

  controller.openSettings();
  assert.equal(state.game.paused, true);
  controller.closeSettings();
  assert.equal(state.game.paused, false);

  releaseMap();
  assert.equal(state.game.phase, "running");
  assert.equal(state.intro.released, true);

  controller.reset();
  assert.equal(state.game.phase, "waiting");
  assert.equal(state.intro.released, false);
  assert.equal(state.game.paused, false);
}

testStartPauseResumeReleaseReset();

console.log("Lifecycle tests passed.");

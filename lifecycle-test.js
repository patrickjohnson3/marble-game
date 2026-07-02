import assert from "node:assert/strict";
import { createGameController } from "./game-controller.js";

function createLifecycleHarness() {
  const state = {
    phase: "waiting",
    paused: false,
    released: false,
    resets: 0
  };

  const controller = createGameController({
    start() {
      controller.reset();
      state.phase = "calibrating";
    },
    reset() {
      state.phase = "waiting";
      state.paused = false;
      state.released = false;
      state.resets++;
    },
    pause() {
      if (state.phase === "waiting" || state.paused) return false;
      state.paused = true;
      return true;
    },
    resume() {
      if (!state.paused) return;
      state.paused = false;
    },
    openSettings() {
      state.pausedBySettings = controller.pause();
    },
    closeSettings() {
      if (!state.pausedBySettings) return;
      state.pausedBySettings = false;
      controller.resume();
    },
    tick() {}
  });

  function releaseMap() {
    state.released = true;
    state.phase = "running";
  }

  return { controller, releaseMap, state };
}

function testStartPauseResumeReleaseReset() {
  const { controller, releaseMap, state } = createLifecycleHarness();

  controller.start();
  assert.equal(state.phase, "calibrating");
  assert.equal(state.paused, false);
  assert.equal(state.resets, 1);

  controller.openSettings();
  assert.equal(state.paused, true);
  controller.closeSettings();
  assert.equal(state.paused, false);

  releaseMap();
  assert.equal(state.phase, "running");
  assert.equal(state.released, true);

  controller.reset();
  assert.equal(state.phase, "waiting");
  assert.equal(state.released, false);
  assert.equal(state.paused, false);
}

testStartPauseResumeReleaseReset();

console.log("Lifecycle tests passed.");

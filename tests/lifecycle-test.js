import assert from "node:assert/strict";
import {
  hapticTuning,
  physicsConfig,
  resolvedMapConfig,
  timing
} from "../core/config.js";
import { createGameController } from "../core/game-controller.js";
import { createLifecycleController } from "../core/game-lifecycle.js";
import { resetIntroTimerState } from "../core/intro-timers.js";
import { createGameState } from "../core/state.js";

function createLifecycleHarness() {
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
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

async function testStartRequestsFullscreenFromClickPath() {
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig
  });
  let fullscreenRequests = 0;
  let motionEnabled = false;
  let mapResets = 0;

  const lifecycle = createLifecycleController({
    cameraController: {
      camera: state.camera,
      centerOnMarble() {},
      resetGesture() {}
    },
    calibration: state.calibration,
    controlsEl: { hidden: false },
    effectsRenderer: { clear() {} },
    frameLoop: { requestRender() {} },
    game: state.game,
    haptics: state.haptics,
    intro: state.intro,
    introSequence: {
      clearTimers() {},
      hideMessage() {},
      pause() {},
      resume() {},
      schedule() {}
    },
    keyboard: state.keyboard,
    mapRenderer: { resetIntroPen() {} },
    marble: state.marble,
    resetMap() {
      mapResets++;
    },
    resetCalibration() {},
    scheduleFrame() {},
    sensor: state.sensor,
    sensorWatchdog: {
      pause() {},
      reset() {},
      resume() {},
      schedule() {}
    },
    settings: { fullscreenEnabled: true },
    startBtn: {
      disabled: false,
      textContent: ""
    },
    tilt: state.tilt,
    timing,
	    trailRenderer: { clear() {} },
	    ui: { isSettingsOpen: () => false, setHint() {} },
	    spawn: resolvedMapConfig.spawn,
	    enableMotion() {
      motionEnabled = true;
    },
    requestFullscreen() {
      fullscreenRequests++;
      return Promise.resolve();
    },
    requestMotionPermission() {
      return Promise.resolve(true);
    },
    keepDisplayAwake() {},
    tick() {}
  });

  await lifecycle.gameController.start();
  assert.equal(fullscreenRequests, 1);
  assert.equal(motionEnabled, true);
  assert.equal(mapResets, 1);
  assert.equal(state.game.phase, "calibrating");
}

testStartPauseResumeReleaseReset();
await testStartRequestsFullscreenFromClickPath();

console.log("Lifecycle tests passed.");

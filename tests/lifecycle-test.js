import assert from "node:assert/strict";
import { hapticTuning, physicsConfig, timing } from "../core/game-config.js";
import { resolvedMapConfig } from "../core/map-config.js";
import { createLifecycleController } from "../core/game-lifecycle.js";
import { resetIntroTimerState } from "../core/intro-timers.js";
import { createGameState } from "../core/state.js";

function createLifecycleHarness() {
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig,
  });
  let resets = 0;
  let pausedBySettings = false;

  const controller = {
    start() {
      controller.reset();
      state.game.phase = "calibrating";
    },
    reset() {
      state.game.phase = "waiting";
      state.game.paused = false;
      state.intro.released = false;
      state.introSequence.started = false;
      state.input.sensor.using = "none";
      state.input.keyboard.x = 0;
      state.input.keyboard.y = 0;
      resetIntroTimerState(state.introSequence);
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
  };

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
    state,
  };
}

function testStartPauseResumeReleaseReset() {
  const harness = createLifecycleHarness();
  const { controller, releaseMap, state } = harness;

  state.input.keyboard.x = 1;
  state.input.sensor.using = "keyboard";

  controller.start();
  assert.equal(state.game.phase, "calibrating");
  assert.equal(state.game.paused, false);
  assert.equal(harness.resets, 1);
  assert.equal(state.input.keyboard.x, 0);
  assert.equal(state.input.sensor.using, "none");

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
    physicsConfig,
  });
  let fullscreenRequests = 0;
  let motionEnabled = false;
  let mapResets = 0;
  let watchdogScheduled = false;
  const startCalls = [];

  const lifecycle = createLifecycleController({
    state,
    cameraController: {
      camera: state.camera,
      centerOnMarble() {},
      resetGesture() {},
    },
    effectsRenderer: { clear() {} },
    frameLoop: { requestRender() {} },
    introSequence: {
      clearTimers() {},
      hideMessage() {},
      pause() {},
      resume() {},
      schedule() {},
    },
    mapRenderer: { resetIntroPen() {} },
    resetMap() {
      mapResets++;
    },
    resetCalibration() {},
    scheduleFrame() {},
    sensorWatchdog: {
      pause() {},
      reset() {},
      resume() {},
      schedule() {
        watchdogScheduled = true;
      },
    },
    settings: { fullscreenEnabled: true },
    timing,
    trailRenderer: { clear() {} },
    ui: { isSettingsOpen: () => false, setHint() {}, setStartControls() {} },
    getSpawn: () => resolvedMapConfig.spawn,
    enableMotion() {
      motionEnabled = true;
    },
    requestFullscreen() {
      startCalls.push("fullscreen");
      fullscreenRequests++;
      return Promise.resolve();
    },
    requestMotionPermission() {
      startCalls.push("motionPermission");
      return Promise.resolve(true);
    },
    keepDisplayAwake() {},
  });

  await lifecycle.gameController.start();
  assert.equal(fullscreenRequests, 1);
  assert.equal(motionEnabled, true);
  assert.equal(mapResets, 1);
  assert.equal(state.game.phase, "calibrating");
  assert.equal(state.input.sensor.permission, "granted");
  assert.equal(watchdogScheduled, true);
  assert.deepEqual(startCalls, ["fullscreen", "motionPermission"]);
}

async function testStartContinuesWhenMotionPermissionStalls() {
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig,
  });
  let motionEnabled = false;
  let hint = "";
  let timeoutCallback = null;

  const lifecycle = createLifecycleController({
    state,
    cameraController: {
      camera: state.camera,
      centerOnMarble() {},
      resetGesture() {},
    },
    effectsRenderer: { clear() {} },
    frameLoop: { requestRender() {} },
    introSequence: {
      clearTimers() {},
      hideMessage() {},
      pause() {},
      resume() {},
      schedule() {},
    },
    mapRenderer: { resetIntroPen() {} },
    resetMap() {},
    resetCalibration() {},
    scheduleFrame() {},
    sensorWatchdog: {
      pause() {},
      reset() {},
      resume() {},
      schedule() {},
    },
    settings: { fullscreenEnabled: true },
    timing,
    trailRenderer: { clear() {} },
    ui: {
      isSettingsOpen: () => false,
      setHint(message) {
        hint = message;
      },
      setStartControls() {},
    },
    getSpawn: () => resolvedMapConfig.spawn,
    enableMotion() {
      motionEnabled = true;
    },
    requestFullscreen() {
      return Promise.resolve();
    },
    requestMotionPermission() {
      return new Promise(() => {});
    },
    keepDisplayAwake() {},
    setTimeoutFn(callback) {
      timeoutCallback = callback;
      return 1;
    },
    clearTimeoutFn() {},
  });

  const startPromise = lifecycle.gameController.start();
  await Promise.resolve();
  assert.equal(motionEnabled, true);
  assert.equal(state.game.phase, "calibrating");

  timeoutCallback();
  await startPromise;

  assert.equal(motionEnabled, true);
  assert.equal(state.game.phase, "calibrating");
  assert.equal(state.input.sensor.permission, "timeout");
  assert.equal(
    hint,
    "no motion sensor yet. use arrows/WASD here, or try HTTPS on your phone.",
  );
}

async function testMotionPermissionDenialKeepsKeyboardFallbackActive() {
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig,
  });
  let motionEnabled = false;
  let hint = "";
  let fullscreenRequests = 0;
  const controlsEl = { hidden: false };
  const startBtn = {
    disabled: false,
    textContent: "",
  };

  const lifecycle = createLifecycleController({
    state,
    cameraController: {
      camera: state.camera,
      centerOnMarble() {},
      resetGesture() {},
    },
    effectsRenderer: { clear() {} },
    frameLoop: { requestRender() {} },
    introSequence: {
      clearTimers() {},
      hideMessage() {},
      pause() {},
      resume() {},
      schedule() {},
    },
    mapRenderer: { resetIntroPen() {} },
    resetMap() {},
    resetCalibration() {},
    scheduleFrame() {},
    sensorWatchdog: {
      pause() {},
      reset() {},
      resume() {},
      schedule() {},
    },
    settings: { fullscreenEnabled: true },
    timing,
    trailRenderer: { clear() {} },
    ui: {
      isSettingsOpen: () => false,
      setHint(message) {
        hint = message;
      },
      setStartControls({ visible, disabled }) {
        if (visible !== undefined) controlsEl.hidden = !visible;
        if (disabled !== undefined) startBtn.disabled = disabled;
      },
    },
    getSpawn: () => resolvedMapConfig.spawn,
    enableMotion() {
      motionEnabled = true;
    },
    requestFullscreen() {
      fullscreenRequests++;
    },
    requestMotionPermission() {
      return Promise.resolve(false);
    },
    keepDisplayAwake() {},
  });

  await lifecycle.gameController.start();

  assert.equal(fullscreenRequests, 1);
  assert.equal(motionEnabled, true);
  assert.equal(controlsEl.hidden, true);
  assert.equal(startBtn.disabled, true);
  assert.equal(state.game.phase, "calibrating");
  assert.equal(state.input.sensor.permission, "denied");
  assert.equal(hint, "motion permission denied. check chrome site settings.");
}

function testResumeResetsFrameClock() {
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig,
  });
  let resetClockCalls = 0;
  state.game.phase = "running";

  const lifecycle = createLifecycleController({
    state,
    cameraController: {
      camera: state.camera,
      centerOnMarble() {},
      resetGesture() {},
    },
    effectsRenderer: { clear() {} },
    frameLoop: { requestRender() {} },
    introSequence: {
      clearTimers() {},
      hideMessage() {},
      pause() {},
      resume() {},
      schedule() {},
    },
    mapRenderer: { resetIntroPen() {} },
    resetMap() {},
    resetCalibration() {},
    scheduleFrame() {},
    sensorWatchdog: {
      pause() {},
      reset() {},
      resume() {},
      schedule() {},
    },
    settings: { fullscreenEnabled: true },
    timing,
    trailRenderer: { clear() {} },
    ui: { isSettingsOpen: () => false, setHint() {}, setStartControls() {} },
    getSpawn: () => resolvedMapConfig.spawn,
    enableMotion() {},
    requestFullscreen() {},
    requestMotionPermission() {},
    keepDisplayAwake() {},
    resetFrameClock() {
      resetClockCalls++;
    },
  });

  assert.equal(lifecycle.gameController.pause(), true);
  lifecycle.gameController.resume();

  assert.equal(resetClockCalls, 1);
}

testStartPauseResumeReleaseReset();
await testStartRequestsFullscreenFromClickPath();
await testStartContinuesWhenMotionPermissionStalls();
await testMotionPermissionDenialKeepsKeyboardFallbackActive();
testResumeResetsFrameClock();

console.log("Lifecycle tests passed.");

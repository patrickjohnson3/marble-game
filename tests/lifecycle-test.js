import assert from "node:assert/strict";
import { hapticTuning, physicsConfig, timing } from "../core/game-config.js";
import { resolvedMapConfig } from "../core/map-config.js";
import { createLifecycleController } from "../core/game-lifecycle.js";
import { GAME_PHASES, SENSOR_MODES } from "../core/runtime-states.js";
import { createGameState } from "../core/state.js";

function createLifecycleHarness() {
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig,
  });
  const calls = {
    introPause: 0,
    introResume: 0,
    mapReset: 0,
    scheduledFrames: 0,
    sensorPause: 0,
    sensorResume: 0,
  };
  let settingsOpen = false;

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
      reset() {},
      hideMessage() {},
      pause() {
        calls.introPause++;
      },
      resume() {
        calls.introResume++;
      },
      schedule() {},
    },
    mapRenderer: { resetIntroPen() {} },
    resetMap() {
      calls.mapReset++;
    },
    resetCalibration() {},
    scheduleFrame() {
      calls.scheduledFrames++;
    },
    sensorWatchdog: {
      pause() {
        calls.sensorPause++;
      },
      reset() {},
      resume() {
        calls.sensorResume++;
      },
      schedule() {},
    },
    settings: { fullscreenEnabled: false },
    timing,
    trailRenderer: { clear() {} },
    ui: {
      closeSettingsModal() {
        settingsOpen = false;
      },
      isSettingsOpen: () => settingsOpen,
      openSettingsModal() {
        settingsOpen = true;
      },
      setGameStatus() {},
      setHint() {},
      setStartControls() {},
    },
    getSpawn: () => resolvedMapConfig.spawn,
    enableMotion() {},
    requestFullscreen() {},
    requestMotionPermission: () => Promise.resolve(true),
    keepDisplayAwake() {},
  });

  return {
    calls,
    controller: lifecycle.gameController,
    isSettingsOpen: () => settingsOpen,
    state,
  };
}

async function testStartPauseResumeReset() {
  const harness = createLifecycleHarness();
  const { calls, controller, state } = harness;

  state.input.keyboard.x = 1;
  state.input.sensor.using = SENSOR_MODES.keyboard;

  await controller.start();
  assert.equal(state.game.phase, GAME_PHASES.calibrating);
  assert.equal(state.game.paused, false);
  assert.equal(calls.mapReset, 1);
  assert.equal(state.input.keyboard.x, 0);
  assert.equal(state.input.sensor.using, SENSOR_MODES.none);

  controller.openSettings();
  assert.equal(harness.isSettingsOpen(), true);
  assert.equal(state.game.paused, true);
  assert.equal(calls.sensorPause, 1);
  assert.equal(calls.introPause, 1);
  controller.closeSettings();
  assert.equal(harness.isSettingsOpen(), false);
  assert.equal(state.game.paused, false);
  assert.equal(calls.sensorResume, 1);
  assert.equal(calls.introResume, 1);

  state.game.phase = GAME_PHASES.running;
  state.intro.released = true;

  controller.reset();
  assert.equal(state.game.phase, GAME_PHASES.waiting);
  assert.equal(state.intro.released, false);
  assert.equal(state.game.paused, false);
  assert.equal(calls.mapReset, 2);
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
      reset() {},
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
    ui: {
      isSettingsOpen: () => false,
      setGameStatus() {},
      setHint() {},
      setStartControls() {},
    },
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
  let gameStatus = "";
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
      reset() {},
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
      setGameStatus(message) {
        gameStatus = message;
      },
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
  assert.equal(gameStatus, hint);
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
  let gameStatus = "";
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
      reset() {},
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
      setGameStatus(message) {
        gameStatus = message;
      },
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
  assert.equal(gameStatus, hint);
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
      reset() {},
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
      setGameStatus() {},
      setHint() {},
      setStartControls() {},
    },
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

await testStartPauseResumeReset();
await testStartRequestsFullscreenFromClickPath();
await testStartContinuesWhenMotionPermissionStalls();
await testMotionPermissionDenialKeepsKeyboardFallbackActive();
testResumeResetsFrameClock();

console.log("Lifecycle tests passed.");

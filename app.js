import { createCameraController } from "./camera.js";
import {
  mapConfig,
  timing,
  tuning,
  hapticTuning,
  visualConfig,
  physicsConfig,
  settingsConfig,
  settingsControls
} from "./config.js";
import { copy } from "./copy.js";
import { debugLines } from "./debug.js";
import { els } from "./dom.js";
import { createEffectsRenderer } from "./effects.js";
import { createFrameLoop } from "./frame-loop.js";
import { createGameController } from "./game-controller.js";
import { clamp, distance, angle, midpoint } from "./geometry.js";
import { createHapticsController } from "./haptics.js";
import { createInputManager } from "./input-manager.js";
import { createIntroSequence } from "./intro-sequence.js";
import {
  resetIntroTimerState,
  shouldPauseGame
} from "./intro-timers.js";
import {
  introPenWalls,
  mapEdgeWalls,
  setReleasedBounds as setReleasedMapBounds,
  updateIntroBounds as updateIntroMapBounds
} from "./map.js";
import { createMapRenderer } from "./map-renderer.js";
import { createMarbleView } from "./marble-view.js";
import { marbleOverRect, updatePhysicsInput, updatePhysics } from "./physics.js";
import {
  requestFullscreenMode,
  exitFullscreenMode,
  requestWakeLock,
  requestMotionPermissionIfNeeded,
  screenAdjusted
} from "./platform.js";
import { renderMapElements, renderWalls } from "./rendering.js";
import { createSensorWatchdog } from "./sensor-watchdog.js";
import { bindSettingsPanel } from "./settings-panel.js";
import {
  createRuntimeSettings,
  persistedSettingsFromRuntime
} from "./settings-runtime.js";
import {
  applyRangeConfig,
  loadSettings,
  saveSettings as persistSettings
} from "./settings-store.js";
import { createGameState } from "./state.js";
import { createTerrainView } from "./terrain-view.js";
import { createTrailRenderer } from "./trail.js";
import { createUi } from "./ui.js";

function showBootError(error) {
  const hintEl = document.getElementById("hint");
  if (hintEl) {
    hintEl.textContent = copy.bootError;
  }
  console.error(error);
}

const {
  game: gameEl,
  world: worldEl,
  introWalls: introWallsEl,
  mapWalls: mapWallsEl,
  roughPatches: roughPatchesEl,
  obstacles: obstaclesEl,
  trail: trailEl,
  trailSegments: trailSegmentsEl,
  effects: effectsEl,
  marble: marbleEl,
  messageOverlay,
  controls: controlsEl,
  startBtn,
  neutralBtn,
  settingsToggle,
  settingsOverlay,
  closeSettings,
  resumeGame: resumeBtn,
  speedSetting,
  sensitivitySetting,
  rotationSetting,
  hapticsSetting,
  trailSetting,
  fullscreenSetting,
  hint,
  debug
} = els;

const world = mapConfig.world;
const mapElements = mapConfig.elements;
const obstacles = mapElements.filter((element) => element.type === "obstacle");
const roughPatches = mapElements.filter((element) => element.type === "roughPatch");

const state = createGameState({ world, mapConfig, timing, hapticTuning, physicsConfig });
const {
  marble,
  bounds,
  intro,
  tilt,
  keyboard,
  camera,
  haptics,
  calibration,
  sensor,
  game,
  physics
} = state;

let lastFrame = performance.now();
let settingsPausedGame = false;
let pendingStartFullscreenRequest = null;
const settingsStorageKey = "marbleGameSettings";

const persistedSettings = loadSettings({
  storage: localStorage,
  storageKey: settingsStorageKey,
  defaults: settingsConfig,
  controls: settingsControls,
  clamp
});
const settings = createRuntimeSettings(persistedSettings);
const ui = createUi({ hint, debug, settingsOverlay, debugLines, state });
const frameLoop = createFrameLoop();

function saveSettings() {
  persistSettings({
    storage: localStorage,
    storageKey: settingsStorageKey,
    settings: persistedSettingsFromRuntime(settings)
  });
}

function scheduleFrame() {
  frameLoop.schedule();
}

function requestRender() {
  frameLoop.requestRender();
}

function applySettings() {
  physics.maxSpeed = settings.maxSpeed;
  physics.accel = settings.acceleration;
  camera.rotationEnabled = settings.rotationEnabled;
  haptics.enabled = settings.hapticsEnabled;
  trailRenderer.setEnabled(settings.trailEnabled);
}

function applyFullscreenSetting() {
  if (settings.fullscreenEnabled) {
    requestFullscreenMode({ fullscreenOnStart: true });
  } else {
    exitFullscreenMode();
  }
}

const hapticFeedback = createHapticsController(haptics, hapticTuning);
const cameraController = createCameraController({
  camera,
  cameraEl: worldEl,
  game,
  intro,
  marble,
  tuning,
  clamp,
  distance,
  angle,
  midpoint,
  viewport: {
    width: () => innerWidth,
    height: () => innerHeight
  }
});
const trailRenderer = createTrailRenderer({
  trailEl,
  trailSegmentsEl,
  marble,
  game,
  settings,
  config: visualConfig.trail,
  clamp
});
const effectsRenderer = createEffectsRenderer({
  effectsEl,
  marble,
  config: visualConfig.effects,
  clamp
});
const marbleView = createMarbleView({
  marbleEl,
  marble,
  world,
  mapConfig,
  visualConfig,
  clamp
});
const terrainView = createTerrainView({
  roughPatchesEl,
  obstaclesEl,
  roughPatches,
  obstacles,
  intro,
  marble,
  marbleOverRect,
  renderMapElements
});
const mapRenderer = createMapRenderer({
  worldEl,
  introWallsEl,
  mapWallsEl,
  trailEl,
  bounds,
  intro,
  marble,
  world,
  viewport: {
    width: () => innerWidth,
    height: () => innerHeight
  },
  terrainView,
  renderWalls,
  introPenWalls,
  mapEdgeWalls,
  setReleasedMapBounds,
  updateIntroMapBounds
});

function keepDisplayAwakeWhenVisible() {
  if (document.visibilityState === "visible" && game.phase !== "waiting") {
    requestWakeLock();
  }
}

function resize() {
  marbleView.syncRadius();
  if (!intro.released) mapRenderer.updateIntroBounds();
  marble.x = clamp(marble.x, bounds.left + marble.r, bounds.right - marble.r);
  marble.y = clamp(marble.y, bounds.top + marble.r, bounds.bottom - marble.r);
  if (!intro.released) cameraController.centerOnMarble();
  else cameraController.applyTransform();
  requestRender();
}
addEventListener("resize", resize);
document.addEventListener("visibilitychange", keepDisplayAwakeWhenVisible);

function releaseMap() {
  intro.released = true;
  intro.sequenceStage = "idle";
  mapRenderer.openMap();
  introSequence.hideMessage();
  ui.setHint(copy.hints.mapOpen);
}

const introSequence = createIntroSequence({
  intro,
  game,
  timing,
  messageOverlay,
  onRelease: releaseMap
});
const sensorWatchdog = createSensorWatchdog({
  delayMs: timing.sensorFallbackMs,
  game,
  sensor,
  onFallback() {
    ui.setHint(copy.hints.noMotionSensor);
    sensor.using = "keyboard";
    game.phase = "keyboard";
    tilt.neutralX = 0;
    tilt.neutralY = 0;
    calibration.autoNeutralDone = true;
    introSequence.schedule();
    scheduleFrame();
  }
});

function maybeAutoNeutral() {
  if (game.paused) return;
  if (calibration.autoNeutralDone) return;

  calibration.sampleX += tilt.rawX;
  calibration.sampleY += tilt.rawY;
  calibration.sampleCount++;

  // first few frames become the user's normal holding posture.
  // not table-flat. not lab-instrument nonsense.
  if (calibration.sampleCount >= tuning.neutralSampleCount) {
    tilt.neutralX = calibration.sampleX / calibration.sampleCount;
    tilt.neutralY = calibration.sampleY / calibration.sampleCount;
    calibration.autoNeutralDone = true;
    game.phase = "running";
    marble.vx = 0; marble.vy = 0;
    ui.setHint(copy.hints.neutralSet);
    introSequence.schedule();
  }
}

function onOrientation(e) {
  if (e.beta == null || e.gamma == null) return;
  sensor.gotOrientation = true;
  sensor.using = "deviceorientation";
  const [tx, ty] = screenAdjusted(e.gamma, e.beta);
  tilt.rawX = tx;
  tilt.rawY = ty;
  maybeAutoNeutral();
}

function onMotion(e) {
  if (sensor.gotOrientation) return;
  const g = e.accelerationIncludingGravity;
  if (!g) return;
  sensor.gotMotion = true;
  sensor.using = "devicemotion fallback";
  tilt.rawX = -(g.x || 0) * tuning.motionGravityScale;
  tilt.rawY = (g.y || 0) * tuning.motionGravityScale;
  maybeAutoNeutral();
}

function resetCalibration() {
  calibration.sampleCount = 0;
  calibration.sampleX = 0;
  calibration.sampleY = 0;
  calibration.autoNeutralDone = false;
  tilt.neutralX = null;
  tilt.neutralY = null;
}

function pauseGame() {
  if (!shouldPauseGame(game)) return false;

  game.paused = true;
  keyboard.x = 0;
  keyboard.y = 0;
  cameraController.resetGesture();
  sensorWatchdog.pause();
  introSequence.pause();
  return true;
}

function resumeGame() {
  if (!game.paused) return;

  game.paused = false;
  lastFrame = performance.now();
  sensorWatchdog.resume(() => game.phase === "calibrating" && sensor.using === "none");
  introSequence.resume();
  scheduleFrame();
}

function resetGameState() {
  sensorWatchdog.reset();
  introSequence.clearTimers();
  resetCalibration();

  game.phase = "waiting";
  game.paused = false;
  settingsPausedGame = false;
  pendingStartFullscreenRequest = null;
  sensor.gotOrientation = false;
  sensor.gotMotion = false;
  sensor.using = "none";

  intro.started = false;
  intro.released = false;
  intro.countdownValue = timing.countdownStart;
  resetIntroTimerState(intro);

  keyboard.x = 0;
  keyboard.y = 0;
  tilt.rawX = 0;
  tilt.rawY = 0;
  tilt.smoothX = 0;
  tilt.smoothY = 0;

  marble.x = world.width / 2;
  marble.y = world.height / 2;
  marble.vx = 0;
  marble.vy = 0;
  marble.roll = 0;
  marble.impactSquash = 0;

  camera.x = 0;
  camera.y = 0;
  camera.scale = 1;
  camera.rotation = 0;
  camera.gestureCooldown = 0;
  cameraController.resetGesture();

  haptics.impact.lastPulse = 0;
  haptics.surface.lastPulse = 0;
  trailRenderer.clear();
  effectsRenderer.clear();
  frameLoop.requestRender();

  controlsEl.hidden = false;
  startBtn.textContent = copy.buttons.start;
  startBtn.disabled = false;
  introSequence.hideMessage();
  mapRenderer.resetIntroPen();
  cameraController.centerOnMarble();
}

function onKeyDown(e) {
  const k = e.key.toLowerCase();
  if (game.paused) return;

  if (k === "arrowleft" || k === "a") keyboard.x = -1;
  if (k === "arrowright" || k === "d") keyboard.x = 1;
  if (k === "arrowup" || k === "w") keyboard.y = -1;
  if (k === "arrowdown" || k === "s") keyboard.y = 1;
  if (["arrowleft","arrowright","arrowup","arrowdown","a","d","w","s"].includes(k)) {
    e.preventDefault();
    sensor.using = sensor.using === "none" ? "keyboard" : sensor.using;
    if (game.phase === "waiting" || game.phase === "calibrating") {
      game.phase = "keyboard";
      tilt.neutralX = 0;
      tilt.neutralY = 0;
      calibration.autoNeutralDone = true;
      introSequence.schedule();
      scheduleFrame();
    }
  }
}

function onKeyUp(e) {
  const k = e.key.toLowerCase();
  if (k === "escape") gameController.closeSettings();
  if (game.paused) return;

  if ((k === "arrowleft" || k === "a") && keyboard.x < 0) keyboard.x = 0;
  if ((k === "arrowright" || k === "d") && keyboard.x > 0) keyboard.x = 0;
  if ((k === "arrowup" || k === "w") && keyboard.y < 0) keyboard.y = 0;
  if ((k === "arrowdown" || k === "s") && keyboard.y > 0) keyboard.y = 0;
}

async function start() {
  startBtn.disabled = true;
  controlsEl.hidden = true;

  const fullscreenRequest = pendingStartFullscreenRequest ||
    requestFullscreenMode({ fullscreenOnStart: settings.fullscreenEnabled });
  pendingStartFullscreenRequest = null;

  const ok = await requestMotionPermissionIfNeeded();
  if (!ok) {
    await fullscreenRequest;
    if (settings.fullscreenEnabled) exitFullscreenMode();
    controlsEl.hidden = false;
    startBtn.disabled = false;
    ui.setHint(copy.hints.motionDenied);
    return;
  }

  requestWakeLock();
  gameController.reset();
  controlsEl.hidden = true;
  startBtn.disabled = true;
  inputManager.enableMotion();
  game.phase = "calibrating";
  scheduleFrame();

  ui.setHint(copy.hints.calibrating);

  sensorWatchdog.schedule();
}

function setNeutralNow() {
  tilt.neutralX = tilt.rawX;
  tilt.neutralY = tilt.rawY;
  calibration.autoNeutralDone = true;
  if (game.phase === "calibrating") game.phase = "running";
  calibration.sampleCount = tuning.neutralSampleCount;
  marble.vx = 0; marble.vy = 0;
  tilt.smoothX = 0; tilt.smoothY = 0;
  ui.setHint(copy.hints.neutralReset);
}

function requestStartFullscreen() {
  if (startBtn.disabled || game.phase !== "waiting") return;

  pendingStartFullscreenRequest = requestFullscreenMode({ fullscreenOnStart: settings.fullscreenEnabled });
}

function openSettings() {
  if (ui.isSettingsOpen()) return;

  settingsPausedGame = gameController.pause();
  ui.openSettingsModal();
}

function closeSettingsModal() {
  ui.closeSettingsModal();
  if (settingsPausedGame) {
    settingsPausedGame = false;
    gameController.resume();
  }
}

const gameController = createGameController({
  start,
  reset: resetGameState,
  pause: pauseGame,
  resume: resumeGame,
  openSettings,
  closeSettings: closeSettingsModal,
  tick: loop
});
frameLoop.setTick(gameController.tick);
const inputManager = createInputManager({
  gameEl,
  startBtn,
  onOrientation,
  onMotion,
  onKeyDown,
  onKeyUp,
  onPointerDown: cameraController.onPointerDown,
  onPointerMove: cameraController.onPointerMove,
  onPointerEnd: cameraController.onPointerEnd,
  onStartPointerDown: requestStartFullscreen,
  onStartClick: gameController.start
});

bindSettingsPanel({
  els,
  settings,
  controls: settingsControls,
  applyRangeConfig,
  applySettings,
  applyFullscreenSetting,
  saveSettings,
  onOpenSettings: gameController.openSettings,
  onCloseSettings: gameController.closeSettings,
  onSetNeutral: setNeutralNow,
  onRotationDisabled() {
    camera.rotation = 0;
    cameraController.centerOnMarble();
  },
  requestRender
});

function physicsContext() {
  return {
    marble,
    bounds,
    intro,
    tilt,
    keyboard,
    camera,
    physics,
    obstacles,
    roughPatches
  };
}

function loop() {
  frameLoop.beginFrame();
  const now = performance.now();
  const dt = clamp(
    (now - lastFrame) / timing.targetFrameMs,
    timing.minFrameStep,
    timing.maxFrameStep
  );
  lastFrame = now;
  const active = game.phase !== "waiting" && !game.paused;

  if (frameLoop.shouldSkipIdle(active)) {
    ui.updateDebugPanel();
    return;
  }

  if (active) {
    const context = physicsContext();
    updatePhysicsInput(context, dt);
    updatePhysics(context, dt, {
      onImpact: (impact) => {
        marble.impactSquash = Math.max(
          marble.impactSquash,
          clamp(impact / visualConfig.marble.impactSquashDivisor, 0, 1)
        );
        effectsRenderer.spawnImpact(impact);
        hapticFeedback.pulseImpact(impact);
      },
      onSurface: (speed) => {
        effectsRenderer.spawnSurface(speed, now);
        hapticFeedback.pulseSurface(speed);
      }
    });
    marble.roll += Math.hypot(marble.vx, marble.vy) * dt / Math.max(marble.r, 1);
    marble.impactSquash = Math.max(0, marble.impactSquash - visualConfig.marble.impactSquashDecay * dt);
    cameraController.updateFollow(dt);
  }

  marbleView.render();
  terrainView.updateRoughPatchFeedback();
  if (!game.paused) trailRenderer.update(now);
  ui.updateDebugPanel();
  frameLoop.markRendered();

  if (active) scheduleFrame();
}

try {
  mapRenderer.setup();
  applySettings();
  marbleView.syncRadius();
  cameraController.centerOnMarble();
  inputManager.bindStartButton();
  inputManager.enableKeyboard();
  inputManager.enableGestures();
  requestRender();
} catch (error) {
  showBootError(error);
  throw error;
}

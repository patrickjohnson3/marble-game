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
import { applyDocumentCopy, copy } from "./copy.js";
import { debugLines } from "./debug.js";
import { createDomElements } from "./dom.js";
import { createFrameLoop } from "./frame-loop.js";
import { createGameLoop } from "./game-loop.js";
import { createLifecycleController } from "./game-lifecycle.js";
import { clamp, distance, angle, midpoint } from "./geometry.js";
import { createIntroSequence } from "./intro-sequence.js";
import { createKeyboardController } from "./keyboard-controller.js";
import {
  exitFullscreenMode,
  requestFullscreenMode,
  requestMotionPermissionIfNeeded,
  requestWakeLock,
  screenAdjusted
} from "./platform.js";
import {
  setupFeedback,
  setupInput,
  setupRenderers,
  setupSensors
} from "./app-setup.js";
import { bindSettingsPanel } from "./settings-panel.js";
import { createSettingsApplier } from "./settings-applier.js";
import {
  createRuntimeSettings,
  persistedSettingsFromRuntime
} from "./settings-runtime.js";
import {
  applyRangeConfig,
  availableStorage,
  loadSettings,
  saveSettings as persistSettings
} from "./settings-store.js";
import { createGameState } from "./state.js";
import { createUi } from "./ui.js";
import { createViewport } from "./viewport.js";

function showBootError(documentRef, error) {
  const hintEl = documentRef.getElementById("hint");
  if (hintEl) {
    hintEl.textContent = copy.bootError;
  }
  console.error(error);
}

export function createApp({
  document: documentRef = document,
  window: windowRef = window,
  storage = availableStorage(() => windowRef.localStorage)
} = {}) {
const els = createDomElements(documentRef);
const {
  world: worldEl,
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

const settingsStorageKey = "marbleGameSettings";
const settingsStorage = storage;

const persistedSettings = loadSettings({
  storage: settingsStorage,
  storageKey: settingsStorageKey,
  defaults: settingsConfig,
  controls: settingsControls,
  clamp
});
const settings = createRuntimeSettings(persistedSettings);
const ui = createUi({ hint, debug, settingsOverlay, debugLines, state });
const frameLoop = createFrameLoop();
const viewport = createViewport(windowRef);

function saveSettings() {
  persistSettings({
    storage: settingsStorage,
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

const hapticFeedback = setupFeedback(haptics);
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
  viewport
});
const {
  effectsRenderer,
  mapRenderer,
  marbleView,
  terrainView,
  trailRenderer
} = setupRenderers({
  els,
  state,
  world,
  viewport,
  settings,
  clamp,
  obstacles,
  roughPatches
});
const {
  applyFullscreenSetting,
  applySettings
} = createSettingsApplier({
  camera,
  cameraController,
  documentRef,
  haptics,
  physics,
  settings,
  trailRenderer
});

function keepDisplayAwakeWhenVisible() {
  if (documentRef.visibilityState === "visible" && game.phase !== "waiting") {
    requestWakeLock({ documentRef, navigatorRef: windowRef.navigator });
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
windowRef.addEventListener("resize", resize);
documentRef.addEventListener("visibilitychange", keepDisplayAwakeWhenVisible);

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
const {
  sensorController,
  sensorWatchdog
} = setupSensors({
  state,
  introSequence,
  scheduleFrame,
  ui,
  adjustScreen: (gamma, beta) => screenAdjusted(gamma, beta, {
    screenRef: windowRef.screen,
    windowRef
  })
});

let gameLoop;
let inputManager;
const lifecycle = createLifecycleController({
  cameraController,
  calibration,
  controlsEl,
  effectsRenderer,
  frameLoop,
  game,
  haptics,
  intro,
  introSequence,
  keyboard,
  mapRenderer,
  marble,
  resetCalibration: sensorController.resetCalibration,
  scheduleFrame,
  sensor,
  sensorWatchdog,
  settings,
  startBtn,
  tilt,
  timing,
  trailRenderer,
  ui,
  world,
  enableMotion: () => inputManager.enableMotion(),
  requestFullscreen: (options) => requestFullscreenMode({ ...options, documentRef }),
  exitFullscreen: () => exitFullscreenMode({ documentRef }),
  requestMotionPermission: () => requestMotionPermissionIfNeeded({ windowRef }),
  keepDisplayAwake: () => requestWakeLock({ documentRef, navigatorRef: windowRef.navigator }),
  tick: () => gameLoop.tick()
});
const { gameController } = lifecycle;
const keyboardController = createKeyboardController({
  calibration,
  game,
  introSequence,
  keyboard,
  scheduleFrame,
  sensor,
  tilt,
  closeSettings: gameController.closeSettings
});
frameLoop.setTick(gameController.tick);
inputManager = setupInput({
  els,
  sensorController,
  keyboardController,
  cameraController,
  gameController
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
  onSetNeutral: sensorController.setNeutralNow,
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

gameLoop = createGameLoop({
  cameraController,
  clamp,
  effectsRenderer,
  frameLoop,
  game,
  hapticFeedback,
  lifecycle,
  marble,
  marbleView,
  physicsContext,
  scheduleFrame,
  terrainView,
  timing,
  trailRenderer,
  ui,
  visualConfig
});

try {
  applyDocumentCopy({ document: documentRef, els });
  mapRenderer.setup();
  applySettings();
  marbleView.syncRadius();
  cameraController.centerOnMarble();
  inputManager.bindStartButton();
  inputManager.enableKeyboard();
  inputManager.enableGestures();
  requestRender();
  windowRef.__marbleAppBooted = true;
} catch (error) {
  showBootError(documentRef, error);
  throw error;
}

return {
  gameController,
  inputManager,
  state
};
}

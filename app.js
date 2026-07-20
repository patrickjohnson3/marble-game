import { createCameraController } from "./core/camera.js";
import {
  hapticTuning,
  physicsConfig,
  timing,
  tuning,
  visualConfig,
} from "./core/game-config.js";
import { baseMapConfig, resolvedMapConfig } from "./core/map-config.js";
import { applyDocumentCopy, copy } from "./core/copy.js";
import { debugLines } from "./core/debug.js";
import { createDomElements } from "./core/dom.js";
import { createFrameLoop } from "./core/frame-loop.js";
import { createAppMapController } from "./core/app-map-controller.js";
import { createGameLoop } from "./core/game-loop.js";
import { createLifecycleController } from "./core/game-lifecycle.js";
import { createGoalController } from "./core/goal-controller.js";
import { clamp, distance, midpoint } from "./core/geometry.js";
import { createIntroSequence } from "./core/intro-sequence.js";
import { createMapProgression } from "./core/map-progression.js";
import { createMapRuntime } from "./core/map-runtime.js";
import { createKeyboardController } from "./input/keyboard-controller.js";
import {
  exitFullscreenMode,
  requestFullscreenMode,
  requestMotionPermissionIfNeeded,
  requestWakeLock,
  screenAdjusted,
  createViewport,
} from "./platform/platform.js";
import {
  setupFeedback,
  setupInput,
  setupRenderers,
  setupSensors,
} from "./core/app-setup.js";
import { bindSettingsPanel } from "./settings/settings-panel.js";
import { createSettingsApplier } from "./settings/settings-applier.js";
import {
  applyRangeConfig,
  availableStorage,
  createRuntimeSettings,
  loadSettings,
  persistedSettingsFromRuntime,
  saveSettings as persistSettings,
} from "./settings/settings-store.js";
import {
  settingsConfig,
  settingsControls,
} from "./settings/settings-config.js";
import { createGameState } from "./core/state.js";
import { createUi } from "./rendering/ui.js";

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
  storage = availableStorage(() => windowRef.localStorage),
} = {}) {
  const els = createDomElements(documentRef);
  const {
    world: worldEl,
    messageOverlay,
    controls: controlsEl,
    startBtn,
    settingsOverlay,
    fpsCounter,
    hint,
    debug,
  } = els;

  const mapRuntime = createMapRuntime({
    initialMap: resolvedMapConfig,
    collisionIndexCellSize: physicsConfig.collisionIndexCellSize,
  });
  const mapState = mapRuntime.state;
  const world = mapState.activeMap.world;

  const state = createGameState({
    world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig,
  });
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
    physics,
  } = state;

  const settingsStorageKey = "marbleGameSettings";
  const settingsStorage = storage;

  const persistedSettings = loadSettings({
    storage: settingsStorage,
    storageKey: settingsStorageKey,
    defaults: settingsConfig,
    controls: settingsControls,
    clamp,
  });
  const settings = createRuntimeSettings(persistedSettings);
  const ui = createUi({
    controls: controlsEl,
    hint,
    fpsCounter,
    debug,
    settings,
    settingsOverlay,
    startBtn,
    debugLines,
    state,
  });
  const frameLoop = createFrameLoop();
  const viewport = createViewport(windowRef);

  function saveSettings() {
    persistSettings({
      storage: settingsStorage,
      storageKey: settingsStorageKey,
      settings: persistedSettingsFromRuntime(settings),
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
    midpoint,
    viewport,
  });
  const {
    effectsRenderer,
    mapRenderer,
    marbleView,
    terrainView,
    trailRenderer,
  } = setupRenderers({
    els,
    state,
    world,
    viewport,
    settings,
    clamp,
    icePatches: mapState.icePatches,
    icePatchBounds: mapState.icePatchBounds,
    obstacles: mapState.obstacles,
    obstacleBounds: mapState.obstacleBounds,
    goal: mapState.goal,
    roughPatches: mapState.roughPatches,
    roughPatchBounds: mapState.roughPatchBounds,
  });
  const { applyFullscreenSetting, applySettings } = createSettingsApplier({
    camera,
    cameraController,
    documentRef,
    haptics,
    physics,
    settings,
    trailRenderer,
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

  let mapController;
  const introSequence = createIntroSequence({
    intro,
    game,
    timing,
    messageOverlay,
    onRelease: () => mapController.releaseMap(),
  });
  mapController = createAppMapController({
    cameraController,
    copy: copy.hints,
    effectsRenderer,
    intro,
    introSequence,
    mapRenderer,
    mapRuntime,
    marble,
    terrainView,
    trailRenderer,
    ui,
  });
  const mapProgression = createMapProgression({
    baseMapConfig,
    getCurrentMap: () => mapState.activeMap,
    applyMap: mapController.setCurrentMap,
    resetForNextMap: mapController.resetForNextMap,
    terrainView,
    ui,
    copy: copy.hints,
    requestRender,
  });
  const goalController = createGoalController({
    copy: copy.hints,
    hapticFeedback,
    intro,
    mapProgression,
    mapRuntime,
    marble,
    terrainView,
    timing,
    ui,
  });

  const { sensorController, sensorWatchdog } = setupSensors({
    state,
    introSequence,
    scheduleFrame,
    ui,
    adjustScreen: (gamma, beta) =>
      screenAdjusted(gamma, beta, {
        screenRef: windowRef.screen,
        windowRef,
      }),
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
    resetMap: () => mapController.setCurrentMap(resolvedMapConfig),
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
    spawn: mapState.spawn,
    enableMotion: () => inputManager.enableMotion(),
    requestFullscreen: (options) =>
      requestFullscreenMode({ ...options, documentRef }),
    exitFullscreen: () => exitFullscreenMode({ documentRef }),
    requestMotionPermission: () =>
      requestMotionPermissionIfNeeded({ windowRef }),
    keepDisplayAwake: () =>
      requestWakeLock({ documentRef, navigatorRef: windowRef.navigator }),
    tick: () => gameLoop.tick(),
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
    closeSettings: gameController.closeSettings,
  });
  frameLoop.setTick(gameController.tick);
  inputManager = setupInput({
    els,
    sensorController,
    keyboardController,
    cameraController,
    gameController,
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
    onFpsChanged: ui.setFpsEnabled,
    onStatsChanged: ui.setStatsEnabled,
    requestRender,
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
      icePatches: mapState.icePatches,
      icePatchIndex: mapState.icePatchIndex,
      obstacles: mapState.obstacles,
      obstacleIndex: mapState.obstacleIndex,
      roughPatches: mapState.roughPatches,
      roughPatchIndex: mapState.roughPatchIndex,
    };
  }

  gameLoop = createGameLoop({
    cameraController,
    clamp,
    effectsRenderer,
    frameLoop,
    game,
    hapticFeedback,
    goalController,
    lifecycle,
    marble,
    marbleView,
    physicsContext,
    scheduleFrame,
    terrainView,
    timing,
    trailRenderer,
    ui,
    visualConfig,
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
    state,
  };
}

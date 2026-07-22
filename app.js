import { createCameraController } from "./core/camera.js";
import {
  bestTimeLabel,
  formatRunTime,
  loadBestTime,
  recordBestTime,
} from "./core/best-times.js";
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
import { createHapticsController } from "./core/haptics.js";
import { createIntroSequence } from "./core/intro-sequence.js";
import {
  introPenWalls,
  mapEdgeWalls,
  setReleasedBounds as setReleasedMapBounds,
  updateIntroBounds as updateIntroMapBounds,
} from "./core/map-bounds.js";
import { createMapProgression } from "./core/map-progression.js";
import { createMapRuntime } from "./core/map-runtime.js";
import { createEffectsRenderer } from "./rendering/effects.js";
import { renderHazardPatches } from "./rendering/hazard-patch-rendering.js";
import { renderIcePatches } from "./rendering/ice-patch-rendering.js";
import {
  createMapRenderer,
  createTerrainView,
} from "./rendering/map-renderer.js";
import { renderMapTheme } from "./rendering/map-theme-rendering.js";
import { createMarbleView } from "./rendering/marble-view.js";
import { renderObstacleWalls } from "./rendering/obstacle-rendering.js";
import { renderRoughPatches } from "./rendering/rough-patch-rendering.js";
import { createTrailRenderer } from "./rendering/trail.js";
import { renderOuterWalls } from "./rendering/wall-rendering.js";
import { createInputManager } from "./input/input-manager.js";
import { createKeyboardController } from "./input/keyboard-controller.js";
import { createSensorController } from "./input/sensor-controller.js";
import { createSensorWatchdog } from "./input/sensor-watchdog.js";
import {
  exitFullscreenMode,
  requestFullscreenMode,
  requestMotionPermissionIfNeeded,
  requestWakeLock,
  registerServiceWorker,
  screenAdjusted,
  createViewport,
} from "./platform/platform.js";
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
import { GAME_PHASES, SENSOR_MODES } from "./core/runtime-states.js";
import { createGameState } from "./core/state.js";
import { createUi } from "./rendering/ui.js";

function showBootError(documentRef, error) {
  const hintEl = documentRef.getElementById("hint");
  if (hintEl) {
    hintEl.textContent = copy.bootError;
  }
  console.error(error);
}

function setupRenderers({
  els,
  state,
  world,
  viewport,
  settings,
  clamp,
  mapState,
}) {
  const {
    world: worldEl,
    introWalls: introWallsEl,
    mapWalls: mapWallsEl,
    mapTheme: mapThemeEl,
    mapThemeOverlay: mapThemeOverlayEl,
    hazardPatches: hazardPatchesEl,
    icePatches: icePatchesEl,
    roughPatches: roughPatchesEl,
    obstacles: obstaclesEl,
    goal: goalEl,
    trail: trailEl,
    trailSegments: trailSegmentsEl,
    effects: effectsEl,
    marble: marbleEl,
  } = els;
  const { bounds, game, intro, marble } = state;
  const trailRenderer = createTrailRenderer({
    trailEl,
    trailSegmentsEl,
    marble,
    game,
    settings,
    config: visualConfig.trail,
    clamp,
  });
  const effectsRenderer = createEffectsRenderer({
    effectsEl,
    marble,
    config: visualConfig.effects,
    clamp,
  });
  const marbleView = createMarbleView({
    marbleEl,
    marble,
    world,
    mapConfig: resolvedMapConfig,
    visualConfig,
    clamp,
  });
  const terrainView = createTerrainView({
    mapThemeEl,
    mapThemeOverlayEl,
    hazardPatchesEl,
    icePatchesEl,
    roughPatchesEl,
    obstaclesEl,
    goalEl,
    goal: mapState.goal,
    mapConfig: mapState.activeMap,
    world,
    hazardPatches: mapState.hazardPatches,
    hazardPatchBounds: mapState.hazardPatchBounds,
    icePatches: mapState.icePatches,
    icePatchBounds: mapState.icePatchBounds,
    roughPatches: mapState.roughPatches,
    roughPatchBounds: mapState.roughPatchBounds,
    obstacles: mapState.obstacles,
    obstacleBounds: mapState.obstacleBounds,
    renderHazardPatches: (container, renderedHazardPatches, renderedBounds) =>
      renderHazardPatches(container, renderedHazardPatches, {
        bounds: renderedBounds,
        padding: visualConfig.map.hazardPatchCanvasPadding,
      }),
    renderIcePatches: (container, renderedIcePatches, renderedBounds) =>
      renderIcePatches(container, renderedIcePatches, {
        bounds: renderedBounds,
        padding: visualConfig.map.icePatchCanvasPadding,
      }),
    renderMapTheme,
    renderObstacleWalls: (container, renderedObstacles, renderedBounds) =>
      renderObstacleWalls(container, renderedObstacles, {
        bounds: renderedBounds,
        padding: visualConfig.map.obstacleCanvasPadding,
      }),
    renderRoughPatches: (container, renderedRoughPatches, renderedBounds) =>
      renderRoughPatches(container, renderedRoughPatches, {
        bounds: renderedBounds,
        padding: visualConfig.map.roughPatchCanvasPadding,
      }),
    goalFillEdgePercent: visualConfig.map.goalFillEdgePercent,
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
    viewport,
    terrainView,
    renderOuterWalls,
    introPenWalls,
    mapEdgeWalls,
    setReleasedMapBounds,
    updateIntroMapBounds,
  });

  return {
    effectsRenderer,
    mapRenderer,
    marbleView,
    terrainView,
    trailRenderer,
  };
}

function setupSensors({
  state,
  introSequence,
  scheduleFrame,
  ui,
  adjustScreen,
}) {
  const { calibration, sensor, tilt } = state.input;
  const { game, marble } = state;
  const sensorWatchdog = createSensorWatchdog({
    delayMs: timing.sensorFallbackMs,
    game,
    sensor,
    onFallback() {
      ui.setHint(copy.hints.noMotionSensor);
      sensor.using = SENSOR_MODES.keyboard;
      game.phase = GAME_PHASES.keyboard;
      tilt.neutralX = 0;
      tilt.neutralY = 0;
      calibration.autoNeutralDone = true;
      introSequence.schedule();
      scheduleFrame();
    },
  });
  const sensorController = createSensorController({
    calibration,
    game,
    introSequence,
    marble,
    scheduleFrame,
    sensor,
    tilt,
    tuning,
    ui,
    adjustScreen,
  });

  return {
    sensorController,
    sensorWatchdog,
  };
}

function setupInput({
  els,
  sensorController,
  keyboardController,
  cameraController,
  gameController,
}) {
  return createInputManager({
    gameEl: els.game,
    startBtn: els.startBtn,
    onOrientation: sensorController.onOrientation,
    onMotion: sensorController.onMotion,
    onKeyDown: keyboardController.onKeyDown,
    onKeyUp: keyboardController.onKeyUp,
    onPointerDown: cameraController.onPointerDown,
    onPointerMove: cameraController.onPointerMove,
    onPointerEnd: cameraController.onPointerEnd,
    onStartClick: gameController.start,
  });
}

function setupFeedback(haptics) {
  return createHapticsController(haptics, hapticTuning);
}

function createSettingsRuntime(storage) {
  const storageKey = "marbleGameSettings";
  const persistedSettings = loadSettings({
    storage,
    storageKey,
    defaults: settingsConfig,
    controls: settingsControls,
    clamp,
  });
  const settings = createRuntimeSettings(persistedSettings);

  function saveSettings() {
    persistSettings({
      storage,
      storageKey,
      settings: persistedSettingsFromRuntime(settings),
    });
  }

  return {
    saveSettings,
    settings,
  };
}

function bindViewportEvents({
  cameraController,
  documentRef,
  game,
  intro,
  mapRenderer,
  marble,
  marbleView,
  requestRender,
  windowRef,
  bounds,
}) {
  function keepDisplayAwakeWhenVisible() {
    if (
      documentRef.visibilityState === "visible" &&
      game.phase !== GAME_PHASES.waiting
    ) {
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
}

function createCurrentPhysicsContext({ state, mapState }) {
  const { bounds, camera, game, input, intro, marble, physics } = state;
  const { keyboard, tilt } = input;
  const physicsContext = {
    marble,
    bounds,
    intro,
    tilt,
    keyboard,
    camera,
    game,
    physics,
    hazardPatches: mapState.hazardPatches,
    hazardPatchIndex: mapState.hazardPatchIndex,
    icePatches: mapState.icePatches,
    icePatchIndex: mapState.icePatchIndex,
    obstacles: mapState.obstacles,
    obstacleIndex: mapState.obstacleIndex,
    roughPatches: mapState.roughPatches,
    roughPatchIndex: mapState.roughPatchIndex,
  };

  return function currentPhysicsContext() {
    physicsContext.hazardPatches = mapState.hazardPatches;
    physicsContext.hazardPatchIndex = mapState.hazardPatchIndex;
    physicsContext.icePatches = mapState.icePatches;
    physicsContext.icePatchIndex = mapState.icePatchIndex;
    physicsContext.obstacles = mapState.obstacles;
    physicsContext.obstacleIndex = mapState.obstacleIndex;
    physicsContext.roughPatches = mapState.roughPatches;
    physicsContext.roughPatchIndex = mapState.roughPatchIndex;
    return physicsContext;
  };
}

function bootInitialRender({
  applySettings,
  cameraController,
  documentRef,
  els,
  inputManager,
  mapRenderer,
  marbleView,
  requestRender,
  windowRef,
}) {
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
}

function mapLevelLabel(mapConfig) {
  const index = baseMapConfig.variants.findIndex(
    (variant) => variant.id === mapConfig.variantId,
  );
  const level = "level " + (index >= 0 ? index + 1 : 1);

  return mapConfig.name ? level + ": " + mapConfig.name : level;
}

function createBestTimeUi({ storage, ui }) {
  function setMapBestTime(mapConfig) {
    ui.setBestTimeLabel(
      bestTimeLabel(loadBestTime(storage, mapConfig.variantId)),
    );
  }

  function recordMapTime(mapConfig, runMs) {
    const bestTime = recordBestTime(storage, mapConfig.variantId, runMs);
    ui.setBestTimeLabel(bestTimeLabel(bestTime));
  }

  return {
    recordMapTime,
    setMapBestTime,
  };
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
    input,
    camera,
    introSequence: introSequenceState,
    haptics,
    game,
    physics,
  } = state;
  const { calibration, keyboard, sensor, tilt } = input;

  const { saveSettings, settings } = createSettingsRuntime(storage);
  const ui = createUi({
    controls: controlsEl,
    hint,
    fpsCounter,
    debug,
    settings,
    settingsOverlay,
    startBtn,
    goalIndicator: els.goalIndicator,
    levelLabel: els.levelLabel,
    bestTimeLabel: els.bestTimeLabel,
    runTimeLabel: els.runTimeLabel,
    debugLines,
    state,
  });
  const frameLoop = createFrameLoop();
  const viewport = createViewport(windowRef);
  const bestTimes = createBestTimeUi({ storage, ui });

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
    mapState,
  });
  const { applyFullscreenSetting, applySettings } = createSettingsApplier({
    documentRef,
    haptics,
    physics,
    settings,
    trailRenderer,
  });

  bindViewportEvents({
    bounds,
    cameraController,
    documentRef,
    game,
    intro,
    mapRenderer,
    marble,
    marbleView,
    requestRender,
    windowRef,
  });

  let mapController;
  const introSequence = createIntroSequence({
    intro,
    sequence: introSequenceState,
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
    applyMap: (nextMap) => {
      mapController.setCurrentMap(nextMap);
      ui.setLevelLabel(mapLevelLabel(nextMap));
      bestTimes.setMapBestTime(nextMap);
    },
    resetForNextMap: mapController.resetForNextMap,
    terrainView,
    ui,
    copy: copy.hints,
    requestRender,
  });
  function retryCurrentMap() {
    mapRuntime.resetGoalProgress();
    terrainView.updateGoalProgress(0);
    mapController.resetForNextMap();
    ui.setHint(copy.hints.mapOpen);
    gameController.closeSettings();
    requestRender();
  }
  const goalController = createGoalController({
    copy: copy.hints,
    effectsRenderer,
    hapticFeedback,
    intro,
    mapProgression,
    mapRuntime,
    marble,
    onComplete: (mapConfig, runMs) => bestTimes.recordMapTime(mapConfig, runMs),
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
    introSequenceState,
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
    getSpawn: () => mapState.spawn,
    enableMotion: () => inputManager.enableMotion(),
    requestFullscreen: (options) =>
      requestFullscreenMode({ ...options, documentRef }),
    exitFullscreen: () => exitFullscreenMode({ documentRef }),
    requestMotionPermission: () =>
      requestMotionPermissionIfNeeded({ windowRef }),
    keepDisplayAwake: () =>
      requestWakeLock({ documentRef, navigatorRef: windowRef.navigator }),
    resetFrameClock: () => gameLoop.resetClock(),
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
    onRetryMap: retryCurrentMap,
    onSetNeutral: sensorController.setNeutralNow,
    onFpsChanged: ui.setFpsEnabled,
    onStatsChanged: ui.setStatsEnabled,
    requestRender,
  });

  const currentPhysicsContext = createCurrentPhysicsContext({
    state,
    mapState,
  });

  gameLoop = createGameLoop({
    cameraController,
    clamp,
    effectsRenderer,
    frameLoop,
    game,
    hapticFeedback,
    goalController,
    goalTarget: () => mapState.goal,
    marble,
    marbleView,
    physicsContext: currentPhysicsContext,
    resetGoalProgress: () => {
      mapRuntime.resetGoalProgress();
      terrainView.updateGoalProgress(0);
    },
    runTimeLabel: (currentTime) =>
      "time " + formatRunTime(mapRuntime.currentRunMs(currentTime)),
    scheduleFrame,
    spawnTarget: () => mapState.spawn,
    terrainView,
    timing,
    trailRenderer,
    ui,
    visualConfig,
  });

  try {
    bootInitialRender({
      applySettings,
      cameraController,
      documentRef,
      els,
      inputManager,
      mapRenderer,
      marbleView,
      requestRender,
      windowRef,
    });
    ui.setLevelLabel(mapLevelLabel(mapState.activeMap));
    bestTimes.setMapBestTime(mapState.activeMap);
    ui.setRunTimeLabel("time --");
    registerServiceWorker({
      navigatorRef: windowRef.navigator,
      onUpdateReady: () => ui.setHint(copy.hints.updateReady),
      windowRef,
    });
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

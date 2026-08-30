import { createCameraController } from "./input/camera-controller.js";
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
import { createGameLoop } from "./core/game-loop.js";
import { createLifecycleController } from "./core/game-lifecycle.js";
import { createGoalController } from "./core/goal-controller.js";
import { clamp } from "./core/geometry.js";
import { createHapticsController } from "./core/haptics.js";
import { createIntroSequence } from "./core/intro-sequence.js";
import { createKitchenDynamics } from "./core/kitchen-dynamics.js";
import {
  introPenWalls,
  mapEdgeWalls,
  setReleasedBounds as setReleasedMapBounds,
  updateIntroBounds as updateIntroMapBounds,
} from "./core/map-bounds.js";
import { MAP_ELEMENT_TYPES } from "./core/map-elements.js";
import { createMapProgression } from "./core/map-progression.js";
import { createMapRuntime } from "./core/map-runtime.js";
import { createEffectsRenderer } from "./rendering/effects.js";
import { renderGooPatches } from "./rendering/goo-patch-rendering.js";
import { renderHazardPatches } from "./rendering/hazard-patch-rendering.js";
import { renderIcePatches } from "./rendering/ice-patch-rendering.js";
import {
  createMapRenderer,
  createTerrainView,
} from "./rendering/map-renderer.js";
import {
  renderMapTheme,
  renderMapThemeDynamics,
} from "./rendering/map-theme-rendering.js";
import { createMarbleView } from "./rendering/marble-view.js";
import {
  renderObstacleHitboxes,
  renderObstacleWalls,
} from "./rendering/obstacle-rendering.js";
import { renderRoughPatches } from "./rendering/rough-patch-rendering.js";
import { renderWaterPatches } from "./rendering/water-patch-rendering.js";
import { createTrailRenderer } from "./rendering/trail.js";
import { renderOuterWalls } from "./rendering/wall-rendering.js";
import { createInputManager } from "./input/input-manager.js";
import { createKeyboardController } from "./input/keyboard-controller.js";
import { createSensorController } from "./input/sensor-controller.js";
import { createSensorWatchdog } from "./input/sensor-watchdog.js";
import {
  createPwaInstallController,
  exitFullscreenMode,
  requestFullscreenMode,
  requestMotionPermissionIfNeeded,
  requestWakeLock,
  registerServiceWorker,
  screenAdjusted,
  createViewport,
  isInstalledPwa,
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
  const bootErrorEl = documentRef.getElementById("bootError");
  if (bootErrorEl) {
    bootErrorEl.textContent = copy.bootError;
    bootErrorEl.hidden = false;
  }
  console.error(error);
}

function setupRenderers({
  els,
  state,
  world,
  viewport,
  settings,
  mapState,
  kitchenDynamicsState,
}) {
  const {
    world: worldEl,
    introWalls: introWallsEl,
    mapWalls: mapWallsEl,
    mapTheme: mapThemeEl,
    mapThemeOverlay: mapThemeOverlayEl,
    gooPatches: gooPatchesEl,
    hazardPatches: hazardPatchesEl,
    icePatches: icePatchesEl,
    roughPatches: roughPatchesEl,
    waterPatches: waterPatchesEl,
    obstacles: obstaclesEl,
    hitboxes: hitboxesEl,
    goal: goalEl,
    trail: trailEl,
    trailSegments: trailSegmentsEl,
    effects: effectsEl,
    marble: marbleEl,
  } = els;
  const terrainPatchRenderers = {
    [MAP_ELEMENT_TYPES.gooPatch]: {
      padding: visualConfig.map.gooPatchCanvasPadding,
      render: renderGooPatches,
    },
    [MAP_ELEMENT_TYPES.hazardPatch]: {
      padding: visualConfig.map.hazardPatchCanvasPadding,
      render: renderHazardPatches,
    },
    [MAP_ELEMENT_TYPES.icePatch]: {
      padding: visualConfig.map.icePatchCanvasPadding,
      render: renderIcePatches,
    },
    [MAP_ELEMENT_TYPES.roughPatch]: {
      padding: visualConfig.map.roughPatchCanvasPadding,
      render: renderRoughPatches,
    },
    [MAP_ELEMENT_TYPES.waterPatch]: {
      padding: visualConfig.map.waterPatchCanvasPadding,
      render: renderWaterPatches,
    },
  };
  const { bounds, game, intro, marble } = state;
  const trailRenderer = createTrailRenderer({
    trailEl,
    trailSegmentsEl,
    marble,
    game,
    settings,
    config: visualConfig.trail,
  });
  const effectsRenderer = createEffectsRenderer({
    effectsEl,
    marble,
    config: visualConfig.effects,
    world,
  });
  const marbleView = createMarbleView({
    marbleEl,
    marble,
    world,
    mapConfig: resolvedMapConfig,
    visualConfig,
  });
  const terrainView = createTerrainView({
    mapThemeEl,
    mapThemeOverlayEl,
    terrainContainers: {
      [MAP_ELEMENT_TYPES.gooPatch]: gooPatchesEl,
      [MAP_ELEMENT_TYPES.hazardPatch]: hazardPatchesEl,
      [MAP_ELEMENT_TYPES.icePatch]: icePatchesEl,
      [MAP_ELEMENT_TYPES.roughPatch]: roughPatchesEl,
      [MAP_ELEMENT_TYPES.waterPatch]: waterPatchesEl,
    },
    obstaclesEl,
    hitboxesEl,
    goalEl,
    mapState,
    dynamicsState: kitchenDynamicsState,
    renderTerrainPatches: (type, container, elements, bounds) => {
      const renderer = terrainPatchRenderers[type];
      if (!renderer) return;
      renderer.render(container, elements, {
        bounds,
        padding: renderer.padding,
      });
    },
    renderMapTheme,
    renderMapThemeDynamics,
    renderObstacleWalls: (
      container,
      renderedObstacles,
      renderedBounds,
      renderedMapConfig,
    ) =>
      renderObstacleWalls(container, renderedObstacles, {
        bounds: renderedBounds,
        mapConfig: renderedMapConfig,
        padding: visualConfig.map.obstacleCanvasPadding,
      }),
    renderObstacleHitboxes,
    goalFillEdgePercent: visualConfig.map.goalFillEdgePercent,
    hitboxOverlayEnabled: settings.hitboxOverlayEnabled,
  });
  const mapRenderer = createMapRenderer({
    worldEl,
    introWallsEl,
    mapWallsEl,
    trailEl,
    bounds,
    intro,
    marble,
    mapState,
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
      ui.setGameStatus(copy.hints.noMotionSensor);
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

function setupFeedback(haptics, windowRef) {
  const vibrate = windowRef.navigator?.vibrate;
  return createHapticsController(haptics, hapticTuning, {
    now: () => windowRef.performance.now(),
    vibrate:
      typeof vibrate === "function"
        ? (pattern) => vibrate.call(windowRef.navigator, pattern)
        : null,
  });
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

function createCurrentPhysicsContext(state, mapState) {
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
    terrainByType: mapState.terrainByType,
    obstacles: mapState.obstacles,
  };

  return function currentPhysicsContext() {
    physicsContext.terrainByType = mapState.terrainByType;
    physicsContext.obstacles = mapState.obstacles;
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

function pwaUpdateStatusText(status) {
  return (
    {
      checking: copy.pwa.checking,
      error: copy.pwa.error,
      ready: "",
      unsupported: copy.pwa.unsupported,
      "update-delayed": copy.pwa.updateDelayed,
      "update-failed": copy.pwa.updateFailed,
      "update-installing": copy.pwa.updateInstalling,
      "update-ready": copy.pwa.updateReady,
    }[status] || ""
  );
}

function mapLevelLabel(mapConfig) {
  const index = baseMapConfig.variants.findIndex(
    (variant) => variant.id === mapConfig.variantId,
  );
  const level = "level " + (index >= 0 ? index + 1 : 1);

  return mapConfig.name ? level + ": " + mapConfig.name : level;
}

function mapObjectSummary(mapConfig) {
  return mapConfig?.objectSummary ?? "objects: walls, patches, goal.";
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
    installApp,
    mapObjectsStatus,
  } = els;

  const mapRuntime = createMapRuntime({
    initialMap: resolvedMapConfig,
  });
  const mapState = mapRuntime.state;
  const world = mapState.activeMap.world;
  const kitchenDynamics = createKitchenDynamics();
  kitchenDynamics.reset({
    mapConfig: mapState.activeMap,
    obstacles: mapState.obstacles,
    waterPatches: mapState.terrainByType[MAP_ELEMENT_TYPES.waterPatch].elements,
    mapState,
  });

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
  const fullscreenManagedByPwa = isInstalledPwa({
    navigatorRef: windowRef.navigator,
    windowRef,
  });
  const ui = createUi({
    controls: controlsEl,
    gameStatus: els.gameStatus,
    hint,
    fpsCounter,
    debug,
    installApp,
    mapObjectsStatus,
    pwaStatus: els.pwaStatus,
    settings,
    settingsOverlay,
    startBtn,
    goalIndicator: els.goalIndicator,
    levelLabel: els.levelLabel,
    debugLines,
    state,
  });
  const frameLoop = createFrameLoop();
  const viewport = createViewport(windowRef);

  function scheduleFrame() {
    frameLoop.schedule();
  }

  function requestRender() {
    frameLoop.requestRender();
  }

  let pwaUpdateStatus = "";
  function updatePwaStatus(status = "") {
    const displayStatus = fullscreenManagedByPwa
      ? copy.pwa.installedFullscreen
      : "";
    pwaUpdateStatus = pwaUpdateStatusText(status);
    ui.setPwaStatus([displayStatus, pwaUpdateStatus].filter(Boolean).join(" "));
  }
  updatePwaStatus();
  ui.setMapObjects(mapObjectSummary(mapState.activeMap));
  const pwaInstallController = createPwaInstallController({
    onAvailabilityChange: ui.setPwaInstallAvailable,
    windowRef,
  });

  const hapticFeedback = setupFeedback(haptics, windowRef);
  const cameraController = createCameraController({
    camera,
    cameraEl: worldEl,
    game,
    intro,
    marble,
    tuning,
    viewport,
    mapState,
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
    mapState,
    kitchenDynamicsState: kitchenDynamics.state,
  });
  const { applyFullscreenSetting, applySettings } = createSettingsApplier({
    documentRef,
    exitFullscreen: (options) =>
      exitFullscreenMode({ ...options, documentRef }),
    haptics,
    physics,
    requestFullscreen: (options) =>
      requestFullscreenMode({
        ...options,
        documentRef,
        navigatorRef: windowRef.navigator,
        windowRef,
      }),
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

  function releaseMap() {
    intro.released = true;
    mapRenderer.openMap();
    introSequence.hideMessage();
    ui.setLevelLabel("");
    ui.setHint(copy.hints.mapOpen);
  }

  function setCurrentMap(nextMap) {
    mapRuntime.setActiveMap(nextMap);
    kitchenDynamics.reset({
      mapConfig: mapState.activeMap,
      obstacles: mapState.obstacles,
      waterPatches:
        mapState.terrainByType[MAP_ELEMENT_TYPES.waterPatch].elements,
      world: mapState.activeMap.world,
    });
    cameraController.invalidateWorldBounds();
    effectsRenderer.setWorld(mapState.activeMap.world);
    marbleView.setWorld(mapState.activeMap.world);
    mapRenderer.syncWorld();
    terrainView.renderTerrain();
    ui.setMapObjects(mapObjectSummary(mapState.activeMap));
  }

  function resetForNextMap() {
    marble.x = mapState.activeMap.spawn.x;
    marble.y = mapState.activeMap.spawn.y;
    marble.vx = 0;
    marble.vy = 0;
    marble.roll = 0;
    trailRenderer.clear();
    effectsRenderer.clear();
    cameraController.centerOnMarble();
  }

  const introSequence = createIntroSequence({
    intro,
    sequence: introSequenceState,
    game,
    timing,
    messageOverlay,
    clearTimeoutFn: (timer) => windowRef.clearTimeout(timer),
    createElement: (tag) => documentRef.createElement(tag),
    now: () => windowRef.performance.now(),
    onRelease: releaseMap,
    setTimeoutFn: (callback, delay) => windowRef.setTimeout(callback, delay),
  });
  const mapProgression = createMapProgression({
    baseMapConfig,
    getCurrentMap: () => mapState.activeMap,
    applyMap: (nextMap) => {
      setCurrentMap(nextMap);
      ui.setLevelLabel(intro.released ? "" : mapLevelLabel(nextMap));
    },
    resetForNextMap,
    terrainView,
    ui,
    copy: copy.hints,
    formatMapLabel: mapLevelLabel,
    mapLabelDurationMs: timing.mapLabelDurationMs,
    requestRender,
  });
  function retryCurrentMap() {
    mapRuntime.resetGoalProgress();
    terrainView.updateGoalProgress(0);
    resetForNextMap();
    ui.setLevelLabel("");
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

  const currentPhysicsContext = createCurrentPhysicsContext(state, mapState);
  const gameLoop = createGameLoop({
    activeMap: () => mapState.activeMap,
    cameraController,
    effectsRenderer,
    frameLoop,
    game,
    hapticFeedback,
    goalController,
    goalTarget: () => mapState.activeMap.goal,
    kitchenDynamics,
    marble,
    marbleView,
    perf: state.perf,
    physicsContext: currentPhysicsContext,
    resetGoalProgress: () => {
      mapRuntime.resetGoalProgress();
      terrainView.updateGoalProgress(0);
    },
    scheduleFrame,
    settings,
    spawnTarget: () => mapState.activeMap.spawn,
    terrainView,
    timing,
    tuning,
    trailRenderer,
    ui,
    visualConfig,
  });
  frameLoop.setTick(gameLoop.tick);

  let inputManager;
  const lifecycle = createLifecycleController({
    state,
    cameraController,
    effectsRenderer,
    frameLoop,
    introSequence,
    mapRenderer,
    resetMap: () => setCurrentMap(resolvedMapConfig),
    resetCalibration: sensorController.resetCalibration,
    scheduleFrame,
    sensorWatchdog,
    settings,
    timing,
    trailRenderer,
    ui,
    getSpawn: () => mapState.activeMap.spawn,
    enableMotion: () => inputManager.enableMotion(),
    requestFullscreen: (options) =>
      requestFullscreenMode({
        ...options,
        documentRef,
        navigatorRef: windowRef.navigator,
        windowRef,
      }),
    requestMotionPermission: () =>
      requestMotionPermissionIfNeeded({ windowRef }),
    keepDisplayAwake: () =>
      requestWakeLock({ documentRef, navigatorRef: windowRef.navigator }),
    resetFrameClock: gameLoop.resetClock,
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
    onInputReady: () => ui.setGameStatus(""),
  });
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
    defaults: settingsConfig,
    applyRangeConfig,
    applySettings,
    applyFullscreenSetting,
    saveSettings,
    onOpenSettings: gameController.openSettings,
    onCloseSettings: gameController.closeSettings,
    onInstallApp: pwaInstallController.promptInstall,
    onRetryMap: retryCurrentMap,
    onSetNeutral: sensorController.setNeutralNow,
    onFpsChanged: ui.setFpsEnabled,
    onHitboxOverlayChanged: terrainView.setHitboxOverlayEnabled,
    onStatsChanged: ui.setStatsEnabled,
    requestRender,
    fullscreenManagedByPwa,
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
    registerServiceWorker({
      navigatorRef: windowRef.navigator,
      onStatusChange: updatePwaStatus,
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

import {
  hapticTuning,
  resolvedMapConfig,
  timing,
  tuning,
  visualConfig
} from "./config.js";
import { copy } from "./copy.js";
import { createEffectsRenderer } from "../rendering/effects.js";
import { createHapticsController } from "./haptics.js";
import { createInputManager } from "../input/input-manager.js";
import {
  introPenWalls,
  mapEdgeWalls,
  setReleasedBounds as setReleasedMapBounds,
  updateIntroBounds as updateIntroMapBounds
} from "./map.js";
import { createMapRenderer } from "../rendering/map-renderer.js";
import { createMarbleView } from "../rendering/marble-view.js";
import {
  renderObstacleWalls,
  renderRoughPatches,
  renderWalls
} from "../rendering/rendering.js";
import { createSensorController } from "../input/sensor-controller.js";
import { createSensorWatchdog } from "../input/sensor-watchdog.js";
import { createTerrainView } from "../rendering/terrain-view.js";
import { createTrailRenderer } from "../rendering/trail.js";

export function setupRenderers({
  els,
  state,
  world,
  viewport,
  settings,
  clamp,
  obstacles,
  goal,
  roughPatches
}) {
  const {
    world: worldEl,
    introWalls: introWallsEl,
    mapWalls: mapWallsEl,
    roughPatches: roughPatchesEl,
    obstacles: obstaclesEl,
    goal: goalEl,
    trail: trailEl,
    trailSegments: trailSegmentsEl,
    effects: effectsEl,
    marble: marbleEl
  } = els;
  const { bounds, game, intro, marble } = state;
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
    mapConfig: resolvedMapConfig,
    visualConfig,
    clamp
  });
  const terrainView = createTerrainView({
    roughPatchesEl,
    obstaclesEl,
    goalEl,
    goal,
    roughPatches,
    obstacles,
    renderObstacleWalls,
    renderRoughPatches
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
    renderWalls,
    introPenWalls,
    mapEdgeWalls,
    setReleasedMapBounds,
    updateIntroMapBounds
  });

  return {
    effectsRenderer,
    mapRenderer,
    marbleView,
    terrainView,
    trailRenderer
  };
}

export function setupSensors({
  state,
  introSequence,
  scheduleFrame,
  ui,
  adjustScreen
}) {
  const {
    calibration,
    game,
    marble,
    sensor,
    tilt
  } = state;
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
    adjustScreen
  });

  return {
    sensorController,
    sensorWatchdog
  };
}

export function setupInput({
  els,
  sensorController,
  keyboardController,
  cameraController,
  gameController
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
    onStartClick: gameController.start
  });
}

export function setupFeedback(haptics) {
  return createHapticsController(haptics, hapticTuning);
}

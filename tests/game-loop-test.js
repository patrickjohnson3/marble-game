import assert from "node:assert/strict";
import {
  createGameLoop,
  elapsedMsToFrameDelta,
  updateFrameBudgetMetric,
} from "../core/game-loop.js";
import {
  hapticTuning,
  physicsConfig,
  timing,
  tuning,
  visualConfig,
} from "../core/game-config.js";
import { resolvedMapConfig } from "../core/map-config.js";
import { createMapRuntime } from "../core/map-runtime.js";
import { GAME_PHASES } from "../core/runtime-states.js";
import { createGameState } from "../core/state.js";

function testElapsedFrameDeltaUsesConfiguredClamp() {
  const timing = {
    targetFrameMs: 16.67,
    minFrameDelta: 0.25,
    maxFrameDelta: 2,
  };

  assert.equal(elapsedMsToFrameDelta(1, timing), timing.minFrameDelta);
  assert.equal(elapsedMsToFrameDelta(16.67, timing), 1);
  assert.equal(elapsedMsToFrameDelta(1000, timing), timing.maxFrameDelta);
}

testElapsedFrameDeltaUsesConfiguredClamp();

function testFrameBudgetMetricUsesRollingAverage() {
  const perf = {};

  updateFrameBudgetMetric(perf, "physicsMs", 10);
  updateFrameBudgetMetric(perf, "physicsMs", 20, 0.5);

  assert.equal(perf.physicsMs, 15);
}

testFrameBudgetMetricUsesRollingAverage();

function testActiveFrameRunsGameplayBeforeRendering() {
  const calls = [];
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig,
  });
  const mapState = createMapRuntime({ initialMap: resolvedMapConfig }).state;
  state.game.phase = GAME_PHASES.running;
  state.intro.released = true;
  const physicsContext = {
    bounds: state.bounds,
    camera: state.camera,
    game: state.game,
    intro: state.intro,
    keyboard: state.input.keyboard,
    marble: state.marble,
    obstacles: mapState.obstacles,
    physics: state.physics,
    terrainByType: mapState.terrainByType,
    tilt: state.input.tilt,
  };
  let currentTime = 0;
  const loop = createGameLoop({
    activeMap: () => mapState.activeMap,
    cameraController: {
      centerOnMarble() {},
      updateFollow() {
        calls.push("camera");
      },
    },
    effectsRenderer: {
      clear() {},
      render() {
        calls.push("effects");
      },
      spawnGooSplat() {},
      spawnImpact() {},
      spawnWaterRipple() {},
    },
    frameLoop: {
      beginFrame() {},
      markRendered() {},
      shouldSkipIdle: () => false,
    },
    game: state.game,
    hapticFeedback: {
      pulseImpact() {},
      pulseSurface() {},
    },
    goalController: {
      update() {
        calls.push("goal");
      },
    },
    kitchenDynamics: {
      state: {},
      update() {
        calls.push("kitchen");
        return {};
      },
    },
    marble: state.marble,
    marbleView: {
      render() {
        calls.push("marble");
      },
    },
    now: () => currentTime,
    perf: state.perf,
    physicsContext: () => physicsContext,
    scheduleFrame() {
      calls.push("schedule");
    },
    settings: { goalIndicatorEnabled: false },
    terrainView: {
      renderMapThemeDynamics() {
        calls.push("terrain");
      },
    },
    timing,
    tuning,
    trailRenderer: {
      clear() {},
      update() {
        calls.push("trail");
      },
    },
    ui: {
      setGoalIndicator() {},
      updateDebugPanel() {},
      updateFps() {},
    },
    visualConfig,
  });

  currentTime = timing.targetFrameMs;
  loop.tick();

  assert.deepEqual(calls, [
    "goal",
    "camera",
    "kitchen",
    "terrain",
    "marble",
    "trail",
    "effects",
    "schedule",
  ]);
}

testActiveFrameRunsGameplayBeforeRendering();

console.log("Game loop tests passed.");

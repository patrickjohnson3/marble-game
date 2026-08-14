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
import { copy } from "../core/copy.js";
import { resolvedMapConfig } from "../core/map-config.js";
import { createMapRuntime } from "../core/map-runtime.js";
import { SURFACE_TYPES } from "../core/physics.js";
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

function createBehaviorHarness({ activeMap, kitchenEvents = null }) {
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig,
  });
  const mapRuntime = createMapRuntime({ initialMap: activeMap });
  const calls = {
    centered: 0,
    effectClears: 0,
    effectImpacts: [],
    goalResets: 0,
    hapticImpacts: [],
    hapticSurfaces: [],
    hints: [],
    obstacleRenders: 0,
    terrainTypeRenders: [],
    trailClears: 0,
  };
  let currentTime = 0;

  state.game.phase = GAME_PHASES.running;
  state.intro.released = true;
  state.bounds.left = 0;
  state.bounds.right = activeMap.world.width;
  state.bounds.top = 0;
  state.bounds.bottom = activeMap.world.height;
  state.marble.x = activeMap.spawn.x;
  state.marble.y = activeMap.spawn.y;
  state.marble.r = activeMap.spawn.r;

  const physicsContext = {
    bounds: state.bounds,
    camera: state.camera,
    game: state.game,
    intro: state.intro,
    keyboard: state.input.keyboard,
    marble: state.marble,
    obstacles: mapRuntime.state.obstacles,
    physics: state.physics,
    terrainByType: mapRuntime.state.terrainByType,
    tilt: state.input.tilt,
  };
  const eventQueue = kitchenEvents ? [...kitchenEvents] : null;
  const loop = createGameLoop({
    activeMap: () => mapRuntime.state.activeMap,
    cameraController: {
      centerOnMarble() {
        calls.centered++;
      },
      updateFollow() {},
    },
    effectsRenderer: {
      clear() {
        calls.effectClears++;
      },
      render() {},
      spawnGooSplat() {},
      spawnImpact(impact) {
        calls.effectImpacts.push(impact);
      },
      spawnWaterRipple() {},
    },
    frameLoop: {
      beginFrame() {},
      markRendered() {},
      shouldSkipIdle: () => false,
    },
    game: state.game,
    hapticFeedback: {
      pulseImpact(impact) {
        calls.hapticImpacts.push(impact);
      },
      pulseSurface(speed, surfaceType) {
        calls.hapticSurfaces.push([speed, surfaceType]);
      },
    },
    goalController: { update() {} },
    goalTarget: () => mapRuntime.state.goal,
    kitchenDynamics: eventQueue
      ? {
          state: {},
          update() {
            return eventQueue.shift() ?? {};
          },
        }
      : null,
    marble: state.marble,
    marbleView: { render() {} },
    now: () => currentTime,
    perf: state.perf,
    physicsContext: () => physicsContext,
    resetGoalProgress() {
      calls.goalResets++;
    },
    scheduleFrame() {},
    settings: { goalIndicatorEnabled: false },
    spawnTarget: () => mapRuntime.state.spawn,
    terrainView: {
      renderMapThemeDynamics() {},
      renderMovedObstacles() {
        calls.obstacleRenders++;
      },
      renderTerrainType(type) {
        calls.terrainTypeRenders.push(type);
      },
    },
    timing,
    tuning,
    trailRenderer: {
      clear() {
        calls.trailClears++;
      },
      update() {},
    },
    ui: {
      setGoalIndicator() {},
      setHint(hint) {
        calls.hints.push(hint);
      },
      updateDebugPanel() {},
      updateFps() {},
    },
    visualConfig,
  });

  return {
    calls,
    mapRuntime,
    state,
    tick() {
      currentTime += timing.targetFrameMs;
      loop.tick();
    },
  };
}

function testHazardRecoveryResetsGameplayFeedbackAndRearms() {
  const activeMap = {
    ...resolvedMapConfig,
    world: { width: 400, height: 400 },
    spawn: { x: 50, y: 50, r: 8 },
    goal: { x: 350, y: 350, r: 30, holdMs: 5000 },
    elements: [{ type: "hazardPatch", x: 180, y: 180, w: 40, h: 40 }],
  };
  const harness = createBehaviorHarness({ activeMap });
  const { calls, state } = harness;
  state.marble.x = 200;
  state.marble.y = 200;
  state.marble.vx = 4;
  state.marble.vy = -3;
  state.marble.roll = 2;

  harness.tick();

  assert.deepEqual(
    {
      x: state.marble.x,
      y: state.marble.y,
      vx: state.marble.vx,
      vy: state.marble.vy,
      roll: state.marble.roll,
    },
    { x: 50, y: 50, vx: 0, vy: 0, roll: 0 },
  );
  assert.equal(calls.goalResets, 1);
  assert.equal(calls.trailClears, 1);
  assert.equal(calls.effectClears, 1);
  assert.deepEqual(calls.effectImpacts, [tuning.hazardResetImpactFeedback]);
  assert.deepEqual(calls.hapticImpacts, [tuning.hazardResetImpactFeedback]);
  assert.deepEqual(calls.hints, [copy.hints.hazardPatch]);
  assert.equal(calls.centered, 1);

  harness.tick();
  assert.equal(calls.goalResets, 1, "the hazard must remain disarmed at spawn");

  state.marble.x =
    activeMap.spawn.x +
    state.marble.r * tuning.hazardRearmDistanceMultiplier +
    1;
  harness.tick();
  state.marble.x = 200;
  state.marble.y = 200;
  harness.tick();
  assert.equal(calls.goalResets, 2, "leaving spawn must rearm the hazard");
}

function testKitchenFeedbackRoutesOnePriorityImpactPerFrame() {
  const activeMap = {
    ...resolvedMapConfig,
    world: { width: 400, height: 400 },
    spawn: { x: 200, y: 200, r: 8 },
    goal: { x: 350, y: 350, r: 30, holdMs: 5000 },
    elements: [],
  };
  const harness = createBehaviorHarness({
    activeMap,
    kitchenEvents: [
      { squishedAnts: 1, splatHits: 1, cerealHits: 1 },
      { splatHits: 1, cerealHits: 1 },
      { cerealHits: 1 },
    ],
  });

  harness.tick();
  harness.tick();
  harness.tick();

  assert.deepEqual(harness.calls.hapticImpacts, [
    tuning.antSquishImpactFeedback,
    tuning.antSplatImpactFeedback,
    tuning.cerealBumpImpactFeedback,
  ]);
}

function testSpongeAbsorptionRoutesFocusedRenderingAndFeedback() {
  const activeMap = {
    ...resolvedMapConfig,
    world: { width: 400, height: 400 },
    spawn: { x: 200, y: 200, r: 8 },
    goal: { x: 350, y: 350, r: 30, holdMs: 5000 },
    elements: [],
  };
  const harness = createBehaviorHarness({
    activeMap,
    kitchenEvents: [
      {
        spongeChanges: 1,
        spongeImpact: 3.2,
        spongeSoaks: 1,
        waterChanges: 1,
      },
    ],
  });

  harness.tick();

  assert.equal(harness.calls.obstacleRenders, 1);
  assert.deepEqual(harness.calls.terrainTypeRenders, [
    SURFACE_TYPES.waterPatch,
  ]);
  assert.deepEqual(harness.calls.hapticSurfaces, [
    [tuning.spongeSoakSurfaceFeedbackSpeed, SURFACE_TYPES.waterPatch],
  ]);
  assert.deepEqual(harness.calls.effectImpacts, [3.2]);
  assert.deepEqual(harness.calls.hapticImpacts, [3.2]);
}

testHazardRecoveryResetsGameplayFeedbackAndRearms();
testKitchenFeedbackRoutesOnePriorityImpactPerFrame();
testSpongeAbsorptionRoutesFocusedRenderingAndFeedback();

console.log("Game loop tests passed.");

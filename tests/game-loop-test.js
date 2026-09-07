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
    physics: state.physics,
    mapState,
    tilt: state.input.tilt,
  };
  let currentTime = 0;
  const loop = createGameLoop({
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
    mapState,
    marble: state.marble,
    marbleView: {
      render() {
        calls.push("marble");
      },
    },
    now: () => currentTime,
    perf: state.perf,
    physicsContext,
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
    "kitchen",
    "terrain",
    "goal",
    "camera",
    "marble",
    "trail",
    "effects",
    "schedule",
  ]);
}

testActiveFrameRunsGameplayBeforeRendering();

function createBehaviorHarness({
  activeMap,
  kitchenEvents = null,
  onGoalUpdate = () => {},
}) {
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
    antCrushes: [],
    effectImpacts: [],
    goalResets: 0,
    hapticImpacts: [],
    hapticSurfaces: [],
    hints: [],
    kitchenSweeps: [],
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
    physics: state.physics,
    mapState: mapRuntime.state,
    tilt: state.input.tilt,
  };
  const eventQueue = kitchenEvents ? [...kitchenEvents] : null;
  const loop = createGameLoop({
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
      spawnAntSquish(ant) {
        calls.antCrushes.push(ant);
      },
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
    goalController: {
      update() {
        onGoalUpdate(mapRuntime, state);
      },
    },
    kitchenDynamics: {
      state: {},
      update(map, marble, previous) {
        calls.kitchenSweeps.push({
          map,
          previous: { ...previous },
          current: { x: marble.x, y: marble.y },
        });
        return eventQueue?.shift() ?? {};
      },
    },
    mapState: mapRuntime.state,
    marble: state.marble,
    marbleView: { render() {} },
    now: () => currentTime,
    perf: state.perf,
    physicsContext,
    resetGoalProgress() {
      calls.goalResets++;
    },
    scheduleFrame() {},
    settings: { goalIndicatorEnabled: false },
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
  state.marble.vx = 30;
  state.marble.vy = -3;
  state.marble.roll = 2;
  state.input.keyboard.x = 1;

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
  assert.deepEqual(
    calls.kitchenSweeps[0].previous,
    { x: 50, y: 50 },
    "respawning must not sweep objects between the hazard and spawn",
  );
  assert.deepEqual(calls.kitchenSweeps[0].current, { x: 50, y: 50 });
  state.input.keyboard.x = 0;

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

function testMapTransitionDoesNotSweepAcrossTheNewMap() {
  const firstMap = {
    ...resolvedMapConfig,
    world: { width: 400, height: 400 },
    spawn: { x: 50, y: 50, r: 8 },
    goal: { x: 350, y: 350, r: 30, holdMs: 5000 },
    elements: [],
  };
  const nextMap = { ...firstMap, variantId: "next-map" };
  let advanced = false;
  const harness = createBehaviorHarness({
    activeMap: firstMap,
    onGoalUpdate(mapRuntime, state) {
      if (advanced) return;
      advanced = true;
      mapRuntime.setActiveMap(nextMap);
      Object.assign(state.marble, nextMap.spawn);
    },
  });
  harness.state.marble.x = 350;
  harness.state.marble.y = 350;
  harness.tick();
  const firstSweep = harness.calls.kitchenSweeps[0];
  assert.equal(firstSweep.map.variantId, firstMap.variantId);
  assert.deepEqual(firstSweep.previous, { x: 350, y: 350 });
  assert.deepEqual(firstSweep.current, firstSweep.previous);
  harness.tick();
  const nextSweep = harness.calls.kitchenSweeps[1];
  assert.equal(nextSweep.map.variantId, nextMap.variantId);
  assert.deepEqual(nextSweep.previous, { x: 50, y: 50 });
  assert.deepEqual(nextSweep.current, nextSweep.previous);
}

function testKitchenFeedbackRoutesOnePriorityImpactPerFrame() {
  const crushedAnt = { x: 190, y: 200, squished: true };
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
        squishedAnts: 1,
        antCrushes: [crushedAnt],
        splatHits: 1,
        cerealHits: 1,
      },
      { splatHits: 1, cerealHits: 1 },
      { cerealHits: 1 },
    ],
  });

  harness.tick();
  assert.ok(
    harness.state.marble.impactSquash > 0,
    "a fresh crush should visibly compress the marble",
  );
  harness.tick();
  harness.tick();

  assert.deepEqual(harness.calls.hapticImpacts, [
    tuning.antSquishImpactFeedback,
    tuning.antSplatImpactFeedback,
    tuning.cerealBumpImpactFeedback,
  ]);
  assert.deepEqual(
    harness.calls.antCrushes,
    [crushedAnt],
    "only fresh crushes should emit localized visual feedback",
  );
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
testMapTransitionDoesNotSweepAcrossTheNewMap();
testKitchenFeedbackRoutesOnePriorityImpactPerFrame();
testSpongeAbsorptionRoutesFocusedRenderingAndFeedback();

console.log("Game loop tests passed.");

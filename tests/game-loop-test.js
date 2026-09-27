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
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
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
  kitchenDynamics = null,
  onGoalUpdate = () => {},
  settings = { goalIndicatorEnabled: false },
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
    goalIndicators: [],
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
    kitchenDynamics: kitchenDynamics ?? {
      state: {},
      update(map, marble, previous, frameDelta, path) {
        calls.kitchenSweeps.push({
          path: path?.segments.slice(0, path.count).map((segment) => ({
            start: { ...segment.start },
            end: { ...segment.end },
          })),
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
    settings,
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
      setGoalIndicator(visible, angle, label) {
        calls.goalIndicators.push({ visible, angle, label });
      },
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
    tick(frameDelta = 1) {
      currentTime += timing.targetFrameMs * frameDelta;
      loop.tick();
    },
  };
}

function testGoalIndicatorUsesTheCurrentObjective() {
  const activeMap = {
    ...resolvedMapConfig,
    objective: { type: "reach", region: "door" },
    regions: [{ id: "door", x: 700, y: 100, w: 200, h: 200 }],
    world: { width: 1000, height: 1000 },
    spawn: { x: 100, y: 800, r: 10 },
    elements: [],
  };
  const { calls, mapRuntime, state, tick } = createBehaviorHarness({
    activeMap,
    settings: { goalIndicatorEnabled: true },
  });
  tick();
  assert.equal(calls.goalIndicators.at(-1).visible, true);
  assert.equal(calls.goalIndicators.at(-1).angle, Math.atan2(-600, 700));
  state.marble.x = 800;
  state.marble.y = 200;
  tick();
  assert.equal(calls.goalIndicators.at(-1).visible, false);

  mapRuntime.setActiveMap({
    ...activeMap,
    objective: { type: "eliminate", target: "ant", count: "all" },
  });
  state.marble.x = 100;
  state.marble.y = 800;
  tick();
  assert.equal(
    calls.goalIndicators.at(-1).visible,
    false,
    "ant hunting must not point toward a stale coordinate goal",
  );
}

testGoalIndicatorUsesTheCurrentObjective();

function createMouseIndicatorMap() {
  return {
    ...resolvedMapConfig,
    objective: { type: "reach", region: "door", defeat: "mouse" },
    regions: [
      { id: "door", x: 800, y: 0, w: 200, h: 200 },
      { id: "mouse-run", x: 0, y: 0, w: 1000, h: 1000 },
    ],
    mouse: { x: 800, y: 800, roamRegion: "mouse-run" },
    world: { width: 1000, height: 1000 },
    spawn: { x: 500, y: 500, r: 10 },
    elements: [],
  };
}

function testMouseHintAutomaticallyTracksTheLiveMouse() {
  const settings = { goalIndicatorEnabled: false };
  const { calls, mapRuntime, state, tick } = createBehaviorHarness({
    activeMap: createMouseIndicatorMap(),
    settings,
  });
  const mouse = mapRuntime.state.mouse;

  tick();
  assert.deepEqual(calls.goalIndicators.at(-1), {
    visible: true,
    angle: Math.atan2(mouse.y - state.marble.y, mouse.x - state.marble.x),
    label: "Mouse",
  });

  // Forced frames still refresh the bearing while paused. Translation and
  // uniform camera zoom cannot change a direction measured from the marble.
  state.game.paused = true;
  for (const [dx, dy, scale] of [
    [300, 300, 0.4],
    [-300, 300, 1],
    [-300, -300, 2],
    [300, -300, 0.75],
  ]) {
    mouse.x = state.marble.x + dx;
    mouse.y = state.marble.y + dy;
    state.camera.x = -123;
    state.camera.y = 456;
    state.camera.scale = scale;
    tick();
    assert.deepEqual(calls.goalIndicators.at(-1), {
      visible: true,
      angle: Math.atan2(dy, dx),
      label: "Mouse",
    });
  }
  assert.equal(
    settings.goalIndicatorEnabled,
    false,
    "the hint must not opt into other goal arrows",
  );
}

testMouseHintAutomaticallyTracksTheLiveMouse();

function testMouseHintHidesWithoutADistantReleasedLivingTarget() {
  const { calls, mapRuntime, state, tick } = createBehaviorHarness({
    activeMap: createMouseIndicatorMap(),
  });
  state.game.paused = true;
  tick();
  assert.equal(calls.goalIndicators.at(-1).visible, true);

  state.intro.released = false;
  tick();
  assert.equal(calls.goalIndicators.at(-1).visible, false);
  state.intro.released = true;

  mapRuntime.state.mouse.x = state.marble.x + 100;
  mapRuntime.state.mouse.y = state.marble.y;
  tick();
  assert.equal(
    calls.goalIndicators.at(-1).visible,
    false,
    "a nearby mouse needs no locating hint",
  );

  mapRuntime.state.mouse.x = 800;
  mapRuntime.state.mouse.y = 800;
  mapRuntime.state.mouse.health = 0;
  tick();
  assert.equal(
    calls.goalIndicators.at(-1).visible,
    false,
    "a defeated mouse must not remain a target",
  );

  mapRuntime.state.mouse = null;
  tick();
  assert.equal(
    calls.goalIndicators.at(-1).visible,
    false,
    "missing mouse state must not expose the locked exit",
  );
}

testMouseHintHidesWithoutADistantReleasedLivingTarget();

function testMouseHintRefreshesAfterRetryAndMapOrSettingChanges() {
  const activeMap = createMouseIndicatorMap();
  const settings = { goalIndicatorEnabled: false };
  const { calls, mapRuntime, state, tick } = createBehaviorHarness({
    activeMap,
    settings,
  });
  state.game.paused = true;
  tick();
  assert.equal(calls.goalIndicators.at(-1).label, "Mouse");

  mapRuntime.state.mouse.health = 0;
  tick();
  assert.equal(calls.goalIndicators.at(-1).visible, false);
  settings.goalIndicatorEnabled = true;
  tick();
  assert.deepEqual(calls.goalIndicators.at(-1), {
    visible: true,
    angle: Math.atan2(-400, 400),
    label: "",
  });

  // Retry recreates authoritative actor state; no hint state should survive it.
  mapRuntime.setActiveMap(activeMap);
  tick();
  assert.equal(calls.goalIndicators.at(-1).visible, true);
  assert.equal(calls.goalIndicators.at(-1).label, "Mouse");

  settings.goalIndicatorEnabled = false;
  mapRuntime.setActiveMap({
    ...activeMap,
    objective: { type: "reach", region: "door" },
  });
  tick();
  assert.equal(
    calls.goalIndicators.at(-1).visible,
    false,
    "a mouse without a defeat objective must not enable an automatic arrow",
  );

  settings.goalIndicatorEnabled = true;
  tick();
  assert.equal(calls.goalIndicators.at(-1).visible, true);
  assert.equal(calls.goalIndicators.at(-1).label, "");
  settings.goalIndicatorEnabled = false;
  tick();
  assert.equal(
    calls.goalIndicators.at(-1).visible,
    false,
    "paused setting changes clear the old goal arrow",
  );

  settings.goalIndicatorEnabled = true;
  mapRuntime.setActiveMap({
    ...activeMap,
    objective: { type: "eliminate", target: "ant", count: "all" },
    mouse: undefined,
  });
  tick();
  assert.equal(
    calls.goalIndicators.at(-1).visible,
    false,
    "kitchen elimination must not retain the mouse or exit hint",
  );
}

testMouseHintRefreshesAfterRetryAndMapOrSettingChanges();

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
  assert.deepEqual(
    calls.kitchenSweeps[0].path,
    [],
    "hazards must discard the movement path",
  );
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

function testGameLoopForwardsReboundSegmentsAndClearsPreviousFrames() {
  const activeMap = {
    ...resolvedMapConfig,
    world: { width: 1000, height: 1000 },
    spawn: { x: 160, y: 500, r: 29 },
    cockroach: null,
    elements: [{ type: "obstacle", x: 200, y: 0, w: 20, h: 1000 }],
  };
  const harness = createBehaviorHarness({ activeMap });
  harness.state.marble.vx = 14;
  harness.tick(2);
  const first = harness.calls.kitchenSweeps[0];
  assert.ok(first.path.some((segment) => segment.end.x === 171));
  assert.ok(first.current.x < 168);
  Object.assign(harness.state.marble, { x: 500, y: 700, vx: 0, vy: 0 });
  harness.tick();
  assert.deepEqual(harness.calls.kitchenSweeps[1].path, [
    { start: { x: 500, y: 700 }, end: { x: 500, y: 700 } },
  ]);
}

testGameLoopForwardsReboundSegmentsAndClearsPreviousFrames();

function testSpongeCannotPushMarbleBeyondWorldBounds() {
  for (const moving of [true, false]) {
    const kitchenDynamics = createKitchenDynamics();
    function assertInBounds(state) {
      const { marble, bounds } = state;
      assert.ok(marble.x >= bounds.left + marble.r);
      assert.ok(marble.x <= bounds.right - marble.r);
      assert.ok(marble.y >= bounds.top + marble.r);
      assert.ok(
        marble.y <= bounds.bottom - marble.r,
        `sponge left marble outside world at y=${marble.y}`,
      );
    }
    const harness = createBehaviorHarness({
      activeMap: resolvedMapConfig,
      kitchenDynamics,
      onGoalUpdate(_runtime, state) {
        assertInBounds(state);
      },
    });
    const runtime = harness.mapRuntime.state;
    kitchenDynamics.reset({
      mapConfig: runtime.activeMap,
      obstacles: runtime.obstacles,
      waterPatches: runtime.terrainByType.waterPatch.elements,
      world: runtime.activeMap.world,
    });
    const sponge = kitchenDynamics.state.sponge;
    const angle = moving ? 0.71 : 0;
    Object.assign(sponge, {
      y: 4260,
      angle,
      collisionCenterY: 4330,
      collisionCos: Math.cos(angle),
      collisionSin: Math.sin(angle),
    });
    Object.assign(harness.state.marble, {
      x: sponge.collisionCenterX - (moving ? 200 : 0),
      y: 4371,
      r: 29,
      vx: moving ? 14 : 0,
      vy: 0,
    });
    harness.state.input.keyboard.x = moving ? 1 : 0;
    harness.state.input.tilt.smoothX = moving ? 18 : 0;
    for (let frame = 0; frame < 30; frame++) {
      harness.tick();
      assertInBounds(harness.state);
    }
  }
}

testSpongeCannotPushMarbleBeyondWorldBounds();

console.log("Game loop tests passed.");

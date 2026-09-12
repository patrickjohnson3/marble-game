import assert from "node:assert/strict";
import {
  createGoalController,
  goalHoldHint,
  goalHoldMultiplier,
} from "../core/goal-controller.js";
import { createMapProgression } from "../core/map-progression.js";
import { createMapRuntime } from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { baseMapConfig } from "../core/map-config.js";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
import {
  getObjectiveRegion,
  livingAntCount,
  marbleInsideRegion,
} from "../core/map-objectives.js";

const goal = { x: 100, y: 100, r: 50 };
const marble = { x: 100, y: 100, r: 10 };

assert.equal(goalHoldMultiplier(marble, goal), 2);

assert.equal(goalHoldMultiplier({ ...marble, x: 140 }, goal), 1);

const halfway = goalHoldMultiplier({ ...marble, x: 120 }, goal);
assert.equal(halfway, 1.5);

assert.equal(goalHoldHint(2500, 1), "hold steady: 3s");
assert.equal(goalHoldHint(2500, 1.5), "hold center: 3s");
assert.equal(goalHoldHint(0, 2), "hold center: 1s");

function testGoalHoldResetAndMapProgression() {
  const baseMapConfig = {
    world: { width: 300, height: 300 },
    spawn: { x: 20, y: 20, r: 5 },
    variants: [
      {
        id: "first",
        difficulty: 2,
        world: { width: 300, height: 300 },
        spawn: { x: 20, y: 20, r: 5 },
        goal: { x: 100, y: 100, r: 30, holdMs: 100 },
        elements: [],
      },
      {
        id: "second",
        difficulty: 2,
        world: { width: 500, height: 400 },
        spawn: { x: 40, y: 50, r: 6 },
        goal: { x: 450, y: 350, r: 35, holdMs: 200 },
        elements: [],
      },
    ],
  };
  const firstMap = resolveMapVariantConfig(baseMapConfig, "first");
  const mapRuntime = createMapRuntime({ initialMap: firstMap });
  const marble = { ...firstMap.spawn };
  const intro = { released: false };
  const calls = {
    completedMaps: [],
    effects: 0,
    effectPositions: [],
    haptics: [],
    hints: [],
    progress: [],
    renders: 0,
    resets: 0,
  };
  const terrainView = {
    updateGoalProgress(progress) {
      calls.progress.push(progress);
    },
  };
  const ui = {
    setHint(hint) {
      calls.hints.push(hint);
    },
  };
  const mapProgression = createMapProgression({
    baseMapConfig,
    getCurrentMap: () => mapRuntime.state.activeMap,
    applyMap: (nextMap) => mapRuntime.setActiveMap(nextMap),
    resetForNextMap() {
      calls.resets++;
      calls.effects = 0;
      marble.x = mapRuntime.state.activeMap.spawn.x;
      marble.y = mapRuntime.state.activeMap.spawn.y;
      marble.r = mapRuntime.state.activeMap.spawn.r;
    },
    terrainView,
    ui,
    requestRender() {
      calls.renders++;
    },
  });
  const controller = createGoalController({
    copy: { mapOpen: "map open." },
    effectsRenderer: {
      spawnGoalComplete() {
        calls.effects++;
        calls.effectPositions.push({ x: marble.x, y: marble.y });
      },
    },
    hapticFeedback: {
      pulseGoal(kind) {
        calls.haptics.push(kind);
      },
    },
    intro,
    mapProgression,
    mapRuntime,
    marble,
    onComplete(map) {
      calls.completedMaps.push(map.variantId);
    },
    terrainView,
    timing: { targetFrameMs: 10 },
    ui,
  });

  marble.x = 100;
  marble.y = 100;
  controller.update(1);
  assert.equal(mapRuntime.state.goalHoldMs, 0, "the closed map gates goals");

  intro.released = true;
  marble.x = 120;
  controller.update(1);
  assert.equal(mapRuntime.state.goalHoldMs > 0, true);
  assert.equal(mapRuntime.state.goalCompleted, false);

  marble.x = 140;
  controller.update(1);
  assert.equal(mapRuntime.state.goalHoldMs, 0, "leaving must clear the hold");
  assert.equal(calls.progress.at(-1), 0);
  assert.equal(calls.hints.at(-1), "map open.");

  marble.x = 100;
  marble.y = 100;
  for (let frame = 0; frame < 5; frame++) controller.update(1);

  assert.equal(mapRuntime.state.activeMap.variantId, "second");
  assert.equal(mapRuntime.state.goalHoldMs, 0);
  assert.equal(mapRuntime.state.goalCompleted, false);
  assert.deepEqual(
    { x: marble.x, y: marble.y, r: marble.r },
    baseMapConfig.variants[1].spawn,
  );
  assert.deepEqual(calls.completedMaps, ["first"]);
  assert.equal(calls.effects, 1);
  assert.deepEqual(
    calls.effectPositions,
    [{ x: 40, y: 50 }],
    "completion particles must survive map reset and appear at the arrival position",
  );
  assert.equal(calls.resets, 1);
  assert.equal(calls.renders, 1);
  assert.equal(calls.haptics.includes("complete"), true);

  controller.update(1);
  assert.deepEqual(calls.completedMaps, ["first"]);
  assert.equal(calls.effects, 1);
}

function testRetryRestoresTheCurrentKitchen() {
  const sourceMap = resolveMapVariantConfig(baseMapConfig, "kitchen-floor");
  const sourceSnapshot = JSON.stringify(sourceMap);
  const mapRuntime = createMapRuntime({ initialMap: sourceMap });
  const kitchen = createKitchenDynamics();
  const marble = { ...sourceMap.spawn, vx: 0, vy: 0 };
  let renders = 0;
  function applyMap(map) {
    const state = mapRuntime.setActiveMap(map);
    kitchen.reset({
      mapConfig: state.activeMap,
      obstacles: state.obstacles,
      waterPatches: state.terrainByType.waterPatch.elements,
      world: state.activeMap.world,
    });
  }
  applyMap(sourceMap);
  const initialWater = { ...kitchen.state.waterPatch };
  const initialSponge = { ...kitchen.state.sponge };
  const initialCereal = { ...kitchen.state.cheerios[0] };
  const initialAnt = { ...kitchen.state.ants[0] };
  const oldActiveMap = mapRuntime.state.activeMap;
  kitchen.state.waterPatch.w /= 2;
  kitchen.state.sponge.x += 120;
  kitchen.state.sponge.saturation = 0.8;
  kitchen.state.cheerios[0].pushX = 200;
  kitchen.state.cheerios[0].active = false;
  kitchen.state.cheerios[0].eaten = 1;
  kitchen.state.ants[0].alive = false;
  mapRuntime.addGoalHold(1000);
  mapRuntime.completeGoal();
  marble.x += 200;
  marble.vx = 10;
  const progression = createMapProgression({
    baseMapConfig,
    getCurrentMap: () => mapRuntime.state.activeMap,
    applyMap,
    resetForNextMap() {
      Object.assign(marble, mapRuntime.state.activeMap.spawn, { vx: 0, vy: 0 });
    },
    terrainView: { updateGoalProgress() {} },
    ui: { setHint() {} },
    requestRender() {
      renders++;
    },
  });
  progression.retryCurrentMap();
  assert.notEqual(mapRuntime.state.activeMap, oldActiveMap);
  assert.equal(mapRuntime.state.activeMap.variantId, "kitchen-floor");
  assert.deepEqual(kitchen.state.waterPatch, initialWater);
  assert.deepEqual(kitchen.state.sponge, initialSponge);
  assert.deepEqual(kitchen.state.cheerios[0], initialCereal);
  assert.deepEqual(kitchen.state.ants[0], initialAnt);
  assert.deepEqual(marble, { ...sourceMap.spawn, vx: 0, vy: 0 });
  assert.equal(mapRuntime.state.goalHoldMs, 0);
  assert.equal(mapRuntime.state.goalCompleted, false);
  assert.equal(JSON.stringify(sourceMap), sourceSnapshot);
  assert.equal(renders, 1);
}

testGoalHoldResetAndMapProgression();
testRetryRestoresTheCurrentKitchen();

function objectiveHarness(sourceMap, nextMap = null) {
  const runtime = createMapRuntime({ initialMap: sourceMap });
  const kitchen = createKitchenDynamics();
  const marble = { ...sourceMap.spawn, vx: 0, vy: 0 };
  const intro = { released: true };
  const calls = { completed: [], advances: 0, effects: 0, statuses: [] };
  function applyMap(map) {
    runtime.setActiveMap(map);
    kitchen.reset({
      mapConfig: runtime.state.activeMap,
      obstacles: runtime.state.obstacles,
      waterPatches: runtime.state.terrainByType.waterPatch.elements,
      world: runtime.state.activeMap.world,
    });
  }
  function resetForNextMap() {
    Object.assign(marble, runtime.state.activeMap.spawn, { vx: 0, vy: 0 });
  }
  applyMap(sourceMap);
  const controller = createGoalController({
    copy: { mapOpen: "" },
    effectsRenderer: {
      spawnGoalComplete() {
        calls.effects++;
      },
    },
    hapticFeedback: { pulseGoal() {} },
    intro,
    kitchenState: kitchen.state,
    mapRuntime: runtime,
    mapProgression: {
      advanceToNextMap() {
        calls.advances++;
        if (!nextMap) return false;
        applyMap(nextMap);
        resetForNextMap();
        return true;
      },
    },
    marble,
    onComplete(map) {
      calls.completed.push(map.variantId);
      assert.equal(runtime.state.goalCompleted, true, "latch before callbacks");
    },
    terrainView: { updateGoalProgress() {} },
    timing: { targetFrameMs: 1000 / 60 },
    ui: {
      setHint() {},
      setObjectiveStatus(status) {
        calls.statuses.push(status);
      },
    },
  });
  return {
    applyMap,
    calls,
    controller,
    intro,
    kitchen,
    marble,
    resetForNextMap,
    runtime,
  };
}

const kitchenObjectiveMap = {
  ...resolveMapVariantConfig(baseMapConfig, "kitchen-floor"),
  objective: { type: "eliminate", target: "ant", count: "all" },
  goal: null,
};
const reachObjectiveMap = {
  variantId: "living-test",
  world: { width: 500, height: 500 },
  spawn: { x: 50, y: 450, r: 10 },
  objective: { type: "reach", region: "exit-door" },
  regions: [{ id: "exit-door", x: 350, y: 20, w: 100, h: 100 }],
  elements: [],
};

function testEliminationUsesActualCrushStateAndCompletesOnce() {
  const { calls, controller, kitchen, marble, runtime } = objectiveHarness(
    kitchenObjectiveMap,
    reachObjectiveMap,
  );
  assert.equal(kitchen.state.ants.length > 0, true);
  controller.update(1);
  assert.equal(calls.completed.length, 0);
  assert.equal(calls.statuses.at(-1), "Kill all ants · 10 left");

  while (kitchen.state.ants.some((ant) => ant.alive)) {
    const ant = kitchen.state.ants.find((candidate) => candidate.alive);
    marble.x = ant.x;
    marble.y = ant.y;
    marble.vx = 6;
    const events = kitchen.update(
      runtime.state.activeMap,
      marble,
      { x: marble.x - 6, y: marble.y },
      1,
    );
    assert.equal(
      events.squishedAnts > 0,
      true,
      "use the real crush interaction",
    );
    const remaining = livingAntCount(kitchen.state.ants);
    controller.update(1);
    if (remaining > 0) {
      assert.equal(
        calls.completed.length,
        0,
        "any surviving ant blocks completion",
      );
      assert.equal(
        calls.statuses.at(-1),
        "Kill all ants · " + remaining + " left",
      );
    } else {
      assert.deepEqual(calls.completed, ["kitchen-floor"]);
      break;
    }
  }
  assert.equal(runtime.state.activeMap.variantId, "living-test");
  assert.equal(calls.advances, 1);
  assert.equal(calls.effects, 1);
  assert.equal(
    kitchen.state.ants.length,
    0,
    "new room resets kitchen dynamics",
  );
  assert.equal(calls.statuses.at(-1), "Reach the exit doorway");
  controller.update(1);
  assert.equal(
    calls.completed.length,
    1,
    "old final-ant state cannot complete the next map",
  );
}

function testEliminationRetryAndMissingSuccessor() {
  const harness = objectiveHarness(kitchenObjectiveMap);
  const {
    applyMap,
    calls,
    controller,
    intro,
    kitchen,
    resetForNextMap,
    runtime,
  } = harness;
  // Unrelated live objects and consumed food cannot keep an ant objective open.
  kitchen.state.cheerios[0].active = false;
  for (const ant of kitchen.state.ants) ant.alive = false;
  intro.released = false;
  controller.update(1);
  assert.equal(calls.completed.length, 0, "intro still gates completion");
  intro.released = true;
  controller.update(1);
  controller.update(1);
  assert.equal(calls.completed.length, 1);
  assert.equal(
    calls.advances,
    1,
    "a failed advance must not complete every frame",
  );
  assert.equal(runtime.state.goalCompleted, true);

  const progression = createMapProgression({
    baseMapConfig: {
      variants: [{ ...kitchenObjectiveMap, id: "kitchen-floor" }],
    },
    getCurrentMap: () => runtime.state.activeMap,
    applyMap,
    resetForNextMap,
    terrainView: { updateGoalProgress() {} },
    ui: { setHint() {} },
    requestRender() {},
  });
  progression.retryCurrentMap();
  assert.equal(runtime.state.goalCompleted, false);
  assert.equal(livingAntCount(kitchen.state.ants), 10);
  controller.update(1);
  assert.equal(calls.completed.length, 1, "Retry must restore living targets");
  assert.equal(calls.statuses.at(-1), "Kill all ants · 10 left");
  for (const ant of kitchen.state.ants) ant.alive = false;
  controller.update(1);
  assert.equal(calls.completed.length, 2, "a new run can complete again");
}

function testReachRequiresTheDeclaredRegionAndResets() {
  const { applyMap, calls, controller, intro, marble, runtime } =
    objectiveHarness(reachObjectiveMap);
  const region = getObjectiveRegion(runtime.state.activeMap);
  assert.equal(marbleInsideRegion(marble, region), false);
  controller.update(1);
  assert.equal(calls.completed.length, 0);

  // Center entry alone is insufficient: the whole marble must cross the edge.
  marble.x = region.x + marble.r - 0.01;
  marble.y = region.y + region.h / 2;
  controller.update(1);
  assert.equal(calls.completed.length, 0);
  marble.x += 0.01;
  intro.released = false;
  controller.update(1);
  assert.equal(calls.completed.length, 0);
  intro.released = true;
  controller.update(1);
  controller.update(1);
  assert.deepEqual(calls.completed, ["living-test"]);
  assert.equal(
    runtime.state.goalHoldMs,
    0,
    "reach objectives do not inherit hold timers",
  );
  assert.equal(calls.effects, 1);

  applyMap(reachObjectiveMap);
  Object.assign(marble, reachObjectiveMap.spawn);
  controller.update(1);
  assert.equal(calls.completed.length, 1);
  assert.equal(runtime.state.goalCompleted, false);
  marble.x = 400;
  marble.y = 70;
  controller.update(1);
  assert.equal(calls.completed.length, 2);

  assert.throws(
    () => getObjectiveRegion({ ...reachObjectiveMap, regions: [] }),
    /Unknown objective region: exit-door/,
  );
  assert.throws(
    () => getObjectiveRegion({ objective: { type: "unknown" } }),
    /Unknown objective type/,
  );
}

testEliminationUsesActualCrushStateAndCompletesOnce();
testEliminationRetryAndMissingSuccessor();
testReachRequiresTheDeclaredRegionAndResets();

console.log("Goal controller tests passed.");

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

console.log("Goal controller tests passed.");

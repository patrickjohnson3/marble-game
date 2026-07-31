import assert from "node:assert/strict";
import {
  createMapRuntime,
  createResolvedMapState,
} from "../core/map-runtime.js";

function terrain(state, type) {
  return state.terrainByType[type];
}

const firstMap = {
  variantId: "first",
  goal: { x: 100, y: 120, r: 40, holdMs: 5000 },
  spawn: { x: 80, y: 90, r: 12 },
  elements: [
    { type: "obstacle", x: 10, y: 20, w: 30, h: 40 },
    { type: "gooPatch", x: 5, y: 6, w: 15, h: 18 },
    { type: "hazardPatch", x: 30, y: 45, w: 25, h: 35 },
    { type: "icePatch", x: 80, y: 90, w: 50, h: 60 },
    { type: "roughPatch", x: 50, y: 60, w: 70, h: 80 },
    { type: "waterPatch", x: 130, y: 140, w: 90, h: 100 },
  ],
};

const secondMap = {
  variantId: "second",
  goal: { x: 300, y: 320, r: 60, holdMs: 4000 },
  spawn: { x: 140, y: 150, r: 12 },
  elements: [
    { type: "obstacle", x: 110, y: 120, w: 130, h: 40 },
    { type: "obstacle", x: 210, y: 220, w: 30, h: 140 },
  ],
};

const runtime = createMapRuntime({ initialMap: firstMap });
const resolvedFirstMap = createResolvedMapState(firstMap);

assert.equal(resolvedFirstMap.activeMap, firstMap);
assert.equal(resolvedFirstMap.goal, firstMap.goal);
assert.equal(resolvedFirstMap.spawn, firstMap.spawn);
assert.equal(terrain(resolvedFirstMap, "gooPatch").elements.length, 1);
assert.deepEqual(terrain(resolvedFirstMap, "gooPatch").bounds, {
  bottom: 24,
  height: 18,
  left: 5,
  right: 20,
  top: 6,
  width: 15,
});
assert.equal(terrain(resolvedFirstMap, "hazardPatch").elements.length, 1);
assert.deepEqual(terrain(resolvedFirstMap, "hazardPatch").bounds, {
  bottom: 80,
  height: 35,
  left: 30,
  right: 55,
  top: 45,
  width: 25,
});
assert.equal(terrain(resolvedFirstMap, "icePatch").elements.length, 1);
assert.deepEqual(terrain(resolvedFirstMap, "icePatch").bounds, {
  bottom: 150,
  height: 60,
  left: 80,
  right: 130,
  top: 90,
  width: 50,
});
assert.equal(resolvedFirstMap.obstacles.length, 1);
assert.deepEqual(resolvedFirstMap.obstacleBounds, {
  bottom: 60,
  height: 40,
  left: 10,
  right: 40,
  top: 20,
  width: 30,
});
assert.equal(terrain(resolvedFirstMap, "roughPatch").elements.length, 1);
assert.deepEqual(terrain(resolvedFirstMap, "roughPatch").bounds, {
  bottom: 140,
  height: 80,
  left: 50,
  right: 120,
  top: 60,
  width: 70,
});
assert.equal(terrain(resolvedFirstMap, "waterPatch").elements.length, 1);
assert.deepEqual(terrain(resolvedFirstMap, "waterPatch").bounds, {
  bottom: 240,
  height: 100,
  left: 130,
  right: 220,
  top: 140,
  width: 90,
});

assert.equal(runtime.state.activeMap, firstMap);
assert.equal(runtime.state.goal, firstMap.goal);
assert.equal(runtime.state.spawn, firstMap.spawn);
assert.equal(terrain(runtime.state, "gooPatch").elements.length, 1);
assert.equal(terrain(runtime.state, "hazardPatch").elements.length, 1);
assert.equal(terrain(runtime.state, "icePatch").elements.length, 1);
assert.equal(runtime.state.obstacles.length, 1);
assert.equal(terrain(runtime.state, "roughPatch").elements.length, 1);
assert.equal(terrain(runtime.state, "waterPatch").elements.length, 1);

assert.equal(runtime.addGoalHold(1000), 0.2);
runtime.completeGoal();
assert.equal(runtime.state.goalCompleted, true);
runtime.setActiveMap(secondMap);

assert.equal(runtime.state.activeMap, secondMap);
assert.equal(runtime.state.goal, secondMap.goal);
assert.equal(runtime.state.spawn, secondMap.spawn);
assert.equal(runtime.state.obstacles.length, 2);
assert.deepEqual(runtime.state.obstacleBounds, {
  bottom: 360,
  height: 240,
  left: 110,
  right: 240,
  top: 120,
  width: 130,
});
assert.deepEqual(terrain(runtime.state, "roughPatch").elements, []);
assert.equal(terrain(runtime.state, "roughPatch").bounds, null);
assert.deepEqual(terrain(runtime.state, "gooPatch").elements, []);
assert.equal(terrain(runtime.state, "gooPatch").bounds, null);
assert.deepEqual(terrain(runtime.state, "hazardPatch").elements, []);
assert.equal(terrain(runtime.state, "hazardPatch").bounds, null);
assert.deepEqual(terrain(runtime.state, "icePatch").elements, []);
assert.equal(terrain(runtime.state, "icePatch").bounds, null);
assert.deepEqual(terrain(runtime.state, "waterPatch").elements, []);
assert.equal(terrain(runtime.state, "waterPatch").bounds, null);
assert.equal(runtime.state.goalHoldMs, 0);
assert.equal(runtime.state.goalCompleted, false);

runtime.addGoalHold(5000);
assert.equal(runtime.state.goalHoldMs, secondMap.goal.holdMs);
assert.equal(runtime.addGoalHold(5000), 1);
runtime.completeGoal();
runtime.clearGoalCompleted();
assert.equal(runtime.state.goalCompleted, false);

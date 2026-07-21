import assert from "node:assert/strict";
import {
  createMapRuntime,
  createResolvedMapState,
} from "../core/map-runtime.js";

const firstMap = {
  variantId: "first",
  goal: { x: 100, y: 120, r: 40, holdMs: 5000 },
  spawn: { x: 80, y: 90, r: 12 },
  elements: [
    { type: "obstacle", x: 10, y: 20, w: 30, h: 40 },
    { type: "icePatch", x: 80, y: 90, w: 50, h: 60 },
    { type: "roughPatch", x: 50, y: 60, w: 70, h: 80 },
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
assert.equal(resolvedFirstMap.icePatches.length, 1);
assert.deepEqual(resolvedFirstMap.icePatchBounds, {
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
assert.equal(resolvedFirstMap.roughPatches.length, 1);
assert.deepEqual(resolvedFirstMap.roughPatchBounds, {
  bottom: 140,
  height: 80,
  left: 50,
  right: 120,
  top: 60,
  width: 70,
});

assert.equal(runtime.state.activeMap, firstMap);
assert.equal(runtime.state.goal, firstMap.goal);
assert.equal(runtime.state.spawn, firstMap.spawn);
assert.equal(runtime.state.icePatches.length, 1);
assert.equal(runtime.state.obstacles.length, 1);
assert.equal(runtime.state.roughPatches.length, 1);

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
assert.deepEqual(runtime.state.roughPatches, []);
assert.equal(runtime.state.roughPatchBounds, null);
assert.deepEqual(runtime.state.icePatches, []);
assert.equal(runtime.state.icePatchBounds, null);
assert.equal(runtime.state.goalHoldMs, 0);
assert.equal(runtime.state.goalCompleted, false);

runtime.addGoalHold(5000);
assert.equal(runtime.state.goalHoldMs, secondMap.goal.holdMs);
assert.equal(runtime.addGoalHold(5000), 1);
runtime.completeGoal();
runtime.clearGoalCompleted();
assert.equal(runtime.state.goalCompleted, false);
assert.equal(runtime.currentRunMs(2000), null);
runtime.startRun(1250);
assert.equal(runtime.currentRunMs(2000), 750);

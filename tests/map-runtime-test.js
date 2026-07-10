import assert from "node:assert/strict";
import { createMapRuntime } from "../core/map-runtime.js";

const firstMap = {
  variantId: "first",
  goal: { x: 100, y: 120, r: 40, holdMs: 5000 },
  elements: [
    { type: "obstacle", x: 10, y: 20, w: 30, h: 40 },
    { type: "roughPatch", x: 50, y: 60, w: 70, h: 80 }
  ]
};

const secondMap = {
  variantId: "second",
  goal: { x: 300, y: 320, r: 60, holdMs: 4000 },
  elements: [
    { type: "obstacle", x: 110, y: 120, w: 130, h: 40 },
    { type: "obstacle", x: 210, y: 220, w: 30, h: 140 }
  ]
};

const runtime = createMapRuntime({ initialMap: firstMap });

assert.equal(runtime.state.activeMap, firstMap);
assert.equal(runtime.state.goal, firstMap.goal);
assert.equal(runtime.state.obstacles.length, 1);
assert.equal(runtime.state.roughPatches.length, 1);

assert.equal(runtime.addGoalHold(1000), 0.2);
runtime.completeGoal();
assert.equal(runtime.state.goalCompleted, true);
runtime.setActiveMap(secondMap);

assert.equal(runtime.state.activeMap, secondMap);
assert.equal(runtime.state.goal, secondMap.goal);
assert.equal(runtime.state.obstacles.length, 2);
assert.deepEqual(runtime.state.roughPatches, []);
assert.equal(runtime.state.goalHoldMs, 0);
assert.equal(runtime.state.goalCompleted, false);

runtime.addGoalHold(5000);
assert.equal(runtime.state.goalHoldMs, secondMap.goal.holdMs);
assert.equal(runtime.addGoalHold(5000), 1);
runtime.completeGoal();
runtime.clearGoalCompleted();
assert.equal(runtime.state.goalCompleted, false);

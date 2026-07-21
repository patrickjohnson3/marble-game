import assert from "node:assert/strict";
import { goalHoldHint, goalHoldMultiplier } from "../core/goal-controller.js";

const goal = { x: 100, y: 100, r: 50 };
const marble = { x: 100, y: 100, r: 10 };

assert.equal(goalHoldMultiplier(marble, goal), 2);

assert.equal(goalHoldMultiplier({ ...marble, x: 140 }, goal), 1);

const halfway = goalHoldMultiplier({ ...marble, x: 120 }, goal);
assert.equal(halfway, 1.5);

assert.equal(goalHoldHint(2500, 1), "hold steady: 3s");
assert.equal(goalHoldHint(2500, 1.5), "hold center: 3s");
assert.equal(goalHoldHint(0, 2), "hold center: 1s");

console.log("Goal controller tests passed.");

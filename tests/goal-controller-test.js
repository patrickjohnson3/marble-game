import assert from "node:assert/strict";
import {
  createGoalController,
  goalHoldHint,
  goalHoldMultiplier,
} from "../core/goal-controller.js";

const goal = { x: 100, y: 100, r: 50 };
const marble = { x: 100, y: 100, r: 10 };

assert.equal(goalHoldMultiplier(marble, goal), 2);

assert.equal(goalHoldMultiplier({ ...marble, x: 140 }, goal), 1);

const halfway = goalHoldMultiplier({ ...marble, x: 120 }, goal);
assert.equal(halfway, 1.5);

assert.equal(goalHoldHint(2500, 1), "hold steady: 3s");
assert.equal(goalHoldHint(2500, 1.5), "hold center: 3s");
assert.equal(goalHoldHint(0, 2), "hold center: 1s");

function testGoalCompletionAdvancesMapOnce() {
  const calls = [];
  const mapState = {
    activeMap: { id: "current" },
    goal: { x: 100, y: 100, r: 50, holdMs: 20 },
    goalCompleted: false,
    goalHoldMs: 0,
  };
  const mapRuntime = {
    state: mapState,
    addGoalHold(ms) {
      mapState.goalHoldMs = Math.min(
        mapState.goal.holdMs,
        mapState.goalHoldMs + ms,
      );
      return mapState.goalHoldMs / mapState.goal.holdMs;
    },
    clearGoalCompleted() {
      mapState.goalCompleted = false;
    },
    completeGoal() {
      mapState.goalCompleted = true;
    },
    resetGoalProgress() {
      mapState.goalCompleted = false;
      mapState.goalHoldMs = 0;
    },
  };
  const controller = createGoalController({
    copy: { mapOpen: "map open." },
    effectsRenderer: {
      spawnGoalComplete() {
        calls.push("effect");
      },
    },
    hapticFeedback: {
      pulseGoal(kind) {
        calls.push("haptic:" + kind);
      },
    },
    intro: { released: true },
    mapProgression: {
      advanceToNextMap() {
        calls.push("advance");
        return true;
      },
    },
    mapRuntime,
    marble: { x: 100, y: 100, r: 10 },
    onComplete(map) {
      calls.push("complete:" + map.id);
    },
    terrainView: { updateGoalProgress() {} },
    timing: { targetFrameMs: 16.67 },
    ui: { setHint() {} },
  });

  controller.update(1);

  assert.equal(mapState.goalCompleted, true);
  assert.equal(mapState.goalHoldMs, 20);
  assert.deepEqual(calls, [
    "haptic:enter",
    "haptic:hold",
    "complete:current",
    "effect",
    "haptic:complete",
    "advance",
  ]);
}

testGoalCompletionAdvancesMapOnce();

console.log("Goal controller tests passed.");

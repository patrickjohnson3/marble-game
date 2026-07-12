import { normalizeJoinedObstacleRects } from "./map.js";
import { createResolvedMapState } from "./map-state.js";

export function createMapRuntime({
  initialMap,
  normalizeObstacles = normalizeJoinedObstacleRects
}) {
  const state = {
    activeMap: null,
    elements: [],
    obstacles: [],
    roughPatches: [],
    goal: null,
    goalHoldMs: 0,
    goalCompleted: false
  };

  function resetGoalProgress() {
    state.goalHoldMs = 0;
    state.goalCompleted = false;
  }

  function setActiveMap(nextMap) {
    const derived = createResolvedMapState(nextMap, { normalizeObstacles });
    state.activeMap = derived.activeMap;
    state.elements = derived.elements;
    state.obstacles = derived.obstacles;
    state.roughPatches = derived.roughPatches;
    state.goal = derived.goal;
    resetGoalProgress();
    return state;
  }

  function addGoalHold(ms) {
    state.goalHoldMs = Math.min(state.goal.holdMs, state.goalHoldMs + ms);
    return state.goalHoldMs / state.goal.holdMs;
  }

  function completeGoal() {
    state.goalCompleted = true;
  }

  function clearGoalCompleted() {
    state.goalCompleted = false;
  }

  setActiveMap(initialMap);

  return {
    state,
    addGoalHold,
    clearGoalCompleted,
    completeGoal,
    resetGoalProgress,
    setActiveMap
  };
}

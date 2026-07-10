import {
  mapObstacleElements,
  mapRoughPatchElements,
  normalizedObstacleRects
} from "./map.js";

function deriveMapElements(activeMap, normalizeObstacles) {
  const elements = activeMap.elements;
  return {
    elements,
    obstacles: normalizeObstacles(mapObstacleElements(elements)),
    roughPatches: mapRoughPatchElements(elements),
    goal: activeMap.goal
  };
}

export function createMapRuntime({
  initialMap,
  normalizeObstacles = normalizedObstacleRects
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
    const derived = deriveMapElements(nextMap, normalizeObstacles);
    state.activeMap = nextMap;
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

  setActiveMap(initialMap);

  return {
    state,
    addGoalHold,
    resetGoalProgress,
    setActiveMap
  };
}

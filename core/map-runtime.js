import {
  mapIcePatchElements,
  mapObstacleElements,
  mapRoughPatchElements,
} from "./map-elements.js";
import { normalizeJoinedObstacleRects } from "./map-obstacles.js";
import { rectBounds } from "./rect-bounds.js";
import { createSpatialIndex } from "./spatial-index.js";

export function createResolvedMapState(
  activeMap,
  {
    collisionIndexCellSize = 256,
    normalizeObstacles = normalizeJoinedObstacleRects,
  } = {},
) {
  const elements = activeMap.elements;
  const icePatches = mapIcePatchElements(elements);
  const obstacles = normalizeObstacles(mapObstacleElements(elements));
  const roughPatches = mapRoughPatchElements(elements);
  return {
    activeMap,
    elements,
    icePatches,
    icePatchBounds: rectBounds(icePatches),
    icePatchIndex: createSpatialIndex(icePatches, {
      cellSize: collisionIndexCellSize,
    }),
    obstacles,
    obstacleBounds: rectBounds(obstacles),
    obstacleIndex: createSpatialIndex(obstacles, {
      cellSize: collisionIndexCellSize,
    }),
    roughPatches,
    roughPatchBounds: rectBounds(roughPatches),
    roughPatchIndex: createSpatialIndex(roughPatches, {
      cellSize: collisionIndexCellSize,
    }),
    goal: activeMap.goal,
    spawn: activeMap.spawn,
    world: activeMap.world,
  };
}

export function createMapRuntime({
  initialMap,
  collisionIndexCellSize,
  normalizeObstacles = normalizeJoinedObstacleRects,
}) {
  const state = {
    activeMap: null,
    elements: [],
    icePatches: [],
    icePatchBounds: null,
    icePatchIndex: null,
    obstacles: [],
    obstacleBounds: null,
    obstacleIndex: null,
    roughPatches: [],
    roughPatchBounds: null,
    roughPatchIndex: null,
    goal: null,
    spawn: null,
    goalHoldMs: 0,
    goalCompleted: false,
  };

  function resetGoalProgress() {
    state.goalHoldMs = 0;
    state.goalCompleted = false;
  }

  function setActiveMap(nextMap) {
    const derived = createResolvedMapState(nextMap, {
      collisionIndexCellSize,
      normalizeObstacles,
    });
    state.activeMap = derived.activeMap;
    state.elements = derived.elements;
    state.icePatches = derived.icePatches;
    state.icePatchBounds = derived.icePatchBounds;
    state.icePatchIndex = derived.icePatchIndex;
    state.obstacles = derived.obstacles;
    state.obstacleBounds = derived.obstacleBounds;
    state.obstacleIndex = derived.obstacleIndex;
    state.roughPatches = derived.roughPatches;
    state.roughPatchBounds = derived.roughPatchBounds;
    state.roughPatchIndex = derived.roughPatchIndex;
    state.goal = derived.goal;
    state.spawn = derived.spawn;
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
    setActiveMap,
  };
}

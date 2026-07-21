import { MAP_ELEMENT_TYPES, mapElementsByType } from "./map-elements.js";
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
  const elementsByType = mapElementsByType(elements);
  const hazardPatches = elementsByType[MAP_ELEMENT_TYPES.hazardPatch];
  const icePatches = elementsByType[MAP_ELEMENT_TYPES.icePatch];
  const obstacles = normalizeObstacles(
    elementsByType[MAP_ELEMENT_TYPES.obstacle],
  );
  const roughPatches = elementsByType[MAP_ELEMENT_TYPES.roughPatch];
  return {
    activeMap,
    elements,
    hazardPatches,
    hazardPatchBounds: rectBounds(hazardPatches),
    hazardPatchIndex: createSpatialIndex(hazardPatches, {
      cellSize: collisionIndexCellSize,
    }),
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
    hazardPatches: [],
    hazardPatchBounds: null,
    hazardPatchIndex: null,
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
    runStartedAt: null,
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
    state.hazardPatches = derived.hazardPatches;
    state.hazardPatchBounds = derived.hazardPatchBounds;
    state.hazardPatchIndex = derived.hazardPatchIndex;
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

  function startRun(now) {
    state.runStartedAt = now;
  }

  function currentRunMs(now) {
    return Number.isFinite(state.runStartedAt)
      ? now - state.runStartedAt
      : null;
  }

  setActiveMap(initialMap);

  return {
    state,
    addGoalHold,
    clearGoalCompleted,
    completeGoal,
    currentRunMs,
    resetGoalProgress,
    setActiveMap,
    startRun,
  };
}

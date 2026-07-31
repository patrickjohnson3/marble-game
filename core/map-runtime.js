import {
  MAP_ELEMENT_TYPES,
  MAP_TERRAIN_TYPES,
  mapElementsByType,
} from "./map-elements.js";
import { normalizeJoinedObstacleRects } from "./map-obstacles.js";
import { rectBounds } from "./rect-bounds.js";

export function createResolvedMapState(
  activeMap,
  { normalizeObstacles = normalizeJoinedObstacleRects } = {},
) {
  const elements = activeMap.elements;
  const elementsByType = mapElementsByType(elements);
  const terrainByType = Object.fromEntries(
    MAP_TERRAIN_TYPES.map((type) => {
      const terrainElements = elementsByType[type];
      return [
        type,
        {
          elements: terrainElements,
          bounds: rectBounds(terrainElements),
        },
      ];
    }),
  );
  const obstacles = normalizeObstacles(
    elementsByType[MAP_ELEMENT_TYPES.obstacle],
  );
  return {
    activeMap,
    elements,
    obstacles,
    obstacleBounds: rectBounds(obstacles),
    terrainByType,
    goal: activeMap.goal,
    spawn: activeMap.spawn,
    world: activeMap.world,
  };
}

export function createMapRuntime({
  initialMap,
  normalizeObstacles = normalizeJoinedObstacleRects,
}) {
  const state = {
    activeMap: null,
    elements: [],
    obstacles: [],
    obstacleBounds: null,
    terrainByType: {},
    goal: null,
    spawn: null,
    world: null,
    goalHoldMs: 0,
    goalCompleted: false,
  };

  function resetGoalProgress() {
    state.goalHoldMs = 0;
    state.goalCompleted = false;
  }

  function setActiveMap(nextMap) {
    const derived = createResolvedMapState(nextMap, {
      normalizeObstacles,
    });
    state.activeMap = derived.activeMap;
    state.elements = derived.elements;
    state.obstacles = derived.obstacles;
    state.obstacleBounds = derived.obstacleBounds;
    state.terrainByType = derived.terrainByType;
    state.goal = derived.goal;
    state.spawn = derived.spawn;
    state.world = derived.world;
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

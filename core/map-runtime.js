import {
  MAP_ELEMENT_TYPES,
  MAP_TERRAIN_TYPES,
  mapElementsByType,
} from "./map-elements.js";
import { normalizeJoinedObstacleRects } from "./map-obstacles.js";
import { rectBounds } from "./rect-bounds.js";

function prepareCollisionObstacle(obstacle) {
  if (!Number.isFinite(obstacle.angle)) return obstacle;

  const angle = obstacle.angle;
  return {
    ...obstacle,
    collisionCenterX: obstacle.x + obstacle.w / 2,
    collisionCenterY: obstacle.y + obstacle.h / 2,
    collisionCos: Math.cos(angle),
    collisionHalfHeight: (obstacle.hitboxH ?? obstacle.h) / 2,
    collisionHalfWidth: (obstacle.hitboxW ?? obstacle.w) / 2,
    collisionSin: Math.sin(angle),
  };
}

function createRuntimeMap(sourceMap) {
  return {
    ...sourceMap,
    world: { ...sourceMap.world },
    goal: { ...sourceMap.goal },
    spawn: { ...sourceMap.spawn },
    elements: sourceMap.elements.map((element) => ({ ...element })),
  };
}

export function createResolvedMapState(
  sourceMap,
  { normalizeObstacles = normalizeJoinedObstacleRects } = {},
) {
  const activeMap = createRuntimeMap(sourceMap);
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
  ).map(prepareCollisionObstacle);
  return {
    activeMap,
    obstacles,
    obstacleBounds: rectBounds(obstacles),
    terrainByType,
  };
}

export function createMapRuntime({
  initialMap,
  normalizeObstacles = normalizeJoinedObstacleRects,
}) {
  const state = {
    activeMap: null,
    obstacles: [],
    obstacleBounds: null,
    terrainByType: {},
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
    state.obstacles = derived.obstacles;
    state.obstacleBounds = derived.obstacleBounds;
    state.terrainByType = derived.terrainByType;
    resetGoalProgress();
    return state;
  }

  function addGoalHold(ms) {
    const goal = state.activeMap.goal;
    state.goalHoldMs = Math.min(goal.holdMs, state.goalHoldMs + ms);
    return state.goalHoldMs / goal.holdMs;
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

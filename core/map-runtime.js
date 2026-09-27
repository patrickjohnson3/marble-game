import { createCockroach } from "./cockroach.js";
import { createMouse } from "./mouse.js";
import { cloneMapComposition } from "./map-variants.js";
import {
  KITCHEN_FIXTURES,
  MAP_ELEMENT_TYPES,
  MAP_TERRAIN_TYPES,
  mapElementsByType,
} from "./map-elements.js";
import {
  createForkCollisionRects,
  createParkingCarCollisionRects,
  createSpoonCollisionRects,
  normalizeJoinedObstacleRects,
} from "./map-obstacles.js";
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
    ...cloneMapComposition(sourceMap),
    world: { ...sourceMap.world },
    ...(sourceMap.goal ? { goal: { ...sourceMap.goal } } : {}),
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
  )
    .flatMap((obstacle) => {
      if (obstacle.fixture === KITCHEN_FIXTURES.fork)
        return createForkCollisionRects(obstacle);
      if (obstacle.fixture === KITCHEN_FIXTURES.spoon)
        return createSpoonCollisionRects(obstacle);
      if (obstacle.fixture === "parkedCar")
        return createParkingCarCollisionRects(obstacle);
      return [obstacle];
    })
    .map(prepareCollisionObstacle);
  return {
    activeMap,
    obstacles,
    obstacleBounds: rectBounds(obstacles),
    terrainByType,
    mouse: createMouse(activeMap),
    cockroach: createCockroach(activeMap),
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
    mouse: null,
    cockroach: null,
    goalHoldMs: 0,
    goalCompleted: false,
    departureReady: false,
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
    state.mouse = derived.mouse;
    state.cockroach = derived.cockroach;
    state.departureReady = false;
    resetGoalProgress();
    return state;
  }

  function addGoalHold(ms) {
    const goal = state.activeMap.goal;
    if (!goal) return 0;
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

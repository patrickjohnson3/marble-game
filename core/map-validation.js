import { circleRectContact } from "./geometry.js";
import { hasReachableGoal } from "./map-reachability.js";

function isMultipleOf(value, size) {
  return Math.abs(value / size - Math.round(value / size)) < 0.000001;
}

function sameWorldSize(a, b) {
  return a?.width === b?.width && a?.height === b?.height;
}

function validateGoal(goal, { world, obstacles, errors }) {
  if (!goal) {
    errors.push("goal is required");
    return;
  }

  for (const key of ["x", "y", "r", "holdMs"]) {
    if (!Number.isFinite(goal[key])) {
      errors.push("goal has non-finite " + key);
    }
  }
  if (goal.r <= 0) {
    errors.push("goal radius must be positive");
  }
  if (goal.holdMs <= 0) {
    errors.push("goal hold time must be positive");
  }
  if (goal.x - goal.r < 0 ||
      goal.y - goal.r < 0 ||
      goal.x + goal.r > world.width ||
      goal.y + goal.r > world.height) {
    errors.push("goal must fit inside world bounds");
  }
  if (obstacles.some((obstacle) => circleRectContact({ x: goal.x, y: goal.y, r: goal.r }, obstacle).intersects)) {
    errors.push("goal must not overlap obstacles");
  }
}

function validateSpawn(spawn, { world, obstacles, errors }) {
  if (!spawn) {
    errors.push("spawn is required");
    return;
  }

  for (const key of ["x", "y", "r"]) {
    if (!Number.isFinite(spawn[key])) {
      errors.push("spawn has non-finite " + key);
    }
  }
  if (spawn.r <= 0) {
    errors.push("spawn radius must be positive");
  }
  if (spawn.x - spawn.r < 0 ||
      spawn.y - spawn.r < 0 ||
      spawn.x + spawn.r > world.width ||
      spawn.y + spawn.r > world.height) {
    errors.push("spawn must fit inside world bounds");
  }
  if (obstacles.some((obstacle) => circleRectContact(spawn, obstacle).intersects)) {
    errors.push("spawn must not overlap obstacles");
  }
}

function validateRect(rect, { world, label, errors }) {
  for (const key of ["x", "y", "w", "h"]) {
    if (!Number.isFinite(rect[key])) {
      errors.push(label + " has non-finite " + key);
    }
  }

  if (rect.w <= 0 || rect.h <= 0) {
    errors.push(label + " must have positive dimensions");
  }
  if (rect.x < 0 || rect.y < 0) {
    errors.push(label + " must start inside world bounds");
  }
  if (rect.x + rect.w > world.width || rect.y + rect.h > world.height) {
    errors.push(label + " must fit inside world bounds");
  }
}

export function validateMapConfig(config, {
  normalizedObstacles,
  spawn
} = {}, {
  elementTypes,
  mapObstacleElements,
  normalizedObstacleRects,
  validMapVariants
}) {
  const errors = [];
  const allowedTypes = new Set(Object.values(elementTypes));
  const world = config?.world ?? {};
  const elements = Array.isArray(config?.elements) ? config.elements : [];
  const objectElements = elements.filter((element) => element && typeof element === "object");
  const checkedObstaclesSource = normalizedObstacles ??
    normalizedObstacleRects(mapObstacleElements(objectElements));
  const checkedObstacles = Array.isArray(checkedObstaclesSource) ?
    checkedObstaclesSource.filter((obstacle) => obstacle && typeof obstacle === "object") :
    [];
  const gridSize = config?.grid?.size;

  if (!config || typeof config !== "object") {
    errors.push("map config is required");
  }
  if (!Array.isArray(config?.elements)) {
    errors.push("elements must be an array");
  }

  if (!Number.isFinite(world.width) || world.width <= 0) {
    errors.push("world width must be positive");
  }
  if (!Number.isFinite(world.height) || world.height <= 0) {
    errors.push("world height must be positive");
  }
  validMapVariants(config?.variants).forEach((variant) => {
    if (variant.world && !sameWorldSize(variant.world, world)) {
      errors.push("variant " + variant.id + " world must match base world");
    }
  });
  if (gridSize !== undefined) {
    if (!Number.isFinite(gridSize) || gridSize <= 0) {
      errors.push("grid size must be positive");
    } else {
      if (!isMultipleOf(world.width, gridSize)) {
        errors.push("world width must align to grid");
      }
      if (!isMultipleOf(world.height, gridSize)) {
        errors.push("world height must align to grid");
      }
    }
  }

  elements.forEach((element, index) => {
    if (!element || typeof element !== "object") {
      errors.push("element " + index + " must be an object");
      return;
    }
    if (!allowedTypes.has(element.type)) {
      errors.push("element " + index + " has unknown type " + element.type);
    }
    validateRect(element, {
      world,
      label: "element " + index,
      errors
    });
    if (Number.isFinite(gridSize) && gridSize > 0) {
      for (const key of ["x", "y", "w", "h"]) {
        if (!isMultipleOf(element[key], gridSize)) {
          errors.push("element " + index + " " + key + " must align to grid");
        }
      }
    }
  });

  if (normalizedObstacles !== undefined && !Array.isArray(normalizedObstacles)) {
    errors.push("normalized obstacles must be an array");
  }
  const checkedSpawn = spawn ?? {
    x: world.width / 2,
    y: world.height / 2,
    r: config?.marbleRadius ?? 29
  };

  if (Array.isArray(checkedObstaclesSource)) {
    checkedObstaclesSource.forEach((obstacle, index) => {
      if (!obstacle || typeof obstacle !== "object") {
        errors.push("normalized obstacle " + index + " must be an object");
        return;
      }
      validateRect(obstacle, {
        world,
        label: "normalized obstacle " + index,
        errors
      });
    });
  }

  validateGoal(config?.goal, {
    world,
    obstacles: checkedObstacles,
    errors
  });
  validateSpawn(checkedSpawn, {
    world,
    obstacles: checkedObstacles,
    errors
  });
  if (Number.isFinite(world.width) &&
      Number.isFinite(world.height) &&
      Number.isFinite(checkedSpawn.x) &&
      Number.isFinite(checkedSpawn.y) &&
      Number.isFinite(checkedSpawn.r) &&
      Number.isFinite(config?.goal?.x) &&
      Number.isFinite(config?.goal?.y) &&
      Number.isFinite(config?.goal?.r) &&
      checkedObstacles.every((obstacle) =>
        ["x", "y", "w", "h"].every((key) => Number.isFinite(obstacle[key]))
      )) {
    const reachabilityCellSize = Number.isFinite(gridSize) && gridSize > 0 ?
      Math.max(5, gridSize / 2) :
      Math.max(5, checkedSpawn.r / 2);
    if (!hasReachableGoal({
      world,
      obstacles: checkedObstacles,
      spawn: checkedSpawn,
      goal: config.goal,
      cellSize: reachabilityCellSize
    })) {
      errors.push("goal must be reachable from spawn");
    }
  }

  return errors;
}

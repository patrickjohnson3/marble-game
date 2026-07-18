import { circleRectContact } from "./geometry.js";
import { hasReachableGoal } from "./map-reachability.js";
import { mapValidationMessages } from "./map-validation-messages.js";

function isMultipleOf(value, size) {
  return Math.abs(value / size - Math.round(value / size)) < 0.000001;
}

function sameWorldSize(a, b) {
  return a?.width === b?.width && a?.height === b?.height;
}

function reachabilityCellSize({ gridSize, spawn, tuning = {} }) {
  const minCellSize =
    Number.isFinite(tuning.minCellSize) && tuning.minCellSize > 0
      ? tuning.minCellSize
      : 5;
  const gridDivisor =
    Number.isFinite(tuning.gridDivisor) && tuning.gridDivisor > 0
      ? tuning.gridDivisor
      : 2;
  const spawnRadiusDivisor =
    Number.isFinite(tuning.spawnRadiusDivisor) && tuning.spawnRadiusDivisor > 0
      ? tuning.spawnRadiusDivisor
      : 2;

  return Number.isFinite(gridSize) && gridSize > 0
    ? Math.max(minCellSize, gridSize / gridDivisor)
    : Math.max(minCellSize, spawn.r / spawnRadiusDivisor);
}

function validateGoal(goal, { world, obstacles, errors }) {
  if (!goal) {
    errors.push(mapValidationMessages.goalRequired);
    return;
  }

  for (const key of ["x", "y", "r", "holdMs"]) {
    if (!Number.isFinite(goal[key])) {
      errors.push(mapValidationMessages.fieldNonFinite("goal", key));
    }
  }
  if (goal.r <= 0) {
    errors.push(mapValidationMessages.goalRadiusPositive);
  }
  if (goal.holdMs <= 0) {
    errors.push(mapValidationMessages.goalHoldPositive);
  }
  if (
    goal.x - goal.r < 0 ||
    goal.y - goal.r < 0 ||
    goal.x + goal.r > world.width ||
    goal.y + goal.r > world.height
  ) {
    errors.push(mapValidationMessages.goalInsideWorld);
  }
  if (
    obstacles.some(
      (obstacle) =>
        circleRectContact({ x: goal.x, y: goal.y, r: goal.r }, obstacle)
          .intersects,
    )
  ) {
    errors.push(mapValidationMessages.goalObstacleOverlap);
  }
}

function validateSpawn(spawn, { world, obstacles, errors }) {
  if (!spawn) {
    errors.push(mapValidationMessages.spawnRequired);
    return;
  }

  for (const key of ["x", "y", "r"]) {
    if (!Number.isFinite(spawn[key])) {
      errors.push(mapValidationMessages.fieldNonFinite("spawn", key));
    }
  }
  if (spawn.r <= 0) {
    errors.push(mapValidationMessages.spawnRadiusPositive);
  }
  if (
    spawn.x - spawn.r < 0 ||
    spawn.y - spawn.r < 0 ||
    spawn.x + spawn.r > world.width ||
    spawn.y + spawn.r > world.height
  ) {
    errors.push(mapValidationMessages.spawnInsideWorld);
  }
  if (
    obstacles.some((obstacle) => circleRectContact(spawn, obstacle).intersects)
  ) {
    errors.push(mapValidationMessages.spawnObstacleOverlap);
  }
}

function validateRect(rect, { world, label, errors }) {
  for (const key of ["x", "y", "w", "h"]) {
    if (!Number.isFinite(rect[key])) {
      errors.push(mapValidationMessages.fieldNonFinite(label, key));
    }
  }

  if (rect.w <= 0 || rect.h <= 0) {
    errors.push(mapValidationMessages.rectPositiveDimensions(label));
  }
  if (rect.x < 0 || rect.y < 0) {
    errors.push(mapValidationMessages.rectInsideWorldStart(label));
  }
  if (rect.x + rect.w > world.width || rect.y + rect.h > world.height) {
    errors.push(mapValidationMessages.rectInsideWorld(label));
  }
}

function validateSlopeDirection(element, index, errors) {
  if (element.type !== "slope") return;
  if (!Number.isFinite(element.dx)) {
    errors.push(mapValidationMessages.fieldNonFinite("element " + index, "dx"));
  }
  if (!Number.isFinite(element.dy)) {
    errors.push(mapValidationMessages.fieldNonFinite("element " + index, "dy"));
  }
  if (element.dx === 0 && element.dy === 0) {
    errors.push(mapValidationMessages.slopeDirection(index));
  }
}

export function validateMapConfig(
  config,
  { normalizedObstacles, spawn } = {},
  {
    elementTypes,
    mapObstacleElements,
    normalizeJoinedObstacleRects,
    validMapVariants,
  },
) {
  const errors = [];
  const allowedTypes = new Set(Object.values(elementTypes));
  const world = config?.world ?? {};
  const elements = Array.isArray(config?.elements) ? config.elements : [];
  const objectElements = elements.filter(
    (element) => element && typeof element === "object",
  );
  const checkedObstaclesSource =
    normalizedObstacles ??
    normalizeJoinedObstacleRects(mapObstacleElements(objectElements));
  const checkedObstacles = Array.isArray(checkedObstaclesSource)
    ? checkedObstaclesSource.filter(
        (obstacle) => obstacle && typeof obstacle === "object",
      )
    : [];
  const gridSize = config?.grid?.size;

  if (!config || typeof config !== "object") {
    errors.push(mapValidationMessages.configRequired);
  }
  if (!Array.isArray(config?.elements)) {
    errors.push(mapValidationMessages.elementsArray);
  }

  if (!Number.isFinite(world.width) || world.width <= 0) {
    errors.push(mapValidationMessages.worldWidthPositive);
  }
  if (!Number.isFinite(world.height) || world.height <= 0) {
    errors.push(mapValidationMessages.worldHeightPositive);
  }
  validMapVariants(config?.variants).forEach((variant) => {
    if (variant.world && !sameWorldSize(variant.world, world)) {
      errors.push(mapValidationMessages.variantWorldMatch(variant.id));
    }
  });
  if (gridSize !== undefined) {
    if (!Number.isFinite(gridSize) || gridSize <= 0) {
      errors.push(mapValidationMessages.gridPositive);
    } else {
      if (!isMultipleOf(world.width, gridSize)) {
        errors.push(mapValidationMessages.worldWidthGrid);
      }
      if (!isMultipleOf(world.height, gridSize)) {
        errors.push(mapValidationMessages.worldHeightGrid);
      }
    }
  }

  elements.forEach((element, index) => {
    if (!element || typeof element !== "object") {
      errors.push(mapValidationMessages.elementObject(index));
      return;
    }
    if (!allowedTypes.has(element.type)) {
      errors.push(
        mapValidationMessages.elementUnknownType(index, element.type),
      );
    }
    validateRect(element, {
      world,
      label: "element " + index,
      errors,
    });
    validateSlopeDirection(element, index, errors);
    if (Number.isFinite(gridSize) && gridSize > 0) {
      for (const key of ["x", "y", "w", "h"]) {
        if (!isMultipleOf(element[key], gridSize)) {
          errors.push(mapValidationMessages.elementGrid(index, key));
        }
      }
    }
  });

  if (
    normalizedObstacles !== undefined &&
    !Array.isArray(normalizedObstacles)
  ) {
    errors.push(mapValidationMessages.normalizedObstaclesArray);
  }
  const checkedSpawn = spawn ?? config?.spawn;

  if (Array.isArray(checkedObstaclesSource)) {
    checkedObstaclesSource.forEach((obstacle, index) => {
      if (!obstacle || typeof obstacle !== "object") {
        errors.push(mapValidationMessages.normalizedObstacleObject(index));
        return;
      }
      validateRect(obstacle, {
        world,
        label: "normalized obstacle " + index,
        errors,
      });
    });
  }

  validateGoal(config?.goal, {
    world,
    obstacles: checkedObstacles,
    errors,
  });
  validateSpawn(checkedSpawn, {
    world,
    obstacles: checkedObstacles,
    errors,
  });
  if (
    Number.isFinite(world.width) &&
    Number.isFinite(world.height) &&
    checkedSpawn &&
    Number.isFinite(checkedSpawn.x) &&
    Number.isFinite(checkedSpawn.y) &&
    Number.isFinite(checkedSpawn.r) &&
    Number.isFinite(config?.goal?.x) &&
    Number.isFinite(config?.goal?.y) &&
    Number.isFinite(config?.goal?.r) &&
    checkedObstacles.every((obstacle) =>
      ["x", "y", "w", "h"].every((key) => Number.isFinite(obstacle[key])),
    )
  ) {
    if (
      !hasReachableGoal({
        world,
        obstacles: checkedObstacles,
        spawn: checkedSpawn,
        goal: config.goal,
        cellSize: reachabilityCellSize({
          gridSize,
          spawn: checkedSpawn,
          tuning: config?.reachability,
        }),
      })
    ) {
      errors.push(mapValidationMessages.goalReachable);
    }
  }

  return errors;
}

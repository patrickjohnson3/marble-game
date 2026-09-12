import {
  isKitchenFixture,
  MAP_ELEMENT_TYPE_VALUES,
  mapObstacleElements,
} from "./map-elements.js";
import { normalizeJoinedObstacleRects } from "./map-obstacles.js";
import { circleObstacleContact } from "./physics-collisions.js";
import { createResolvedMapState } from "./map-runtime.js";
import {
  authoredThemes,
  sceneryKinds,
  fixtureKinds,
} from "../maps/map-authoring.js";
import { kitchenPoint } from "../maps/kitchen-layout.js";
import { hasLikelyReachableGoal } from "./map-reachability.js";

export const mapValidationMessages = Object.freeze({
  configRequired: "map config is required",
  elementsArray: "elements must be an array",
  goalRequired: "goal is required",
  goalRadiusPositive: "goal radius must be positive",
  goalHoldPositive: "goal hold time must be positive",
  goalInsideWorld: "goal must fit inside world bounds",
  goalObstacleOverlap: "goal must not overlap obstacles",
  goalReachable: "goal must appear reachable from spawn",
  gridPositive: "grid size must be positive",
  normalizedObstaclesArray: "normalized obstacles must be an array",
  spawnRequired: "spawn is required",
  spawnRadiusPositive: "spawn radius must be positive",
  spawnInsideWorld: "spawn must fit inside world bounds",
  spawnObstacleOverlap: "spawn must not overlap obstacles",
  worldWidthPositive: "world width must be positive",
  worldHeightPositive: "world height must be positive",
  worldWidthGrid: "world width must align to grid",
  worldHeightGrid: "world height must align to grid",
  elementObject: (index) => "element " + index + " must be an object",
  elementUnknownType: (index, type) =>
    "element " + index + " has unknown type " + type,
  kitchenObstacleFixture: (index) =>
    "element " + index + " must use a supported kitchen fixture",
  fieldNonFinite: (label, key) => label + " has non-finite " + key,
  fieldPositive: (label, key) => label + " " + key + " must be positive",
  rectPositiveDimensions: (label) => label + " must have positive dimensions",
  rectInsideWorldStart: (label) => label + " must start inside world bounds",
  rectInsideWorld: (label) => label + " must fit inside world bounds",
  elementGrid: (index, key) =>
    "element " + index + " " + key + " must align to grid",
  normalizedObstacleObject: (index) =>
    "normalized obstacle " + index + " must be an object",
});

function isMultipleOf(value, size) {
  return Math.abs(value / size - Math.round(value / size)) < 0.000001;
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
      (obstacle) => circleObstacleContact(goal, obstacle).intersects,
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
    obstacles.some(
      (obstacle) => circleObstacleContact(spawn, obstacle).intersects,
    )
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

function validateOrientedObstacleFields(element, { errors, label }) {
  for (const key of ["hitboxW", "hitboxH"]) {
    if (!Object.hasOwn(element, key)) continue;
    if (!Number.isFinite(element[key])) {
      errors.push(mapValidationMessages.fieldNonFinite(label, key));
    } else if (element[key] <= 0) {
      errors.push(mapValidationMessages.fieldPositive(label, key));
    }
  }

  if (Object.hasOwn(element, "angle") && !Number.isFinite(element.angle)) {
    errors.push(mapValidationMessages.fieldNonFinite(label, "angle"));
  }
}

function mapValidationContext(config, normalizedObstacles) {
  const world = config?.world ?? {};
  const elements = Array.isArray(config?.elements) ? config.elements : [];
  const objectElements = elements.filter(
    (element) => element && typeof element === "object",
  );
  const checkedObstaclesSource =
    normalizedObstacles ??
    (config?.objective
      ? createResolvedMapState({
          world,
          spawn: config.spawn,
          elements: objectElements,
        }).obstacles
      : normalizeJoinedObstacleRects(mapObstacleElements(objectElements)));
  const checkedObstacles = Array.isArray(checkedObstaclesSource)
    ? checkedObstaclesSource.filter(
        (obstacle) => obstacle && typeof obstacle === "object",
      )
    : [];

  return {
    checkedObstacles,
    checkedObstaclesSource,
    elements,
    gridSize: config?.grid?.size,
    world,
  };
}

function validateRequiredMapShape(config, { errors }) {
  if (!config || typeof config !== "object") {
    errors.push(mapValidationMessages.configRequired);
  }
  if (!Array.isArray(config?.elements)) {
    errors.push(mapValidationMessages.elementsArray);
  }
}

function validateWorldAndGrid(config, { errors, gridSize, world }) {
  if (!Number.isFinite(world.width) || world.width <= 0) {
    errors.push(mapValidationMessages.worldWidthPositive);
  }
  if (!Number.isFinite(world.height) || world.height <= 0) {
    errors.push(mapValidationMessages.worldHeightPositive);
  }
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
}

function validateElements(
  elements,
  { allowedTypes, errors, gridSize, theme, world },
) {
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
    if (element.type === "obstacle") {
      validateOrientedObstacleFields(element, {
        errors,
        label: "element " + index,
      });
      if (theme === "kitchenFloor" && !isKitchenFixture(element.fixture)) {
        errors.push(mapValidationMessages.kitchenObstacleFixture(index));
      }
    }
    if (Number.isFinite(gridSize) && gridSize > 0) {
      for (const key of ["x", "y", "w", "h"]) {
        if (!isMultipleOf(element[key], gridSize)) {
          errors.push(mapValidationMessages.elementGrid(index, key));
        }
      }
    }
  });
}

function validateNormalizedObstacles(
  checkedObstaclesSource,
  normalizedObstacles,
  { errors, world },
) {
  if (
    normalizedObstacles !== undefined &&
    !Array.isArray(normalizedObstacles)
  ) {
    errors.push(mapValidationMessages.normalizedObstaclesArray);
  }

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
}

function canValidateReachability({
  checkedObstacles,
  checkedSpawn,
  config,
  world,
}) {
  return (
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
  );
}

function validateReachableGoal({
  checkedObstacles,
  checkedSpawn,
  config,
  errors,
  gridSize,
  world,
}) {
  if (
    !canValidateReachability({
      checkedObstacles,
      checkedSpawn,
      config,
      world,
    })
  ) {
    return;
  }

  if (
    !hasLikelyReachableGoal({
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

function validateAuthoredObjective(
  config,
  { world, obstacles, errors, spawn },
) {
  for (const key of ["variantId", "name", "theme"]) {
    if (typeof config[key] !== "string" || !config[key].trim())
      errors.push(`${key} is required for an authored map`);
  }
  if (!authoredThemes.includes(config.theme))
    errors.push(`unknown authoring theme '${config.theme}'`);
  const objective = config.objective;
  if (objective.type === "eliminate") {
    if (objective.target !== "ant" || objective.count !== "all")
      errors.push("eliminate supports target 'ant' and count 'all'");
    const antCount = (config.clusters ?? []).reduce(
      (count, cluster) => count + (cluster.ants?.length ?? 0),
      0,
    );
    if (config.theme !== "kitchenFloor" || antCount === 0)
      errors.push("eliminate objective requires authored ant targets");
  } else if (objective.type === "reach") {
    const region = config.regions?.find((item) => item.id === objective.region);
    if (!region) {
      errors.push(
        `reach objective references missing region '${objective.region}'`,
      );
      return;
    }
    validateRect(region, {
      world,
      label: `destination '${region.id}'`,
      errors,
    });
    const goal = {
      x: region.x + region.w / 2,
      y: region.y + region.h / 2,
      r: Math.min(region.w, region.h) / 2,
    };
    if (!Number.isFinite(goal.r) || goal.r <= (spawn?.r ?? 0))
      errors.push("destination must have room for the marble");
    if (
      obstacles.some(
        (obstacle) => circleObstacleContact(goal, obstacle).intersects,
      )
    )
      errors.push("destination apron must be clear of obstacles");
    if (
      errors.length === 0 &&
      !hasLikelyReachableGoal({
        world,
        obstacles,
        spawn,
        goal,
        cellSize: 20,
      })
    ) {
      errors.push(
        "destination must appear reachable from spawn (20-unit sampled grid)",
      );
    }
  } else {
    errors.push(`unknown objective type '${objective.type}'`);
  }
}

function validateComposition(config, { world, obstacles, errors, spawn }) {
  if (!config?.objective) return;
  const regionIds = new Set();
  for (const region of config.regions ?? []) {
    if (Object.hasOwn(region, "r"))
      errors.push(
        `region '${region.id}' must be rectangular; r belongs only to legacy goals`,
      );
    if (typeof region.id !== "string" || !region.id || regionIds.has(region.id))
      errors.push("regions need unique nonempty ids");
    regionIds.add(region.id);
    validateRect(region, { world, label: `region '${region.id}'`, errors });
  }
  if (config.scenery?.length > 0 && config.theme !== "livingRoom")
    errors.push("generic scenery needs the livingRoom theme");
  for (const item of config.scenery ?? []) {
    if (!sceneryKinds.includes(item.kind))
      errors.push(`unknown scenery '${item.kind}'`);
    validateRect(item, { world, label: `scenery '${item.kind}'`, errors });
    validateRotatedBounds(item, {
      world,
      errors,
      label: `scenery '${item.kind}'`,
    });
  }
  for (const item of config.elements ?? []) {
    if (item.fixture && !fixtureKinds.includes(item.fixture))
      errors.push(`unknown fixture '${item.fixture}'`);
    if (
      item.fixture &&
      (config.theme === "kitchenFloor") !== isKitchenFixture(item.fixture)
    )
      errors.push(
        `fixture '${item.fixture}' is not supported by theme '${config.theme}'`,
      );
    if (
      item.material &&
      !(item.type === "roughPatch" && item.material === "shag")
    )
      errors.push(`unknown surface material '${item.material}'`);
    if (item.type === "obstacle") {
      if (
        config.theme === "livingRoom" &&
        ((item.hitboxW !== undefined && item.hitboxW !== item.w) ||
          (item.hitboxH !== undefined && item.hitboxH !== item.h))
      )
        errors.push(
          "living-room hitbox dimensions must match the visible footprint",
        );
      if (
        item.cornerRadius !== undefined &&
        (!Number.isFinite(item.cornerRadius) ||
          item.cornerRadius < 0 ||
          item.cornerRadius >
            Math.min(item.hitboxW ?? item.w, item.hitboxH ?? item.h) / 2)
      )
        errors.push("fixture cornerRadius must fit its footprint");
      if (item.cornerRadius > 0 && !Number.isFinite(item.angle))
        errors.push(
          "rounded obstacles require a finite angle (use 0 for unrotated)",
        );
      // Kitchen sprite boxes intentionally include transparent space. Their
      // fitted collision parts are checked by the existing fixture tests.
      if (!isKitchenFixture(item.fixture))
        validateRotatedBounds(item, {
          world,
          errors,
          label: `fixture '${item.fixture ?? "wall"}'`,
        });
    }
  }
  for (const cluster of config.clusters ?? []) {
    if (cluster.kind === "readingPile" && config.theme !== "livingRoom")
      errors.push("readingPile needs the livingRoom theme");
    for (const points of [cluster.ants, cluster.cheerios, cluster.crumbs]) {
      if (points !== undefined && !Array.isArray(points)) {
        errors.push(`cluster '${cluster.kind}' placement must be an array`);
        continue;
      }
      for (const point of points ?? []) {
        if (
          !Array.isArray(point) ||
          point.length !== 2 ||
          !point.every(Number.isFinite)
        ) {
          errors.push(
            `cluster '${cluster.kind}' placement needs two finite coordinates`,
          );
          continue;
        }
        const placed = kitchenPoint(cluster, point);
        if (
          ![placed.x, placed.y].every(Number.isFinite) ||
          placed.x < 0 ||
          placed.x > 1 ||
          placed.y < 0 ||
          placed.y > 1
        )
          errors.push(
            `cluster '${cluster.kind}' places content outside the room`,
          );
      }
    }
  }
  const viewIds = new Set(["overview", "spawn", "objective"]);
  for (const view of config.views ?? []) {
    if (
      typeof view.id !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(view.id) ||
      viewIds.has(view.id)
    )
      errors.push(
        "inspection view ids must be unique, filename-safe, and not overview/spawn/objective",
      );
    viewIds.add(view.id);
    if (
      !Number.isFinite(view.x) ||
      !Number.isFinite(view.y) ||
      view.x < 0 ||
      view.x > world.width ||
      view.y < 0 ||
      view.y > world.height
    )
      errors.push("inspection views need an in-bounds center");
    if (
      view.scale !== undefined &&
      (!Number.isFinite(view.scale) || view.scale <= 0)
    )
      errors.push(
        `inspection view '${view.id}' scale must be positive and finite`,
      );
  }
  if (config.route && errors.length === 0)
    validateAuthoredRoute(config, obstacles, errors, spawn);
}

function validateRotatedBounds(rect, { world, errors, label }) {
  if (rect.angle !== undefined && !Number.isFinite(rect.angle)) {
    errors.push(`${label} has non-finite angle`);
    return;
  }
  const cos = Math.abs(Math.cos(rect.angle ?? 0)),
    sin = Math.abs(Math.sin(rect.angle ?? 0));
  const halfW = (rect.w * cos + rect.h * sin) / 2;
  const halfH = (rect.w * sin + rect.h * cos) / 2;
  const x = rect.x + rect.w / 2,
    y = rect.y + rect.h / 2;
  if (
    x - halfW < 0 ||
    y - halfH < 0 ||
    x + halfW > world.width ||
    y + halfH > world.height
  )
    errors.push(`${label} rotated footprint leaves the room`);
}

// Authored waypoints are a clearance certificate, not runtime pathfinding.
// Samples every five units reserve an extra marble radius for steering room.
function validateAuthoredRoute(config, obstacles, errors, spawn) {
  if (!Array.isArray(config.route) || config.route.length < 2) {
    errors.push("route needs at least two waypoints");
    return;
  }
  const radius = spawn.r * 2;
  let previous = spawn;
  for (const point of config.route) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      errors.push("route waypoints must have finite coordinates");
      return;
    }
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y) / 5),
    );
    for (let step = 0; step <= steps; step++) {
      const circle = {
        x: previous.x + ((point.x - previous.x) * step) / steps,
        y: previous.y + ((point.y - previous.y) * step) / steps,
        r: radius,
      };
      if (
        circle.x < radius ||
        circle.y < radius ||
        circle.x + radius > config.world.width ||
        circle.y + radius > config.world.height ||
        obstacles.some(
          (obstacle) => circleObstacleContact(circle, obstacle).intersects,
        )
      ) {
        errors.push(
          `route lacks steering clearance near (${Math.round(circle.x)}, ${Math.round(circle.y)})`,
        );
        return;
      }
    }
    previous = point;
  }
  if (config.objective.type === "reach") {
    const region = config.regions.find(
      (item) => item.id === config.objective.region,
    );
    if (
      previous.x - spawn.r < region.x ||
      previous.y - spawn.r < region.y ||
      previous.x + spawn.r > region.x + region.w ||
      previous.y + spawn.r > region.y + region.h
    )
      errors.push("route must finish inside the destination region");
  }
}

export function validateMapConfig(config, { normalizedObstacles, spawn } = {}) {
  const errors = [];
  if (config?.objective) {
    if (typeof config.objective !== "object" || Array.isArray(config.objective))
      return ["objective must be an object"];
    // Reject malformed authored lists before resolving geometry or walking refs.
    for (const key of [
      "elements",
      "regions",
      "clusters",
      "scenery",
      "views",
      "route",
    ]) {
      if (config[key] === undefined) continue;
      if (!Array.isArray(config[key])) {
        errors.push(`${key} must be an array`);
        continue;
      }
      config[key].forEach((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          errors.push(`${key} ${index} must be an object`);
      });
    }
    if (errors.length > 0) return errors;
  }
  const allowedTypes = new Set(MAP_ELEMENT_TYPE_VALUES);
  const {
    checkedObstacles,
    checkedObstaclesSource,
    elements,
    gridSize,
    world,
  } = mapValidationContext(config, normalizedObstacles);

  validateRequiredMapShape(config, { errors });
  validateWorldAndGrid(config, { errors, gridSize, world });
  validateElements(elements, {
    allowedTypes,
    errors,
    gridSize,
    theme: config?.theme,
    world,
  });

  const checkedSpawn = spawn ?? config?.spawn;

  validateNormalizedObstacles(checkedObstaclesSource, normalizedObstacles, {
    errors,
    world,
  });

  if (config?.objective) {
    validateSpawn(checkedSpawn, {
      world,
      obstacles: checkedObstacles,
      errors,
    });
    validateAuthoredObjective(config, {
      world,
      obstacles: checkedObstacles,
      errors,
      spawn: checkedSpawn,
    });
  } else {
    validateGoal(config?.goal, { world, obstacles: checkedObstacles, errors });
    validateSpawn(checkedSpawn, {
      world,
      obstacles: checkedObstacles,
      errors,
    });
  }
  if (!config?.objective)
    validateReachableGoal({
      checkedObstacles,
      checkedSpawn,
      config,
      errors,
      gridSize,
      world,
    });

  validateComposition(config, {
    world,
    obstacles: checkedObstacles,
    errors,
    spawn: checkedSpawn,
  });
  return errors;
}

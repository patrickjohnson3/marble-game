import { circleRectContact, clamp } from "./geometry.js";

function touchesOrOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function isHorizontal(rect) {
  return rect.w >= rect.h;
}

function isMultipleOf(value, size) {
  return Math.abs(value / size - Math.round(value / size)) < 0.000001;
}

export function snapToGrid(value, gridSize) {
  return Math.round(value / gridSize) * gridSize;
}

export function snapRectToGrid(rect, gridSize) {
  return {
    ...rect,
    x: snapToGrid(rect.x, gridSize),
    y: snapToGrid(rect.y, gridSize),
    w: snapToGrid(rect.w, gridSize),
    h: snapToGrid(rect.h, gridSize)
  };
}

export function hashMapSeed(seed) {
  const text = String(seed ?? "");
  let hash = 2166136261;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function selectSeededMapVariant(variants, seed) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const validVariants = variants.filter((variant) => variant && typeof variant === "object");
  if (validVariants.length === 0) return null;

  const exactVariant = validVariants.find((variant) => variant.id === seed);
  if (exactVariant) return exactVariant;

  return validVariants[hashMapSeed(seed) % validVariants.length];
}

export function selectNextMapVariant(variants, currentVariantId) {
  if (!Array.isArray(variants) || variants.length === 0) return null;

  const currentIndex = Math.max(0, variants.findIndex((variant) => variant.id === currentVariantId));
  return variants[(currentIndex + 1) % variants.length];
}

function resolvedMapConfig(config, { seed, variant }) {
  if (!variant) return { ...config, seed };
  const elements = Array.isArray(variant.elements) ?
    variant.elements.map((element) => ({ ...element })) :
    variant.elements;

  return {
    ...config,
    seed,
    variantId: variant.id,
    goal: { ...variant.goal },
    elements
  };
}

export function resolveSeededMapConfig(config, seed = config.seed) {
  return resolvedMapConfig(config, {
    seed,
    variant: selectSeededMapVariant(config.variants, seed)
  });
}

export function resolveMapVariantConfig(config, variantId, seed = config.seed) {
  return resolvedMapConfig(config, {
    seed,
    variant: config.variants?.find((variant) => variant.id === variantId)
  });
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

export function normalizedObstacleRects(rects) {
  const normalized = rects.map((rect) => ({ ...rect }));

  for (const horizontal of normalized.filter(isHorizontal)) {
    for (const vertical of normalized.filter((rect) => !isHorizontal(rect))) {
      const horizontalBottom = horizontal.y + horizontal.h;
      const verticalBottom = vertical.y + vertical.h;
      const horizontalRight = horizontal.x + horizontal.w;
      const verticalRight = vertical.x + vertical.w;

      if (!touchesOrOverlaps(horizontal.x, horizontalRight, vertical.x, verticalRight) ||
          !touchesOrOverlaps(horizontal.y, horizontalBottom, vertical.y, verticalBottom)) {
        continue;
      }

      const verticalBottomGap = Math.abs(verticalBottom - horizontalBottom);
      const verticalTopGap = Math.abs(vertical.y - horizontal.y);
      const horizontalRightGap = Math.abs(verticalRight - horizontalRight);
      const horizontalLeftGap = Math.abs(vertical.x - horizontal.x);
      const threshold = Math.max(horizontal.h, vertical.w);

      if (verticalBottomGap <= threshold && verticalBottomGap <= verticalTopGap) {
        const height = horizontalBottom - vertical.y;
        if (height > 0) vertical.h = height;
      } else if (verticalTopGap <= threshold) {
        const bottom = verticalBottom;
        const height = bottom - horizontal.y;
        if (height > 0) {
          vertical.y = horizontal.y;
          vertical.h = height;
        }
      }
      if (horizontalRightGap <= threshold && horizontalRightGap <= horizontalLeftGap) {
        const width = horizontalRight - vertical.x;
        if (width > 0) vertical.w = width;
      } else if (horizontalLeftGap <= threshold) {
        const right = verticalRight;
        const width = right - horizontal.x;
        if (width > 0) {
          vertical.x = horizontal.x;
          vertical.w = width;
        }
      }
    }
  }

  return normalized;
}

export function validateMapConfig(config, {
  normalizedObstacles,
  spawn
} = {}) {
  const errors = [];
  const allowedTypes = new Set(["obstacle", "roughPatch"]);
  const world = config?.world ?? {};
  const elements = Array.isArray(config?.elements) ? config.elements : [];
  const objectElements = elements.filter((element) => element && typeof element === "object");
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
      if (!isMultipleOf(element.x, gridSize)) {
        errors.push("element " + index + " x must align to grid");
      }
      if (!isMultipleOf(element.y, gridSize)) {
        errors.push("element " + index + " y must align to grid");
      }
    }
  });

  const checkedObstacles = normalizedObstacles ??
    normalizedObstacleRects(objectElements.filter((element) => element.type === "obstacle"));
  const checkedSpawn = spawn ?? {
    x: world.width / 2,
    y: world.height / 2,
    r: config?.marbleRadius ?? 29
  };

  checkedObstacles.forEach((obstacle, index) => {
    validateRect(obstacle, {
      world,
      label: "normalized obstacle " + index,
      errors
    });
  });

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

  return errors;
}

export function mapEdgeWalls(world, intro) {
  const t = intro.wallThickness;
  return [
    { x: -t, y: -t, w: world.width + t * 2, h: t },
    { x: -t, y: world.height, w: world.width + t * 2, h: t },
    { x: -t, y: 0, w: t, h: world.height },
    { x: world.width, y: 0, w: t, h: world.height }
  ];
}

export function introPenWalls(bounds, intro) {
  const t = intro.wallThickness;
  return [
    { x: bounds.left - t, y: bounds.top - t, w: bounds.right - bounds.left + t * 2, h: t },
    { x: bounds.left - t, y: bounds.bottom, w: bounds.right - bounds.left + t * 2, h: t },
    { x: bounds.left - t, y: bounds.top, w: t, h: bounds.bottom - bounds.top },
    { x: bounds.right, y: bounds.top, w: t, h: bounds.bottom - bounds.top }
  ];
}

export function setReleasedBounds(bounds, world) {
  bounds.left = 0;
  bounds.right = world.width;
  bounds.top = 0;
  bounds.bottom = world.height;
}

export function updateIntroBounds({ bounds, intro, marble, viewport, world }) {
  const halfW = viewport.width / 2 + intro.viewportMargin;
  const halfH = viewport.height / 2 + intro.viewportMargin;
  bounds.left = clamp(marble.x - halfW, 0, world.width);
  bounds.right = clamp(marble.x + halfW, 0, world.width);
  bounds.top = clamp(marble.y - halfH, 0, world.height);
  bounds.bottom = clamp(marble.y + halfH, 0, world.height);
}

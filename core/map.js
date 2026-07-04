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

  return variants[hashMapSeed(seed) % variants.length];
}

function resolvedMapConfig(config, { seed, variant }) {
  if (!variant) return { ...config, seed };

  return {
    ...config,
    seed,
    variantId: variant.id,
    goal: { ...variant.goal },
    elements: variant.elements.map((element) => ({ ...element }))
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
  normalizedObstacles = normalizedObstacleRects(config.elements.filter((element) => element.type === "obstacle"))
} = {}) {
  const errors = [];
  const allowedTypes = new Set(["obstacle", "roughPatch"]);
  const gridSize = config.grid?.size;

  if (!Number.isFinite(config.world.width) || config.world.width <= 0) {
    errors.push("world width must be positive");
  }
  if (!Number.isFinite(config.world.height) || config.world.height <= 0) {
    errors.push("world height must be positive");
  }
  if (gridSize !== undefined) {
    if (!Number.isFinite(gridSize) || gridSize <= 0) {
      errors.push("grid size must be positive");
    } else {
      if (!isMultipleOf(config.world.width, gridSize)) {
        errors.push("world width must align to grid");
      }
      if (!isMultipleOf(config.world.height, gridSize)) {
        errors.push("world height must align to grid");
      }
    }
  }

  config.elements.forEach((element, index) => {
    if (!allowedTypes.has(element.type)) {
      errors.push("element " + index + " has unknown type " + element.type);
    }
    validateRect(element, {
      world: config.world,
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

  normalizedObstacles.forEach((obstacle, index) => {
    validateRect(obstacle, {
      world: config.world,
      label: "normalized obstacle " + index,
      errors
    });
  });

  validateGoal(config.goal, {
    world: config.world,
    obstacles: normalizedObstacles,
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

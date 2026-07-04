import { clamp } from "./geometry.js";

function touchesOrOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function isHorizontal(rect) {
  return rect.w >= rect.h;
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

  if (!Number.isFinite(config.world.width) || config.world.width <= 0) {
    errors.push("world width must be positive");
  }
  if (!Number.isFinite(config.world.height) || config.world.height <= 0) {
    errors.push("world height must be positive");
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
  });

  normalizedObstacles.forEach((obstacle, index) => {
    validateRect(obstacle, {
      world: config.world,
      label: "normalized obstacle " + index,
      errors
    });
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

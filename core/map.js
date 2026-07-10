import { clamp } from "./geometry.js";
import { validateMapConfig as validateMapConfigWithDeps } from "./map-validation.js";

function touchesOrOverlaps(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function isHorizontal(rect) {
  return rect.w >= rect.h;
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

export function validMapVariants(variants) {
  return Array.isArray(variants) ?
    variants.filter((variant) => variant && typeof variant === "object") :
    [];
}

export function selectSeededMapVariant(variants, seed) {
  const validVariants = validMapVariants(variants);
  if (validVariants.length === 0) return null;

  const exactVariant = validVariants.find((variant) => variant.id === seed);
  if (exactVariant) return exactVariant;

  return validVariants[hashMapSeed(seed) % validVariants.length];
}

export function selectNextMapVariant(variants, currentVariantId) {
  const validVariants = validMapVariants(variants);
  if (validVariants.length === 0) return null;

  const currentIndex = validVariants.findIndex((variant) => variant.id === currentVariantId);
  if (currentIndex < 0) return validVariants[0];
  return validVariants[(currentIndex + 1) % validVariants.length];
}

function resolveMapConfig(config, { seed, variant }) {
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
  return resolveMapConfig(config, {
    seed,
    variant: selectSeededMapVariant(config.variants, seed)
  });
}

export function resolveMapVariantConfig(config, variantId, seed = config.seed) {
  return resolveMapConfig(config, {
    seed,
    variant: validMapVariants(config.variants).find((variant) => variant.id === variantId)
  });
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

export function validateMapConfig(config, options = {}) {
  return validateMapConfigWithDeps(config, options, {
    normalizedObstacleRects,
    validMapVariants
  });
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

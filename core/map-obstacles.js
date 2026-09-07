import { KITCHEN_FORK_SPRITE } from "./map-elements.js";

// Rounded rectangles measured in fork.png pixels: tapered handle, narrow neck,
// flare, and head/tines. The tine slots are narrower than the marble diameter.
const forkMetalRects = [
  [1, 28, 171, 81, 37],
  [81, 36, 188, 63, 31.5],
  [163, 44, 202, 47, 23.5],
  [271, 50, 192, 34, 17],
  [420, 53, 282, 26, 6.5],
  [689, 33, 71, 65, 32.5],
  [705, 2, 245, 126, 63],
  [873, 12, 151, 107, 17.5],
];

export function createForkCollisionRects(fork) {
  const sprite = KITCHEN_FORK_SPRITE;
  const visualWidth = Math.max(fork.hitboxW ?? fork.w, sprite.minWidth);
  const visualHeight = Math.max(fork.hitboxH ?? fork.h, sprite.minHeight);
  const scale = Math.min(
    visualWidth / sprite.width,
    visualHeight / sprite.height,
  );
  const angle = fork.angle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const centerX = fork.x + fork.w / 2;
  const centerY = fork.y + fork.h / 2;

  return forkMetalRects.map(([x, y, width, height, radius]) => {
    const localX = (x + width / 2 - sprite.width / 2) * scale;
    const localY = (y + height / 2 - sprite.height / 2) * scale;
    const hitboxW = width * scale;
    const hitboxH = height * scale;
    // Keep x/y/w/h as world bounds for canvas allocation; the oriented contact
    // code uses hitboxW/H about this same center.
    const w = Math.abs(cos) * hitboxW + Math.abs(sin) * hitboxH;
    const h = Math.abs(sin) * hitboxW + Math.abs(cos) * hitboxH;
    return {
      type: fork.type,
      fixture: fork.fixture,
      fixtureSource: fork,
      x: centerX + cos * localX - sin * localY - w / 2,
      y: centerY + sin * localX + cos * localY - h / 2,
      w,
      h,
      hitboxW,
      hitboxH,
      angle,
      cornerRadius: radius * scale,
    };
  });
}

export function rangesTouchOrOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function isHorizontalRect(rect) {
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
    h: snapToGrid(rect.h, gridSize),
  };
}

export function normalizeJoinedObstacleRects(rects) {
  const normalized = rects.map((rect) => ({ ...rect }));

  for (const horizontal of normalized.filter(isHorizontalRect)) {
    for (const vertical of normalized.filter(
      (rect) => !isHorizontalRect(rect),
    )) {
      const horizontalBottom = horizontal.y + horizontal.h;
      const verticalBottom = vertical.y + vertical.h;
      let horizontalRight = horizontal.x + horizontal.w;
      const verticalRight = vertical.x + vertical.w;

      if (
        !rangesTouchOrOverlap(
          horizontal.x,
          horizontalRight,
          vertical.x,
          verticalRight,
        ) ||
        !rangesTouchOrOverlap(
          horizontal.y,
          horizontalBottom,
          vertical.y,
          verticalBottom,
        )
      ) {
        continue;
      }

      const verticalBottomGap = Math.abs(verticalBottom - horizontalBottom);
      const verticalTopGap = Math.abs(vertical.y - horizontal.y);
      let horizontalRightGap = Math.abs(verticalRight - horizontalRight);
      const horizontalLeftGap = Math.abs(vertical.x - horizontal.x);
      const threshold = Math.max(horizontal.h, vertical.w);

      if (horizontalRight > verticalRight && horizontalRightGap <= threshold) {
        const width = verticalRight - horizontal.x;
        if (width > 0) {
          horizontal.w = width;
          horizontalRight = verticalRight;
          horizontalRightGap = 0;
        }
      }

      if (
        verticalBottomGap <= threshold &&
        verticalBottomGap <= verticalTopGap
      ) {
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
      if (
        horizontalRightGap <= threshold &&
        horizontalRightGap <= horizontalLeftGap
      ) {
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

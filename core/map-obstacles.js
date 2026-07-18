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
    h: snapToGrid(rect.h, gridSize),
  };
}

export function normalizeJoinedObstacleRects(rects) {
  const normalized = rects.map((rect) => ({ ...rect }));

  for (const horizontal of normalized.filter(isHorizontal)) {
    for (const vertical of normalized.filter((rect) => !isHorizontal(rect))) {
      const horizontalBottom = horizontal.y + horizontal.h;
      const verticalBottom = vertical.y + vertical.h;
      const horizontalRight = horizontal.x + horizontal.w;
      const verticalRight = vertical.x + vertical.w;

      if (
        !touchesOrOverlaps(
          horizontal.x,
          horizontalRight,
          vertical.x,
          verticalRight,
        ) ||
        !touchesOrOverlaps(
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
      const horizontalRightGap = Math.abs(verticalRight - horizontalRight);
      const horizontalLeftGap = Math.abs(vertical.x - horizontal.x);
      const threshold = Math.max(horizontal.h, vertical.w);

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

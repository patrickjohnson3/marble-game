export function rectBounds(rects) {
  if (!Array.isArray(rects) || rects.length === 0) return null;

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.w));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h));

  if (![bottom, left, right, top].every(Number.isFinite)) return null;

  return {
    bottom,
    left,
    right,
    top,
    height: bottom - top,
    width: right - left,
  };
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function circleRectContact(circle, rect, epsilon = 0) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distanceSq = dx * dx + dy * dy;

  return {
    intersects: distanceSq <= circle.r * circle.r + epsilon,
    dx,
    dy,
    distanceSq,
  };
}

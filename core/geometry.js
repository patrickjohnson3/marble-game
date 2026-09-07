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

export function circleFrom(point, radius = point.r) {
  return {
    x: point.x,
    y: point.y,
    r: radius,
  };
}

export function expandedCircle(circle, radiusScale) {
  return circleFrom(circle, circle.r * radiusScale);
}

export function pointInEllipsePatch(x, y, patch, shape, padding = 0) {
  if (!shape || !patch || patch.w <= 0 || patch.h <= 0) return false;
  const dx = x - (patch.x + patch.w * shape.centerX);
  const dy = y - (patch.y + patch.h * shape.centerY);
  const nx =
    (shape.cos * dx + shape.sin * dy) / (patch.w * shape.radiusX + padding);
  const ny =
    (-shape.sin * dx + shape.cos * dy) / (patch.h * shape.radiusY + padding);
  return nx * nx + ny * ny <= 1;
}

export function circleRectContact(circle, rect, epsilon = 0, target = {}) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distanceSq = dx * dx + dy * dy;

  target.intersects = distanceSq <= circle.r * circle.r + epsilon;
  target.dx = dx;
  target.dy = dy;
  target.distanceSq = distanceSq;
  return target;
}

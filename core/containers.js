import { KITCHEN_CUP_SPRITE } from "./map-elements.js";

// A small geometric description of the existing hollow prop. Solids remain in
// mapState.obstacles; the interior, roof mask and opening guides share this pose.
export function createCupContainer(source, clearance) {
  const sprite = KITCHEN_CUP_SPRITE;
  const width = Math.max(source.hitboxW ?? source.w, sprite.minWidth);
  const height = Math.max(source.hitboxH ?? source.h, sprite.minHeight);
  const scale = Math.min(width / sprite.width, height / sprite.height);
  const result = {
    source,
    width,
    height,
    centerX: source.x + source.w / 2,
    centerY: source.y + source.h / 2,
    cos: Math.cos(source.angle ?? 0),
    sin: Math.sin(source.angle ?? 0),
  };
  const bounds = (rect) => ({
    left: (rect.left - sprite.width / 2) * scale,
    top: (rect.top - sprite.height / 2) * scale,
    right: (rect.right - sprite.width / 2) * scale,
    bottom: (rect.bottom - sprite.height / 2) * scale,
  });
  result.interior = bounds(sprite.interior);
  result.cover = bounds(sprite.cover);
  const outside = bounds(sprite.exterior);
  const left = outside.left - clearance;
  const right = outside.right + clearance;
  const top = outside.top - clearance;
  const bottom = outside.bottom + clearance;
  const openingY = (result.interior.top + result.interior.bottom) / 2;
  // Five guides around this convex exterior, with the opening at index 2.
  // This is a bounded detour around a prop, not a room navigation mesh.
  result.waypoints = [
    [left, top],
    [right, top],
    [right, openingY],
    [right, bottom],
    [left, bottom],
  ].map(([x, y]) => ({
    x: result.centerX + result.cos * x - result.sin * y,
    y: result.centerY + result.sin * x + result.cos * y,
  }));
  result.openingApproach = result.waypoints[2];
  return result;
}

export function containerLocalPoint(container, x, y, out) {
  const dx = x - container.centerX;
  const dy = y - container.centerY;
  out.x = container.cos * dx + container.sin * dy;
  out.y = -container.sin * dx + container.cos * dy;
  return out;
}

const local = { x: 0, y: 0 };
export function pointInContainer(container, point) {
  containerLocalPoint(container, point.x, point.y, local);
  const b = container.interior;
  return (
    local.x >= b.left &&
    local.x <= b.right &&
    local.y >= b.top &&
    local.y <= b.bottom
  );
}

export function overlapsContainerCover(container, entity, radius = entity.r) {
  containerLocalPoint(container, entity.x, entity.y, local);
  const b = container.cover;
  const dx = Math.max(b.left - local.x, 0, local.x - b.right);
  const dy = Math.max(b.top - local.y, 0, local.y - b.bottom);
  return dx * dx + dy * dy < radius * radius;
}

const distances = new Float64Array(5);
const firstHops = new Int8Array(5);
const visited = new Uint8Array(5);
const edges = new Uint8Array(5);
export const containerNavigationPadding = 3;
const probeSpacing = containerNavigationPadding * 2;

function clearSegment(a, b, radius, state, clearAt) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / probeSpacing),
  );
  // Half-spacing inflation covers the intervals between overlapping probes.
  // The current roach's 24+3 radius still fits every radius-29 marble passage.
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (
      !clearAt(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t,
        radius + probeSpacing / 2,
        state,
      )
    )
      return false;
  }
  return true;
}

// Returns a safe waypoint in out, or false when ordinary pursuit should apply.
// Every edge is checked against the SAME live collision objects used by motion,
// including the movable sponge. An obstructed opening never bypasses a wall.
export function containerPursuitTarget(actor, target, state, clearAt, out) {
  for (const container of state.containers ?? []) {
    const actorInside = pointInContainer(container, actor);
    const targetInside = pointInContainer(container, target);
    // Only consider a detour when the direct segment passes near this prop.
    const dx = target.x - actor.x;
    const dy = target.y - actor.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq
      ? Math.max(
          0,
          Math.min(
            1,
            ((container.centerX - actor.x) * dx +
              (container.centerY - actor.y) * dy) /
              lengthSq,
          ),
        )
      : 0;
    if (
      !actorInside &&
      !targetInside &&
      Math.hypot(
        actor.x + dx * t - container.centerX,
        actor.y + dy * t - container.centerY,
      ) >
        Math.hypot(container.width, container.height) / 2 + actor.r
    )
      continue;
    if (clearSegment(actor, target, actor.r, state, clearAt)) {
      if (actorInside || targetInside) {
        // An intercept projected beyond a closed wall is not a valid target
        // inside a tight cavity. Pursue the live position through the opening.
        out.x = target.x;
        out.y = target.y;
        return true;
      }
      continue;
    }
    const points = container.waypoints;
    visited.fill(0);
    for (let i = 0; i < 5; i++) {
      distances[i] =
        (!actorInside || points[i] === container.openingApproach) &&
        clearSegment(actor, points[i], actor.r, state, clearAt)
          ? Math.hypot(points[i].x - actor.x, points[i].y - actor.y)
          : Infinity;
      firstHops[i] = i;
      edges[i] = clearSegment(
        points[i],
        points[(i + 1) % 5],
        actor.r,
        state,
        clearAt,
      )
        ? 1
        : 0;
    }
    for (let pass = 0; pass < 5; pass++) {
      let best = -1;
      for (let i = 0; i < 5; i++)
        if (
          !visited[i] &&
          Number.isFinite(distances[i]) &&
          (best < 0 || distances[i] < distances[best])
        )
          best = i;
      if (best < 0) break;
      visited[best] = 1;
      for (let direction = -1; direction <= 1; direction += 2) {
        const next = (best + direction + 5) % 5;
        if (!(direction > 0 ? edges[best] : edges[next])) continue;
        const distance =
          distances[best] +
          Math.hypot(
            points[next].x - points[best].x,
            points[next].y - points[best].y,
          );
        if (distance < distances[next]) {
          distances[next] = distance;
          firstHops[next] = firstHops[best];
        }
      }
    }
    let best = -1;
    let cost = Infinity;
    for (let i = 0; i < 5; i++) {
      if (
        (targetInside && points[i] !== container.openingApproach) ||
        !Number.isFinite(distances[i])
      )
        continue;
      const distance =
        distances[i] +
        Math.hypot(target.x - points[i].x, target.y - points[i].y);
      if (
        distance < cost &&
        clearSegment(points[i], target, actor.r, state, clearAt)
      ) {
        cost = distance;
        best = i;
      }
    }
    if (best >= 0) {
      out.x = points[firstHops[best]].x;
      out.y = points[firstHops[best]].y;
      return true;
    }
    // No valid guide route now: let existing collision-safe local avoidance
    // continue, and replan at the next ordinary decision.
  }
  return false;
}

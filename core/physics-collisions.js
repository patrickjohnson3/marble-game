import { circleRectContact } from "./geometry.js";

const defaultScrapeHapticScale = 0;
const defaultWallTangentialDragRetention = 1;
const defaultCollisionResolvePasses = 1;

export function marbleOverRect(marble, rect, epsilon = 0) {
  return circleRectContact(marble, rect, epsilon).intersects;
}

function orientedRectCenter(rect) {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  };
}

function localPointFromWorld(point, center, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: cos * dx + sin * dy,
    y: -sin * dx + cos * dy,
  };
}

function worldVectorFromLocal(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: cos * vector.x - sin * vector.y,
    y: sin * vector.x + cos * vector.y,
  };
}

function closestAxisNormal(localPoint, halfWidth, halfHeight, angle) {
  const distances = [
    { distance: localPoint.x + halfWidth, normal: { x: -1, y: 0 } },
    { distance: halfWidth - localPoint.x, normal: { x: 1, y: 0 } },
    { distance: localPoint.y + halfHeight, normal: { x: 0, y: -1 } },
    { distance: halfHeight - localPoint.y, normal: { x: 0, y: 1 } },
  ];
  let closest = distances[0];

  for (let i = 1; i < distances.length; i++) {
    if (distances[i].distance < closest.distance) closest = distances[i];
  }

  return {
    ...worldVectorFromLocal(closest.normal, angle),
    distance: closest.distance,
  };
}

export function circleOrientedRectContact(circle, rect, epsilon = 0) {
  const angle = rect.angle ?? 0;
  const center = orientedRectCenter(rect);
  const halfWidth = (rect.hitboxW ?? rect.w) / 2;
  const halfHeight = (rect.hitboxH ?? rect.h) / 2;
  const localPoint = localPointFromWorld(circle, center, angle);
  const closestX = Math.max(-halfWidth, Math.min(halfWidth, localPoint.x));
  const closestY = Math.max(-halfHeight, Math.min(halfHeight, localPoint.y));
  const localDelta = {
    x: localPoint.x - closestX,
    y: localPoint.y - closestY,
  };
  const worldDelta = worldVectorFromLocal(localDelta, angle);
  const distanceSq = worldDelta.x * worldDelta.x + worldDelta.y * worldDelta.y;
  const insideNormal =
    distanceSq === 0
      ? closestAxisNormal(localPoint, halfWidth, halfHeight, angle)
      : null;

  return {
    intersects: distanceSq <= circle.r * circle.r + epsilon,
    dx: worldDelta.x,
    dy: worldDelta.y,
    distanceSq,
    insideDistance: insideNormal?.distance ?? 0,
    insideNx: insideNormal?.x ?? 0,
    insideNy: insideNormal?.y ?? 0,
  };
}

function axisAlignedInsideNormal(marble, obstacle) {
  let nearestDistance = Math.abs(marble.x - obstacle.x);
  let nx = -1;
  let ny = 0;

  const rightDistance = Math.abs(obstacle.x + obstacle.w - marble.x);
  if (rightDistance < nearestDistance) {
    nearestDistance = rightDistance;
    nx = 1;
    ny = 0;
  }

  const topDistance = Math.abs(marble.y - obstacle.y);
  if (topDistance < nearestDistance) {
    nearestDistance = topDistance;
    nx = 0;
    ny = -1;
  }

  const bottomDistance = Math.abs(obstacle.y + obstacle.h - marble.y);
  if (bottomDistance < nearestDistance) {
    nearestDistance = bottomDistance;
    nx = 0;
    ny = 1;
  }

  return { distance: nearestDistance, nx, ny };
}

function obstacleContact(marble, obstacle, epsilon) {
  if (Number.isFinite(obstacle.angle)) {
    return circleOrientedRectContact(marble, obstacle, epsilon);
  }

  return circleRectContact(marble, obstacle, epsilon);
}

function collisionFeedback(normalSpeed, tangentSpeed, physics) {
  return (
    normalSpeed +
    tangentSpeed * (physics.scrapeHapticScale ?? defaultScrapeHapticScale)
  );
}

export function resolveObstacleCollision(
  marble,
  obstacle,
  physics,
  onImpact = () => {},
) {
  const contact = obstacleContact(
    marble,
    obstacle,
    physics.collisionDistanceSqEpsilon ?? 0,
  );

  if (!contact.intersects) return;

  let distance = Math.sqrt(contact.distanceSq);
  let nx = contact.dx / (distance || 1);
  let ny = contact.dy / (distance || 1);
  let overlap = marble.r - distance;

  if (distance === 0) {
    const insideNormal =
      Number.isFinite(contact.insideNx) && Number.isFinite(contact.insideNy)
        ? {
            distance: contact.insideDistance,
            nx: contact.insideNx,
            ny: contact.insideNy,
          }
        : axisAlignedInsideNormal(marble, obstacle);

    nx = insideNormal.nx;
    ny = insideNormal.ny;
    overlap = marble.r + insideNormal.distance;
  }

  marble.x += nx * overlap;
  marble.y += ny * overlap;

  const impact = marble.vx * nx + marble.vy * ny;
  if (impact < 0) {
    const tangent = Math.abs(marble.vx * -ny + marble.vy * nx);
    onImpact(collisionFeedback(-impact, tangent, physics));
    marble.vx -= (1 + physics.bounce) * impact * nx;
    marble.vy -= (1 + physics.bounce) * impact * ny;
  }
}

export function handleWallCollisions(
  { marble, bounds, intro, obstacles, physics },
  onImpact,
  collisionObstacles = obstacles,
) {
  const passes =
    physics.collisionResolvePasses ?? defaultCollisionResolvePasses;

  for (let pass = 0; pass < passes; pass++) {
    if (marble.x < bounds.left + marble.r) {
      onImpact(
        collisionFeedback(Math.abs(marble.vx), Math.abs(marble.vy), physics),
      );
      marble.x = bounds.left + marble.r;
      marble.vx = -marble.vx * physics.bounce;
      marble.vy *=
        physics.wallTangentialDragRetention ??
        defaultWallTangentialDragRetention;
    }
    if (marble.x > bounds.right - marble.r) {
      onImpact(
        collisionFeedback(Math.abs(marble.vx), Math.abs(marble.vy), physics),
      );
      marble.x = bounds.right - marble.r;
      marble.vx = -marble.vx * physics.bounce;
      marble.vy *=
        physics.wallTangentialDragRetention ??
        defaultWallTangentialDragRetention;
    }
    if (marble.y < bounds.top + marble.r) {
      onImpact(
        collisionFeedback(Math.abs(marble.vy), Math.abs(marble.vx), physics),
      );
      marble.y = bounds.top + marble.r;
      marble.vy = -marble.vy * physics.bounce;
      marble.vx *=
        physics.wallTangentialDragRetention ??
        defaultWallTangentialDragRetention;
    }
    if (marble.y > bounds.bottom - marble.r) {
      onImpact(
        collisionFeedback(Math.abs(marble.vy), Math.abs(marble.vx), physics),
      );
      marble.y = bounds.bottom - marble.r;
      marble.vy = -marble.vy * physics.bounce;
      marble.vx *=
        physics.wallTangentialDragRetention ??
        defaultWallTangentialDragRetention;
    }

    if (intro.released) {
      for (let i = 0; i < collisionObstacles.length; i++) {
        resolveObstacleCollision(
          marble,
          collisionObstacles[i],
          physics,
          onImpact,
        );
      }
    }
  }
}

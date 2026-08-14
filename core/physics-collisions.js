import { circleRectContact } from "./geometry.js";

const defaultScrapeHapticScale = 0;
const defaultWallTangentialDragRetention = 1;
const defaultCollisionResolvePasses = 1;
const defaultCollisionZeroDistanceEpsilon = 0;
const defaultCollisionPositionSlop = 0;
const marbleOverRectContact = {};

export function marbleOverRect(marble, rect, epsilon = 0) {
  return circleRectContact(marble, rect, epsilon, marbleOverRectContact)
    .intersects;
}

function setClosestAxisNormal(
  localX,
  localY,
  halfWidth,
  halfHeight,
  cos,
  sin,
  target,
) {
  let distance = localX + halfWidth;
  let normalX = -1;
  let normalY = 0;

  const rightDistance = halfWidth - localX;
  if (rightDistance < distance) {
    distance = rightDistance;
    normalX = 1;
    normalY = 0;
  }

  const topDistance = localY + halfHeight;
  if (topDistance < distance) {
    distance = topDistance;
    normalX = 0;
    normalY = -1;
  }

  const bottomDistance = halfHeight - localY;
  if (bottomDistance < distance) {
    distance = bottomDistance;
    normalX = 0;
    normalY = 1;
  }

  target.insideDistance = distance;
  target.insideNx = cos * normalX - sin * normalY;
  target.insideNy = sin * normalX + cos * normalY;
}

export function circleOrientedRectContact(
  circle,
  rect,
  epsilon = 0,
  target = {},
  zeroDistanceEpsilon = defaultCollisionZeroDistanceEpsilon,
) {
  const angle = rect.angle ?? 0;
  const centerX = rect.collisionCenterX ?? rect.x + rect.w / 2;
  const centerY = rect.collisionCenterY ?? rect.y + rect.h / 2;
  const halfWidth = rect.collisionHalfWidth ?? (rect.hitboxW ?? rect.w) / 2;
  const halfHeight = rect.collisionHalfHeight ?? (rect.hitboxH ?? rect.h) / 2;
  const cos = rect.collisionCos ?? Math.cos(angle);
  const sin = rect.collisionSin ?? Math.sin(angle);
  const dx = circle.x - centerX;
  const dy = circle.y - centerY;
  const localX = cos * dx + sin * dy;
  const localY = -sin * dx + cos * dy;
  const closestX = Math.max(-halfWidth, Math.min(halfWidth, localX));
  const closestY = Math.max(-halfHeight, Math.min(halfHeight, localY));
  const localDeltaX = localX - closestX;
  const localDeltaY = localY - closestY;
  const worldDeltaX = cos * localDeltaX - sin * localDeltaY;
  const worldDeltaY = sin * localDeltaX + cos * localDeltaY;
  const distanceSq = worldDeltaX * worldDeltaX + worldDeltaY * worldDeltaY;

  target.intersects = distanceSq <= circle.r * circle.r + epsilon;
  target.dx = worldDeltaX;
  target.dy = worldDeltaY;
  target.distanceSq = distanceSq;
  if (distanceSq <= zeroDistanceEpsilon * zeroDistanceEpsilon) {
    setClosestAxisNormal(
      localX,
      localY,
      halfWidth,
      halfHeight,
      cos,
      sin,
      target,
    );
  } else {
    target.insideDistance = 0;
    target.insideNx = 0;
    target.insideNy = 0;
  }
  return target;
}

export function circleObstacleContact(
  circle,
  obstacle,
  epsilon = 0,
  target = {},
  zeroDistanceEpsilon = defaultCollisionZeroDistanceEpsilon,
) {
  if (Number.isFinite(obstacle.angle)) {
    return circleOrientedRectContact(
      circle,
      obstacle,
      epsilon,
      target,
      zeroDistanceEpsilon,
    );
  }

  return circleRectContact(circle, obstacle, epsilon, target);
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

function obstacleContact(marble, obstacle, physics, target) {
  return circleObstacleContact(
    marble,
    obstacle,
    physics.collisionDistanceSqEpsilon ?? 0,
    target,
    physics.collisionZeroDistanceEpsilon ?? defaultCollisionZeroDistanceEpsilon,
  );
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
  contactScratch = {},
) {
  const contact = obstacleContact(marble, obstacle, physics, contactScratch);

  if (!contact.intersects) return;

  let distance = Math.sqrt(contact.distanceSq);
  let nx = contact.dx / (distance || 1);
  let ny = contact.dy / (distance || 1);
  const positionSlop =
    physics.collisionPositionSlop ?? defaultCollisionPositionSlop;
  let overlap = Math.max(0, marble.r - distance - positionSlop);

  if (
    distance <=
    (physics.collisionZeroDistanceEpsilon ??
      defaultCollisionZeroDistanceEpsilon)
  ) {
    if (
      Number.isFinite(contact.insideNx) &&
      Number.isFinite(contact.insideNy)
    ) {
      nx = contact.insideNx;
      ny = contact.insideNy;
      overlap = Math.max(0, marble.r + contact.insideDistance - positionSlop);
    } else {
      const insideNormal = axisAlignedInsideNormal(marble, obstacle);
      nx = insideNormal.nx;
      ny = insideNormal.ny;
      overlap = Math.max(0, marble.r + insideNormal.distance - positionSlop);
    }
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
  const contactScratch = {};

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
          contactScratch,
        );
      }
    }
  }
}

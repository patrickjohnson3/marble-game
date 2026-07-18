import { circleRectContact } from "./geometry.js";

export function marbleOverRect(marble, rect) {
  return circleRectContact(marble, rect).intersects;
}

function collisionFeedback(normalSpeed, tangentSpeed, physics) {
  return normalSpeed + tangentSpeed * (physics.scrapeHapticScale ?? 0);
}

export function resolveObstacleCollision(
  marble,
  obstacle,
  physics,
  onImpact = () => {},
) {
  const contact = circleRectContact(marble, obstacle);

  if (!contact.intersects) return;

  let distance = Math.sqrt(contact.distanceSq);
  let nx = contact.dx / (distance || 1);
  let ny = contact.dy / (distance || 1);
  let overlap = marble.r - distance;

  if (distance === 0) {
    const left = Math.abs(marble.x - obstacle.x);
    const right = Math.abs(obstacle.x + obstacle.w - marble.x);
    const top = Math.abs(marble.y - obstacle.y);
    const bottom = Math.abs(obstacle.y + obstacle.h - marble.y);
    const min = Math.min(left, right, top, bottom);
    nx = min === left ? -1 : min === right ? 1 : 0;
    ny = min === top ? -1 : min === bottom ? 1 : 0;
    overlap = marble.r + min;
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
) {
  if (marble.x < bounds.left + marble.r) {
    onImpact(
      collisionFeedback(Math.abs(marble.vx), Math.abs(marble.vy), physics),
    );
    marble.x = bounds.left + marble.r;
    marble.vx = -marble.vx * physics.bounce;
    marble.vy *= physics.wallTangentialFriction ?? 1;
  }
  if (marble.x > bounds.right - marble.r) {
    onImpact(
      collisionFeedback(Math.abs(marble.vx), Math.abs(marble.vy), physics),
    );
    marble.x = bounds.right - marble.r;
    marble.vx = -marble.vx * physics.bounce;
    marble.vy *= physics.wallTangentialFriction ?? 1;
  }
  if (marble.y < bounds.top + marble.r) {
    onImpact(
      collisionFeedback(Math.abs(marble.vy), Math.abs(marble.vx), physics),
    );
    marble.y = bounds.top + marble.r;
    marble.vy = -marble.vy * physics.bounce;
    marble.vx *= physics.wallTangentialFriction ?? 1;
  }
  if (marble.y > bounds.bottom - marble.r) {
    onImpact(
      collisionFeedback(Math.abs(marble.vy), Math.abs(marble.vx), physics),
    );
    marble.y = bounds.bottom - marble.r;
    marble.vy = -marble.vy * physics.bounce;
    marble.vx *= physics.wallTangentialFriction ?? 1;
  }

  if (intro.released) {
    obstacles.forEach((obstacle) => {
      resolveObstacleCollision(marble, obstacle, physics, onImpact);
    });
  }
}

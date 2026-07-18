import { circleRectContact } from "./geometry.js";

const defaultScrapeHapticScale = 0;
const defaultWallTangentialFriction = 1;

export function marbleOverRect(marble, rect, epsilon = 0) {
  return circleRectContact(marble, rect, epsilon).intersects;
}

function collisionFeedback(normalSpeed, tangentSpeed, physics) {
  return (
    normalSpeed +
    tangentSpeed * (physics.scrapeHapticScale ?? defaultScrapeHapticScale)
  );
}

function deepOverlapNormal(marble, obstacle) {
  const distances = [
    { edge: "left", value: Math.abs(marble.x - obstacle.x), nx: -1, ny: 0 },
    {
      edge: "right",
      value: Math.abs(obstacle.x + obstacle.w - marble.x),
      nx: 1,
      ny: 0,
    },
    { edge: "top", value: Math.abs(marble.y - obstacle.y), nx: 0, ny: -1 },
    {
      edge: "bottom",
      value: Math.abs(obstacle.y + obstacle.h - marble.y),
      nx: 0,
      ny: 1,
    },
  ];
  const nearest = distances.reduce((best, edge) =>
    edge.value < best.value ? edge : best,
  );

  return {
    nx: nearest.nx,
    ny: nearest.ny,
    overlap: marble.r + nearest.value,
  };
}

export function resolveObstacleCollision(
  marble,
  obstacle,
  physics,
  onImpact = () => {},
) {
  const contact = circleRectContact(
    marble,
    obstacle,
    physics.collisionEpsilon ?? 0,
  );

  if (!contact.intersects) return;

  let distance = Math.sqrt(contact.distanceSq);
  let nx = contact.dx / (distance || 1);
  let ny = contact.dy / (distance || 1);
  let overlap = marble.r - distance;

  if (distance === 0) {
    const deepOverlap = deepOverlapNormal(marble, obstacle);
    nx = deepOverlap.nx;
    ny = deepOverlap.ny;
    overlap = deepOverlap.overlap;
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
    marble.vy *=
      physics.wallTangentialFriction ?? defaultWallTangentialFriction;
  }
  if (marble.x > bounds.right - marble.r) {
    onImpact(
      collisionFeedback(Math.abs(marble.vx), Math.abs(marble.vy), physics),
    );
    marble.x = bounds.right - marble.r;
    marble.vx = -marble.vx * physics.bounce;
    marble.vy *=
      physics.wallTangentialFriction ?? defaultWallTangentialFriction;
  }
  if (marble.y < bounds.top + marble.r) {
    onImpact(
      collisionFeedback(Math.abs(marble.vy), Math.abs(marble.vx), physics),
    );
    marble.y = bounds.top + marble.r;
    marble.vy = -marble.vy * physics.bounce;
    marble.vx *=
      physics.wallTangentialFriction ?? defaultWallTangentialFriction;
  }
  if (marble.y > bounds.bottom - marble.r) {
    onImpact(
      collisionFeedback(Math.abs(marble.vy), Math.abs(marble.vx), physics),
    );
    marble.y = bounds.bottom - marble.r;
    marble.vy = -marble.vy * physics.bounce;
    marble.vx *=
      physics.wallTangentialFriction ?? defaultWallTangentialFriction;
  }

  if (intro.released) {
    obstacles.forEach((obstacle) => {
      resolveObstacleCollision(marble, obstacle, physics, onImpact);
    });
  }
}

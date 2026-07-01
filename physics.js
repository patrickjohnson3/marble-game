import { clamp, circleRectContact } from "./geometry.js";

function deadZone(value, threshold) {
  return Math.abs(value) < threshold ? 0 : value;
}

function updateTilt({ tilt, keyboard, camera, physics }, dt) {
  const nx = tilt.neutralX ?? tilt.rawX;
  const ny = tilt.neutralY ?? tilt.rawY;

  const sensorX = clamp(deadZone(tilt.rawX - nx, physics.deadZone), -physics.maxTilt, physics.maxTilt);
  const sensorY = clamp(deadZone(tilt.rawY - ny, physics.deadZone), -physics.maxTilt, physics.maxTilt);
  const targetX = keyboard.x ? keyboard.x * physics.keyboardTilt : sensorX;
  const targetY = keyboard.y ? keyboard.y * physics.keyboardTilt : sensorY;
  const c = Math.cos(-camera.rotation);
  const s = Math.sin(-camera.rotation);
  const worldTargetX = targetX * c - targetY * s;
  const worldTargetY = targetX * s + targetY * c;

  tilt.smoothX += (worldTargetX - tilt.smoothX) * (1 - Math.pow(1 - physics.smoothing, dt));
  tilt.smoothY += (worldTargetY - tilt.smoothY) * (1 - Math.pow(1 - physics.smoothing, dt));
}

function updateVelocity({ marble, tilt, physics }, dt) {
  marble.vx += tilt.smoothX * physics.accel * dt;
  marble.vy += tilt.smoothY * physics.accel * dt;

  const drag = Math.pow(physics.friction, dt);
  marble.vx = clamp(marble.vx * drag, -physics.maxSpeed, physics.maxSpeed);
  marble.vy = clamp(marble.vy * drag, -physics.maxSpeed, physics.maxSpeed);

  const speed = Math.hypot(marble.vx, marble.vy);
  const tiltMagnitude = Math.hypot(tilt.smoothX, tilt.smoothY);
  if (speed < (physics.settleSpeed ?? 0) && tiltMagnitude < (physics.settleTilt ?? 0)) {
    marble.vx = 0;
    marble.vy = 0;
  }
}

function updatePosition(marble, dt) {
  marble.x += marble.vx * dt;
  marble.y += marble.vy * dt;
}

export function marbleOverRect(marble, rect) {
  return circleRectContact(marble, rect).intersects;
}

function isOverRoughPatch({ marble, intro, roughPatches }) {
  return intro.released && roughPatches.some((rect) => marbleOverRect(marble, rect));
}

function applySurfaceDrag(context, dt) {
  if (!isOverRoughPatch(context)) return;

  const drag = Math.pow(context.physics.roughPatchFriction, dt);
  context.marble.vx *= drag;
  context.marble.vy *= drag;
}

function collisionFeedback(normalSpeed, tangentSpeed, physics) {
  return normalSpeed + tangentSpeed * (physics.scrapeHapticScale ?? 0);
}

export function resolveObstacleCollision(marble, obstacle, physics, onImpact = () => {}) {
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

function handleWallCollisions({ marble, bounds, intro, obstacles, physics }, onImpact) {
  if (marble.x < bounds.left + marble.r) {
    onImpact(collisionFeedback(Math.abs(marble.vx), Math.abs(marble.vy), physics));
    marble.x = bounds.left + marble.r;
    marble.vx = -marble.vx * physics.bounce;
  }
  if (marble.x > bounds.right - marble.r) {
    onImpact(collisionFeedback(Math.abs(marble.vx), Math.abs(marble.vy), physics));
    marble.x = bounds.right - marble.r;
    marble.vx = -marble.vx * physics.bounce;
  }
  if (marble.y < bounds.top + marble.r) {
    onImpact(collisionFeedback(Math.abs(marble.vy), Math.abs(marble.vx), physics));
    marble.y = bounds.top + marble.r;
    marble.vy = -marble.vy * physics.bounce;
  }
  if (marble.y > bounds.bottom - marble.r) {
    onImpact(collisionFeedback(Math.abs(marble.vy), Math.abs(marble.vx), physics));
    marble.y = bounds.bottom - marble.r;
    marble.vy = -marble.vy * physics.bounce;
  }

  if (intro.released) {
    obstacles.forEach((obstacle) => {
      resolveObstacleCollision(marble, obstacle, physics, onImpact);
    });
  }
}

function handleSurfaceFeedback({ marble, intro, roughPatches }, onSurface) {
  if (!isOverRoughPatch({ marble, intro, roughPatches })) return;

  onSurface(Math.hypot(marble.vx, marble.vy));
}

function physicsStep(context, dt, feedback) {
  updateVelocity(context, dt);
  applySurfaceDrag(context, dt);
  updatePosition(context.marble, dt);
  handleWallCollisions(context, feedback.onImpact);
  handleSurfaceFeedback(context, feedback.onSurface);
}

export function updatePhysics(context, dt, feedback) {
  const speed = Math.hypot(context.marble.vx, context.marble.vy);
  const steps = Math.max(1, Math.ceil((speed * dt) / context.physics.maxStepDistance));
  const stepDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    physicsStep(context, stepDt, feedback);
  }
}

export function updatePhysicsInput(context, dt) {
  updateTilt(context, dt);
}

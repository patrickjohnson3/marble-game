import { clamp } from "./geometry.js";
import {
  handleWallCollisions,
  marbleOverRect,
  resolveObstacleCollision
} from "./physics-collisions.js";

export { marbleOverRect, resolveObstacleCollision };

function deadZone(value, threshold) {
  return Math.abs(value) < threshold ? 0 : value;
}

function curveTilt(value, maxTilt, curve = 1) {
  if (value === 0 || curve === 1) return value;

  const normalized = clamp(Math.abs(value) / maxTilt, 0, 1);
  return Math.sign(value) * maxTilt * Math.pow(normalized, curve);
}

function updateTilt({ tilt, keyboard, camera, physics }, dt) {
  const nx = tilt.neutralX ?? tilt.rawX;
  const ny = tilt.neutralY ?? tilt.rawY;

  const rawSensorX = clamp(deadZone(tilt.rawX - nx, physics.deadZone), -physics.maxTilt, physics.maxTilt);
  const rawSensorY = clamp(deadZone(tilt.rawY - ny, physics.deadZone), -physics.maxTilt, physics.maxTilt);
  const sensorX = curveTilt(rawSensorX, physics.maxTilt, physics.tiltCurve);
  const sensorY = curveTilt(rawSensorY, physics.maxTilt, physics.tiltCurve);
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
  marble.vx *= drag;
  marble.vy *= drag;

  let speed = Math.hypot(marble.vx, marble.vy);
  if (speed > physics.maxSpeed) {
    const easedSpeed = physics.maxSpeed +
      (speed - physics.maxSpeed) * Math.pow(physics.maxSpeedEase ?? 0, dt);
    const scale = easedSpeed / speed;
    marble.vx *= scale;
    marble.vy *= scale;
    speed = easedSpeed;
  }

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

function isOverRoughPatch({ marble, intro, roughPatches }) {
  return intro.released && roughPatches.some((rect) => marbleOverRect(marble, rect));
}

function applySurfaceDrag(context, dt, overRoughPatch) {
  if (!overRoughPatch) return;

  const drag = Math.pow(context.physics.roughPatchFriction, dt);
  context.marble.vx *= drag;
  context.marble.vy *= drag;
}

function handleSurfaceFeedback({ marble }, onSurface, overRoughPatch) {
  if (!overRoughPatch) return;

  onSurface(Math.hypot(marble.vx, marble.vy));
}

function physicsStep(context, dt, feedback) {
  updateVelocity(context, dt);
  const overRoughPatch = isOverRoughPatch(context);
  applySurfaceDrag(context, dt, overRoughPatch);
  updatePosition(context.marble, dt);
  handleWallCollisions(context, feedback.onImpact);
  handleSurfaceFeedback(context, feedback.onSurface, overRoughPatch);
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

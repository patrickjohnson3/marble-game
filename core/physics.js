import { clamp } from "./geometry.js";
import {
  handleWallCollisions,
  marbleOverRect,
} from "./physics-collisions.js";

const defaultMaxSpeedEase = 0;
const defaultSettleSpeed = 0;
const defaultSettleTilt = 0;
const defaultMaxPhysicsSubsteps = Number.POSITIVE_INFINITY;

function deadZone(value, threshold) {
  return Math.abs(value) < threshold ? 0 : value;
}

function curveTilt(value, maxTilt, curve = 1) {
  if (value === 0 || curve === 1) return value;

  const normalized = clamp(Math.abs(value) / maxTilt, 0, 1);
  return Math.sign(value) * maxTilt * Math.pow(normalized, curve);
}

function updateTilt({ tilt, keyboard, physics }, dt) {
  const nx = tilt.neutralX ?? tilt.rawX;
  const ny = tilt.neutralY ?? tilt.rawY;

  const rawSensorX = clamp(
    deadZone(tilt.rawX - nx, physics.deadZone),
    -physics.maxTilt,
    physics.maxTilt,
  );
  const rawSensorY = clamp(
    deadZone(tilt.rawY - ny, physics.deadZone),
    -physics.maxTilt,
    physics.maxTilt,
  );
  const sensorX = curveTilt(rawSensorX, physics.maxTilt, physics.tiltCurve);
  const sensorY = curveTilt(rawSensorY, physics.maxTilt, physics.tiltCurve);
  const targetX = keyboard.x ? keyboard.x * physics.keyboardTilt : sensorX;
  const targetY = keyboard.y ? keyboard.y * physics.keyboardTilt : sensorY;
  tilt.smoothX +=
    (targetX - tilt.smoothX) * (1 - Math.pow(1 - physics.smoothing, dt));
  tilt.smoothY +=
    (targetY - tilt.smoothY) * (1 - Math.pow(1 - physics.smoothing, dt));
}

function updateVelocity(
  { marble, tilt, physics },
  dt,
  friction = physics.friction,
) {
  marble.vx += tilt.smoothX * physics.accel * dt;
  marble.vy += tilt.smoothY * physics.accel * dt;

  const drag = Math.pow(friction, dt);
  marble.vx *= drag;
  marble.vy *= drag;

  let speed = Math.hypot(marble.vx, marble.vy);
  if (speed > physics.maxSpeed) {
    const easedSpeed =
      physics.maxSpeed +
      (speed - physics.maxSpeed) *
        Math.pow(physics.maxSpeedEase ?? defaultMaxSpeedEase, dt);
    const scale = easedSpeed / speed;
    marble.vx *= scale;
    marble.vy *= scale;
    speed = easedSpeed;
  }

  const tiltMagnitude = Math.hypot(tilt.smoothX, tilt.smoothY);
  if (
    speed < (physics.settleSpeed ?? defaultSettleSpeed) &&
    tiltMagnitude < (physics.settleTilt ?? defaultSettleTilt)
  ) {
    marble.vx = 0;
    marble.vy = 0;
  }
}

function updatePosition(marble, dt) {
  marble.x += marble.vx * dt;
  marble.y += marble.vy * dt;
}

function isOverRoughPatch(marble, intro, roughPatches, physics) {
  return (
    intro.released &&
    roughPatches.some((rect) =>
      marbleOverRect(marble, rect, physics.collisionEpsilon ?? 0),
    )
  );
}

function isOverIcePatch(marble, intro, icePatches, physics) {
  return (
    intro.released &&
    icePatches.some((rect) =>
      marbleOverRect(marble, rect, physics.collisionEpsilon ?? 0),
    )
  );
}

function icePatchCandidates({ marble, icePatches, icePatchIndex }) {
  return icePatchIndex?.queryCircle(marble) ?? icePatches ?? [];
}

function roughPatchCandidates({ marble, roughPatches, roughPatchIndex }) {
  return roughPatchIndex?.queryCircle(marble) ?? roughPatches;
}

function obstacleCandidates({ marble, obstacles, obstacleIndex }) {
  return obstacleIndex?.queryCircle(marble) ?? obstacles;
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
  const overIcePatch = isOverIcePatch(
    context.marble,
    context.intro,
    icePatchCandidates(context),
    context.physics,
  );
  updateVelocity(
    context,
    dt,
    overIcePatch ? context.physics.icePatchFriction : context.physics.friction,
  );
  const overRoughPatchBeforeMove = isOverRoughPatch(
    context.marble,
    context.intro,
    roughPatchCandidates(context),
    context.physics,
  );
  updatePosition(context.marble, dt);
  const overRoughPatchAfterMove = isOverRoughPatch(
    context.marble,
    context.intro,
    roughPatchCandidates(context),
    context.physics,
  );
  const overRoughPatch = overRoughPatchBeforeMove || overRoughPatchAfterMove;
  applySurfaceDrag(context, dt, overRoughPatch);
  const obstacles = context.obstacles;
  context.obstacles = obstacleCandidates(context);
  handleWallCollisions(context, feedback.onImpact);
  context.obstacles = obstacles;
  handleSurfaceFeedback(context, feedback.onSurface, overRoughPatch);
}

export function updatePhysics(context, dt, feedback) {
  const speed = Math.hypot(context.marble.vx, context.marble.vy);
  const uncappedSteps = Math.max(
    1,
    Math.ceil((speed * dt) / context.physics.maxStepDistance),
  );
  const steps = Math.min(
    uncappedSteps,
    context.physics.maxPhysicsSubsteps ?? defaultMaxPhysicsSubsteps,
  );
  const stepDt = dt / steps;

  for (let i = 0; i < steps; i++) {
    physicsStep(context, stepDt, feedback);
  }
}

export function updatePhysicsInput(context, dt) {
  updateTilt(context, dt);
}

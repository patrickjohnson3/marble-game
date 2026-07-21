import { clamp } from "./geometry.js";
import { handleWallCollisions, marbleOverRect } from "./physics-collisions.js";

const defaultMaxSpeedEase = 0;
const defaultSettleSpeed = 0;
const defaultSettleTilt = 0;
const defaultMaxPhysicsSubsteps = Number.POSITIVE_INFINITY;
const defaultMaxStepDistance = 1;
export const SURFACE_TYPES = Object.freeze({
  floor: "floor",
  icePatch: "icePatch",
  roughPatch: "roughPatch",
});

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
  const smoothingStep = 1 - Math.pow(1 - physics.smoothing, dt);
  tilt.smoothX += (targetX - tilt.smoothX) * smoothingStep;
  tilt.smoothY += (targetY - tilt.smoothY) * smoothingStep;
}

function updateVelocity(
  { marble, tilt, physics },
  dt,
  drag,
  maxSpeedEaseFactor,
) {
  marble.vx += tilt.smoothX * physics.accel * dt;
  marble.vy += tilt.smoothY * physics.accel * dt;

  marble.vx *= drag;
  marble.vy *= drag;

  let speed = Math.hypot(marble.vx, marble.vy);
  if (speed > physics.maxSpeed) {
    const easedSpeed =
      physics.maxSpeed + (speed - physics.maxSpeed) * maxSpeedEaseFactor;
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

function finitePositive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isOverRoughPatch(marble, intro, roughPatches, physics) {
  return (
    intro.released &&
    roughPatches.some((rect) =>
      marbleOverRect(marble, rect, physics.collisionDistanceSqEpsilon ?? 0),
    )
  );
}

function isOverIcePatch(marble, intro, icePatches, physics) {
  return (
    intro.released &&
    icePatches.some((rect) =>
      marbleOverRect(marble, rect, physics.collisionDistanceSqEpsilon ?? 0),
    )
  );
}

function createPhysicsScratch() {
  return {
    frameFactors: {
      baseDrag: 1,
      icePatchDrag: 1,
      maxSpeedEase: defaultMaxSpeedEase,
      roughPatchDrag: 1,
    },
    icePatchCandidates: [],
    icePatchSeen: new Set(),
    obstacleCandidates: [],
    obstacleSeen: new Set(),
    roughPatchCandidates: [],
    roughPatchSeen: new Set(),
    roughPatchQueryCircle: { x: 0, y: 0, r: 0 },
  };
}

function scratch(context) {
  context.physicsScratch ??= createPhysicsScratch();
  return context.physicsScratch;
}

function queryCandidates(index, circle, fallback, matches, seen) {
  if (!index?.queryCircleInto) return fallback ?? [];
  return index.queryCircleInto(circle, matches, seen);
}

function icePatchCandidates(context, scratch) {
  return queryCandidates(
    context.icePatchIndex,
    context.marble,
    context.icePatches,
    scratch.icePatchCandidates,
    scratch.icePatchSeen,
  );
}

function obstacleCandidates(context, scratch) {
  return queryCandidates(
    context.obstacleIndex,
    context.marble,
    context.obstacles,
    scratch.obstacleCandidates,
    scratch.obstacleSeen,
  );
}

function roughPatchCandidates(context, dt, scratch) {
  const distance = Math.hypot(context.marble.vx * dt, context.marble.vy * dt);
  scratch.roughPatchQueryCircle.x =
    context.marble.x + (context.marble.vx * dt) / 2;
  scratch.roughPatchQueryCircle.y =
    context.marble.y + (context.marble.vy * dt) / 2;
  scratch.roughPatchQueryCircle.r = context.marble.r + distance / 2;

  return queryCandidates(
    context.roughPatchIndex,
    scratch.roughPatchQueryCircle,
    context.roughPatches,
    scratch.roughPatchCandidates,
    scratch.roughPatchSeen,
  );
}

function applySurfaceDrag(context, overRoughPatch, factors) {
  if (!overRoughPatch) return;

  context.marble.vx *= factors.roughPatchDrag;
  context.marble.vy *= factors.roughPatchDrag;
}

function handleSurfaceFeedback({ marble }, onSurface, overRoughPatch) {
  if (!overRoughPatch) return;

  onSurface(Math.hypot(marble.vx, marble.vy));
}

function surfaceType({ overIcePatch, overRoughPatch }) {
  if (overRoughPatch) return SURFACE_TYPES.roughPatch;
  if (overIcePatch) return SURFACE_TYPES.icePatch;
  return SURFACE_TYPES.floor;
}

function physicsStep(context, dt, feedback) {
  const physicsScratch = scratch(context);
  const factors = physicsScratch.frameFactors;
  const overIcePatch = isOverIcePatch(
    context.marble,
    context.intro,
    icePatchCandidates(context, physicsScratch),
    context.physics,
  );
  updateVelocity(
    context,
    dt,
    overIcePatch ? factors.icePatchDrag : factors.baseDrag,
    factors.maxSpeedEase,
  );
  const roughCandidates = roughPatchCandidates(context, dt, physicsScratch);
  const overRoughPatchBeforeMove = isOverRoughPatch(
    context.marble,
    context.intro,
    roughCandidates,
    context.physics,
  );
  updatePosition(context.marble, dt);
  const overRoughPatchAfterMove = isOverRoughPatch(
    context.marble,
    context.intro,
    roughCandidates,
    context.physics,
  );
  const overRoughPatch = overRoughPatchBeforeMove || overRoughPatchAfterMove;
  feedback.onTerrain?.(surfaceType({ overIcePatch, overRoughPatch }));
  applySurfaceDrag(context, overRoughPatch, factors);
  handleWallCollisions(
    context,
    feedback.onImpact,
    obstacleCandidates(context, physicsScratch),
  );
  handleSurfaceFeedback(context, feedback.onSurface, overRoughPatch);
}

export function updatePhysics(context, dt, feedback) {
  if (!Number.isFinite(dt) || dt <= 0) return;

  const maxStepDistance = finitePositive(
    context.physics.maxStepDistance,
    defaultMaxStepDistance,
  );
  const maxPhysicsSubsteps = finitePositive(
    context.physics.maxPhysicsSubsteps ?? defaultMaxPhysicsSubsteps,
    defaultMaxPhysicsSubsteps,
  );
  const speed = Math.hypot(context.marble.vx, context.marble.vy);
  const uncappedSteps = Math.max(1, Math.ceil((speed * dt) / maxStepDistance));
  const steps = Math.min(uncappedSteps, maxPhysicsSubsteps);
  const stepDt = dt / steps;
  const physicsScratch = scratch(context);
  physicsScratch.frameFactors.baseDrag = Math.pow(
    context.physics.baseDragRetention,
    stepDt,
  );
  physicsScratch.frameFactors.icePatchDrag = Math.pow(
    context.physics.icePatchDragRetention,
    stepDt,
  );
  physicsScratch.frameFactors.roughPatchDrag = Math.pow(
    context.physics.roughPatchDragRetention,
    stepDt,
  );
  physicsScratch.frameFactors.maxSpeedEase = Math.pow(
    context.physics.maxSpeedEase ?? defaultMaxSpeedEase,
    stepDt,
  );

  for (let i = 0; i < steps; i++) {
    physicsStep(context, stepDt, feedback);
  }
}

export function updatePhysicsInput(context, dt) {
  updateTilt(context, dt);
}

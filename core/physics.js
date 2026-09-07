import { clamp } from "./geometry.js";
import {
  ELLIPTICAL_SURFACE_SHAPES,
  MAP_ELEMENT_TYPES,
} from "./map-elements.js";
import { handleWallCollisions, marbleOverRect } from "./physics-collisions.js";

const defaultOverspeedRetention = 0;
const defaultSettleSpeed = 0;
const defaultSettleTilt = 0;
const defaultMaxPhysicsSubsteps = Number.POSITIVE_INFINITY;
const defaultMaxStepDistance = 1;
export const SURFACE_TYPES = Object.freeze({
  floor: "floor",
  gooPatch: MAP_ELEMENT_TYPES.gooPatch,
  icePatch: MAP_ELEMENT_TYPES.icePatch,
  roughPatch: MAP_ELEMENT_TYPES.roughPatch,
  hazardPatch: MAP_ELEMENT_TYPES.hazardPatch,
  waterPatch: MAP_ELEMENT_TYPES.waterPatch,
});
export const PRE_MOVE_SURFACE_TYPES = Object.freeze([SURFACE_TYPES.icePatch]);
export const SWEPT_SURFACE_TYPES = Object.freeze([
  SURFACE_TYPES.gooPatch,
  SURFACE_TYPES.roughPatch,
  SURFACE_TYPES.waterPatch,
  SURFACE_TYPES.hazardPatch,
]);

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

function updateMotion(
  { marble, tilt, physics },
  dt,
  drag,
  dragRetention,
  surfaceRetention,
  overspeedRetentionFactor,
) {
  const ax = tilt.smoothX * physics.accel;
  const ay = tilt.smoothY * physics.accel;
  const retention = dragRetention * surfaceRetention;
  // Keep the reference update as the fallback for singular or overflowing
  // fractional motion. Do not mutate the marble until a complete result exists.
  let vx = (marble.vx + ax * dt) * drag;
  let vy = (marble.vy + ay * dt) * drag;
  let dx = vx * dt;
  let dy = vy * dt;

  if (dt !== 1 && retention > 0) {
    // Extend the existing 60 Hz map, v' = q(v + a), x' = x + b(v + a),
    // to fractional steps (b = base/ice retention, q = b * surface retention).
    // Exponentiating drag alone does not integrate its interaction with force
    // or displacement. These sums compose exactly for constant force/terrain.
    const loss = 1 - retention;
    let velocitySum;
    let accelerationSum;
    if (Math.abs(loss) * Math.max(1, dt) < 1e-5) {
      // Binomial limits avoid cancellation near q=1, including no drag.
      const slope = (dt - 1) * loss;
      const curve = slope * (dt - 2) * loss;
      velocitySum = dt * (1 - slope / 2 + curve / 6);
      accelerationSum = (dt * (dt + 1) * (1 - slope / 3 + curve / 12)) / 2;
    } else {
      velocitySum = -Math.expm1(dt * Math.log(retention)) / loss;
      accelerationSum = (dt - retention * velocitySum) / loss;
    }
    const scaledAccelerationStep = Math.pow(retention, 1 - dt) * velocitySum;
    const candidateVx = (marble.vx + ax * scaledAccelerationStep) * drag;
    const candidateVy = (marble.vy + ay * scaledAccelerationStep) * drag;
    const candidateDx =
      dragRetention * (velocitySum * marble.vx + accelerationSum * ax);
    const candidateDy =
      dragRetention * (velocitySum * marble.vy + accelerationSum * ay);
    if (
      // A finite magnitude also keeps the subsequent speed cap well-defined.
      Number.isFinite(Math.hypot(candidateVx, candidateVy)) &&
      Number.isFinite(candidateDx) &&
      Number.isFinite(candidateDy)
    ) {
      vx = candidateVx;
      vy = candidateVy;
      dx = candidateDx;
      dy = candidateDy;
    }
  }

  marble.vx = vx;
  marble.vy = vy;

  let speed = Math.hypot(marble.vx, marble.vy);
  if (speed > physics.maxSpeed) {
    const easedSpeed =
      physics.maxSpeed + (speed - physics.maxSpeed) * overspeedRetentionFactor;
    const scale = easedSpeed / speed;
    marble.vx *= scale;
    marble.vy *= scale;
    // The integrated displacement is not proportional to endpoint velocity.
    // Capped steps keep the original movement from the capped velocity.
    dx = marble.vx * dt;
    dy = marble.vy * dt;
    speed = easedSpeed;
  }

  const tiltMagnitude = Math.hypot(tilt.smoothX, tilt.smoothY);
  if (
    speed < (physics.settleSpeed ?? defaultSettleSpeed) &&
    tiltMagnitude < (physics.settleTilt ?? defaultSettleTilt)
  ) {
    marble.vx = 0;
    marble.vy = 0;
    return;
  }

  marble.x += dx;
  marble.y += dy;
}

function finitePositive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function physicsSubstepCount(speed, dt, physics) {
  const maxStepDistance = finitePositive(
    physics.maxStepDistance,
    defaultMaxStepDistance,
  );
  const maxPhysicsSubsteps = finitePositive(
    physics.maxPhysicsSubsteps ?? defaultMaxPhysicsSubsteps,
    defaultMaxPhysicsSubsteps,
  );
  // The split count intentionally uses incoming speed only. Acceleration within
  // the frame is applied inside the substeps so current gameplay tuning stays
  // stable across fast and slow devices.
  const uncappedSteps = Math.max(1, Math.ceil((speed * dt) / maxStepDistance));

  return Math.min(uncappedSteps, maxPhysicsSubsteps);
}

function isOverTerrainPatch(marble, intro, patches, physics) {
  if (!intro.released) return false;

  const epsilon = physics.collisionDistanceSqEpsilon ?? 0;
  for (let i = 0; i < patches.length; i++) {
    if (marbleOverRect(marble, patches[i], epsilon)) return true;
  }
  return false;
}

function createPhysicsScratch() {
  return {
    collisionContact: {},
    frameFactors: {
      baseDrag: 1,
      gooPatchDrag: 1,
      icePatchDrag: 1,
      overspeedRetention: defaultOverspeedRetention,
      roughPatchDrag: 1,
      waterPatchDrag: 1,
    },
    previousTerrainMarble: { x: 0, y: 0, r: 0 },
    surfaceHits: {
      gooPatch: false,
      hazardPatch: false,
      icePatch: false,
      roughPatch: false,
      waterPatch: false,
    },
  };
}

function scratch(context) {
  context.physicsScratch ??= createPhysicsScratch();
  return context.physicsScratch;
}

function terrainByType(context, type) {
  return (
    context.mapState.terrainByType[type] ?? {
      elements: [],
    }
  );
}

function terrainCandidates(context, type) {
  return terrainByType(context, type).elements;
}

function updatePreviousTerrainMarble(context, scratch) {
  scratch.previousTerrainMarble.x = context.marble.x;
  scratch.previousTerrainMarble.y = context.marble.y;
  scratch.previousTerrainMarble.r = context.marble.r;
}

function pointInExpandedRect(point, rect, padding) {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.w + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.h + padding
  );
}

function segmentIntersectsExpandedRect(start, end, rect, padding) {
  if (
    pointInExpandedRect(start, rect, padding) ||
    pointInExpandedRect(end, rect, padding)
  ) {
    return true;
  }

  const left = rect.x - padding;
  const right = rect.x + rect.w + padding;
  const top = rect.y - padding;
  const bottom = rect.y + rect.h + padding;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let tMin = 0;
  let tMax = 1;

  if (dx === 0) {
    if (start.x < left || start.x > right) return false;
  } else {
    const inverseVelocity = 1 / dx;
    let near = (left - start.x) * inverseVelocity;
    let far = (right - start.x) * inverseVelocity;
    if (near > far) [near, far] = [far, near];
    tMin = Math.max(tMin, near);
    tMax = Math.min(tMax, far);
    if (tMin > tMax) return false;
  }

  if (dy === 0) {
    if (start.y < top || start.y > bottom) return false;
  } else {
    const inverseVelocity = 1 / dy;
    let near = (top - start.y) * inverseVelocity;
    let far = (bottom - start.y) * inverseVelocity;
    if (near > far) [near, far] = [far, near];
    tMin = Math.max(tMin, near);
    tMax = Math.min(tMax, far);
    if (tMin > tMax) return false;
  }

  return true;
}

function segmentIntersectsExpandedEllipse(start, end, patch, shape, padding) {
  const centerX = patch.x + patch.w * shape.centerX;
  const centerY = patch.y + patch.h * shape.centerY;
  const radiusX = patch.w * shape.radiusX + padding;
  const radiusY = patch.h * shape.radiusY + padding;
  const startDx = start.x - centerX;
  const startDy = start.y - centerY;
  const endDx = end.x - centerX;
  const endDy = end.y - centerY;
  const startX = (shape.cos * startDx + shape.sin * startDy) / radiusX;
  const startY = (-shape.sin * startDx + shape.cos * startDy) / radiusY;
  const endX = (shape.cos * endDx + shape.sin * endDy) / radiusX;
  const endY = (-shape.sin * endDx + shape.cos * endDy) / radiusY;
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSq = dx * dx + dy * dy;
  const closestT =
    lengthSq > 0 ? clamp(-(startX * dx + startY * dy) / lengthSq, 0, 1) : 0;
  const closestX = startX + dx * closestT;
  const closestY = startY + dy * closestT;

  return closestX * closestX + closestY * closestY <= 1;
}

function sweptOverTerrainPatch(start, end, intro, patches, physics, type) {
  if (!intro.released) return false;

  const epsilon = Math.max(physics.collisionDistanceSqEpsilon ?? 0, 0);
  const padding = Math.sqrt(end.r * end.r + epsilon);
  const shape = ELLIPTICAL_SURFACE_SHAPES[type];
  for (let i = 0; i < patches.length; i++) {
    const patch = patches[i];
    const intersects = shape
      ? segmentIntersectsExpandedEllipse(start, end, patch, shape, padding)
      : segmentIntersectsExpandedRect(start, end, patch, padding);
    if (intersects) return true;
  }
  return false;
}

function applySurfaceDrag(context, hits, factors) {
  if (hits.gooPatch) {
    context.marble.vx *= factors.gooPatchDrag;
    context.marble.vy *= factors.gooPatchDrag;
  }

  if (hits.roughPatch) {
    context.marble.vx *= factors.roughPatchDrag;
    context.marble.vy *= factors.roughPatchDrag;
  }

  if (hits.waterPatch) {
    context.marble.vx *= factors.waterPatchDrag;
    context.marble.vy *= factors.waterPatchDrag;
  }
}

function handleSurfaceFeedback({ marble }, onSurface, surfaceType) {
  if (
    surfaceType !== SURFACE_TYPES.gooPatch &&
    surfaceType !== SURFACE_TYPES.roughPatch &&
    surfaceType !== SURFACE_TYPES.waterPatch
  ) {
    return;
  }

  onSurface(Math.hypot(marble.vx, marble.vy), surfaceType);
}

function surfaceType(hits) {
  if (hits.gooPatch) return SURFACE_TYPES.gooPatch;
  if (hits.roughPatch) return SURFACE_TYPES.roughPatch;
  if (hits.waterPatch) return SURFACE_TYPES.waterPatch;
  if (hits.icePatch) return SURFACE_TYPES.icePatch;
  return SURFACE_TYPES.floor;
}

function updateSurfaceHits(context, physicsScratch) {
  const hits = physicsScratch.surfaceHits;
  const previous = physicsScratch.previousTerrainMarble;

  for (let i = 0; i < SWEPT_SURFACE_TYPES.length; i++) {
    const type = SWEPT_SURFACE_TYPES[i];
    hits[type] = sweptOverTerrainPatch(
      previous,
      context.marble,
      context.intro,
      terrainCandidates(context, type),
      context.physics,
      type,
    );
  }

  return hits;
}

function physicsStep(context, dt, feedback) {
  const physicsScratch = scratch(context);
  const factors = physicsScratch.frameFactors;
  // Ice keeps its historical handling: it affects the velocity update using
  // the marble position at the start of the substep. Other surfaces are swept
  // after movement so entry feedback and drag still catch thin patches.
  const overIcePatch = isOverTerrainPatch(
    context.marble,
    context.intro,
    terrainCandidates(context, SURFACE_TYPES.icePatch),
    context.physics,
  );
  updatePreviousTerrainMarble(context, physicsScratch);
  let surfaceRetention = 1;
  if (dt !== 1) {
    // Use the same shapes as the sweep to integrate terrain already under the
    // marble. Newly entered patches still apply their drag after movement.
    const startingHits = updateSurfaceHits(context, physicsScratch);
    if (startingHits.gooPatch)
      surfaceRetention *= context.physics.gooPatchDragRetention ?? 1;
    if (startingHits.roughPatch)
      surfaceRetention *= context.physics.roughPatchDragRetention;
    if (startingHits.waterPatch)
      surfaceRetention *= context.physics.waterPatchDragRetention ?? 1;
  }
  updateMotion(
    context,
    dt,
    overIcePatch ? factors.icePatchDrag : factors.baseDrag,
    overIcePatch
      ? context.physics.icePatchDragRetention
      : context.physics.baseDragRetention,
    surfaceRetention,
    factors.overspeedRetention,
  );
  const hits = updateSurfaceHits(context, physicsScratch);
  hits.icePatch = overIcePatch;
  // A reset invalidates this movement and its surface hits. Stop the frame so
  // remaining substeps cannot accelerate the marble away from its new spawn.
  if (hits.hazardPatch && feedback.onHazard?.() === true) return true;
  const currentSurfaceType = surfaceType(hits);
  feedback.onTerrain?.(currentSurfaceType);
  applySurfaceDrag(context, hits, factors);
  handleWallCollisions(
    context,
    feedback.onImpact,
    context.mapState.obstacles,
    physicsScratch.collisionContact,
  );
  handleSurfaceFeedback(context, feedback.onSurface, currentSurfaceType);
}

export function updatePhysics(context, dt, feedback) {
  if (!Number.isFinite(dt) || dt <= 0) return;

  const speed = Math.hypot(context.marble.vx, context.marble.vy);
  const steps = physicsSubstepCount(speed, dt, context.physics);
  const stepDt = dt / steps;
  const physicsScratch = scratch(context);
  physicsScratch.frameFactors.baseDrag = Math.pow(
    context.physics.baseDragRetention,
    stepDt,
  );
  physicsScratch.frameFactors.gooPatchDrag = Math.pow(
    context.physics.gooPatchDragRetention ?? 1,
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
  physicsScratch.frameFactors.waterPatchDrag = Math.pow(
    context.physics.waterPatchDragRetention ?? 1,
    stepDt,
  );
  physicsScratch.frameFactors.overspeedRetention = Math.pow(
    context.physics.overspeedRetention ??
      context.physics.maxSpeedEase ??
      defaultOverspeedRetention,
    stepDt,
  );

  for (let i = 0; i < steps; i++) {
    if (physicsStep(context, stepDt, feedback)) return true;
  }
}

export function updatePhysicsInput(context, dt) {
  updateTilt(context, dt);
}

import { clamp } from "./geometry.js";
import { MAP_ELEMENT_TYPES } from "./map-elements.js";
import { handleWallCollisions, marbleOverRect } from "./physics-collisions.js";

const defaultMaxSpeedEase = 0;
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

function isOverTerrainPatch(marble, intro, patches, physics) {
  return (
    intro.released &&
    patches.some((rect) =>
      marbleOverRect(marble, rect, physics.collisionDistanceSqEpsilon ?? 0),
    )
  );
}

function createPhysicsScratch() {
  return {
    frameFactors: {
      baseDrag: 1,
      gooPatchDrag: 1,
      icePatchDrag: 1,
      maxSpeedEase: defaultMaxSpeedEase,
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
    context.terrainByType?.[type] ?? {
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

function sweptOverTerrainPatch(start, end, intro, patches, physics) {
  if (!intro.released) return false;

  const padding =
    end.r + Math.sqrt(Math.max(physics.collisionDistanceSqEpsilon ?? 0, 0));
  return patches.some((rect) =>
    segmentIntersectsExpandedRect(start, end, rect, padding),
  );
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
  )
    return;

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

  hits.gooPatch = sweptOverTerrainPatch(
    previous,
    context.marble,
    context.intro,
    terrainCandidates(context, SURFACE_TYPES.gooPatch),
    context.physics,
  );
  hits.roughPatch = sweptOverTerrainPatch(
    previous,
    context.marble,
    context.intro,
    terrainCandidates(context, SURFACE_TYPES.roughPatch),
    context.physics,
  );
  hits.waterPatch = sweptOverTerrainPatch(
    previous,
    context.marble,
    context.intro,
    terrainCandidates(context, SURFACE_TYPES.waterPatch),
    context.physics,
  );
  hits.hazardPatch = sweptOverTerrainPatch(
    previous,
    context.marble,
    context.intro,
    terrainCandidates(context, SURFACE_TYPES.hazardPatch),
    context.physics,
  );

  return hits;
}

function physicsStep(context, dt, feedback) {
  const physicsScratch = scratch(context);
  const factors = physicsScratch.frameFactors;
  const overIcePatch = isOverTerrainPatch(
    context.marble,
    context.intro,
    terrainCandidates(context, SURFACE_TYPES.icePatch),
    context.physics,
  );
  updateVelocity(
    context,
    dt,
    overIcePatch ? factors.icePatchDrag : factors.baseDrag,
    factors.maxSpeedEase,
  );
  updatePreviousTerrainMarble(context, physicsScratch);
  updatePosition(context.marble, dt);
  const hits = updateSurfaceHits(context, physicsScratch);
  hits.icePatch = overIcePatch;
  if (hits.hazardPatch) feedback.onHazard?.();
  const currentSurfaceType = surfaceType(hits);
  feedback.onTerrain?.(currentSurfaceType);
  applySurfaceDrag(context, hits, factors);
  handleWallCollisions(context, feedback.onImpact, context.obstacles);
  handleSurfaceFeedback(context, feedback.onSurface, currentSurfaceType);
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

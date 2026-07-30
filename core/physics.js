import { clamp } from "./geometry.js";
import { MAP_ELEMENT_TYPES, MAP_TERRAIN_TYPES } from "./map-elements.js";
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

function createTerrainScratch() {
  return Object.fromEntries(
    MAP_TERRAIN_TYPES.map((type) => [
      type,
      {
        candidates: [],
        seen: new Set(),
      },
    ]),
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
    obstacleCandidates: [],
    obstacleSeen: new Set(),
    sweptTerrainQueryCircle: { x: 0, y: 0, r: 0 },
    terrain: createTerrainScratch(),
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

function obstacleCandidates(context, scratch) {
  return queryCandidates(
    context.obstacleIndex,
    context.marble,
    context.obstacles,
    scratch.obstacleCandidates,
    scratch.obstacleSeen,
  );
}

function terrainByType(context, type) {
  return (
    context.terrainByType?.[type] ?? {
      elements: [],
      index: null,
    }
  );
}

function terrainCandidates(context, scratch, type, circle) {
  const terrain = terrainByType(context, type);
  const terrainScratch = scratch.terrain[type];
  return queryCandidates(
    terrain.index,
    circle,
    terrain.elements,
    terrainScratch.candidates,
    terrainScratch.seen,
  );
}

function updateSweptTerrainCircle(context, dt, scratch) {
  const distance = Math.hypot(context.marble.vx * dt, context.marble.vy * dt);
  scratch.sweptTerrainQueryCircle.x =
    context.marble.x + (context.marble.vx * dt) / 2;
  scratch.sweptTerrainQueryCircle.y =
    context.marble.y + (context.marble.vy * dt) / 2;
  scratch.sweptTerrainQueryCircle.r = context.marble.r + distance / 2;
}

function applySurfaceDrag(
  context,
  { overGooPatch, overRoughPatch, overWaterPatch },
  factors,
) {
  if (overGooPatch) {
    context.marble.vx *= factors.gooPatchDrag;
    context.marble.vy *= factors.gooPatchDrag;
  }

  if (overRoughPatch) {
    context.marble.vx *= factors.roughPatchDrag;
    context.marble.vy *= factors.roughPatchDrag;
  }

  if (overWaterPatch) {
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

function surfaceType({
  overGooPatch,
  overIcePatch,
  overRoughPatch,
  overWaterPatch,
}) {
  if (overGooPatch) return SURFACE_TYPES.gooPatch;
  if (overRoughPatch) return SURFACE_TYPES.roughPatch;
  if (overWaterPatch) return SURFACE_TYPES.waterPatch;
  if (overIcePatch) return SURFACE_TYPES.icePatch;
  return SURFACE_TYPES.floor;
}

function physicsStep(context, dt, feedback) {
  const physicsScratch = scratch(context);
  const factors = physicsScratch.frameFactors;
  const overIcePatch = isOverTerrainPatch(
    context.marble,
    context.intro,
    terrainCandidates(
      context,
      physicsScratch,
      SURFACE_TYPES.icePatch,
      context.marble,
    ),
    context.physics,
  );
  updateVelocity(
    context,
    dt,
    overIcePatch ? factors.icePatchDrag : factors.baseDrag,
    factors.maxSpeedEase,
  );
  updateSweptTerrainCircle(context, dt, physicsScratch);
  const gooCandidates = terrainCandidates(
    context,
    physicsScratch,
    SURFACE_TYPES.gooPatch,
    physicsScratch.sweptTerrainQueryCircle,
  );
  const roughCandidates = terrainCandidates(
    context,
    physicsScratch,
    SURFACE_TYPES.roughPatch,
    physicsScratch.sweptTerrainQueryCircle,
  );
  const waterCandidates = terrainCandidates(
    context,
    physicsScratch,
    SURFACE_TYPES.waterPatch,
    physicsScratch.sweptTerrainQueryCircle,
  );
  const overGooPatchBeforeMove = isOverTerrainPatch(
    context.marble,
    context.intro,
    gooCandidates,
    context.physics,
  );
  const overRoughPatchBeforeMove = isOverTerrainPatch(
    context.marble,
    context.intro,
    roughCandidates,
    context.physics,
  );
  const overWaterPatchBeforeMove = isOverTerrainPatch(
    context.marble,
    context.intro,
    waterCandidates,
    context.physics,
  );
  updatePosition(context.marble, dt);
  const overGooPatchAfterMove = isOverTerrainPatch(
    context.marble,
    context.intro,
    gooCandidates,
    context.physics,
  );
  const overGooPatch = overGooPatchBeforeMove || overGooPatchAfterMove;
  const overRoughPatchAfterMove = isOverTerrainPatch(
    context.marble,
    context.intro,
    roughCandidates,
    context.physics,
  );
  const overRoughPatch = overRoughPatchBeforeMove || overRoughPatchAfterMove;
  const overWaterPatchAfterMove = isOverTerrainPatch(
    context.marble,
    context.intro,
    waterCandidates,
    context.physics,
  );
  const overWaterPatch = overWaterPatchBeforeMove || overWaterPatchAfterMove;
  if (
    isOverTerrainPatch(
      context.marble,
      context.intro,
      terrainCandidates(
        context,
        physicsScratch,
        SURFACE_TYPES.hazardPatch,
        context.marble,
      ),
      context.physics,
    )
  ) {
    feedback.onHazard?.();
  }
  const currentSurfaceType = surfaceType({
    overGooPatch,
    overIcePatch,
    overRoughPatch,
    overWaterPatch,
  });
  feedback.onTerrain?.(currentSurfaceType);
  applySurfaceDrag(
    context,
    { overGooPatch, overRoughPatch, overWaterPatch },
    factors,
  );
  handleWallCollisions(
    context,
    feedback.onImpact,
    obstacleCandidates(context, physicsScratch),
  );
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

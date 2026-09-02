import { KITCHEN_FIXTURES, MAP_ELEMENT_TYPES } from "./map-elements.js";
import {
  circleOrientedRectContact,
  circleOrientedRoundedRectContact,
} from "./physics-collisions.js";

const cheerioRadiusRatio = 0.00525;
const collisionZeroDistanceEpsilon = 0.001;
const defaultSurfaceInfluence = Object.freeze({
  dragRetention: 0.88,
  momentumTransfer: 0.42,
});
const surfaceInfluences = Object.freeze({
  gooPatch: Object.freeze({ dragRetention: 0.55, momentumTransfer: 0.16 }),
  icePatch: Object.freeze({ dragRetention: 0.985, momentumTransfer: 0.62 }),
  roughPatch: Object.freeze({ dragRetention: 0.68, momentumTransfer: 0.28 }),
  waterPatch: Object.freeze({ dragRetention: 0.82, momentumTransfer: 0.5 }),
});
const cheerioObstacleSeparation = 0.5;
const obstacleResolvePasses = 2;
const cerealLinearSettleSpeed = 0.02;
const cerealMaxSpeed = 16;
const crumbMomentumMultiplier = 1.2;
const antRadius = 7;
const antSpeed = 0.9;
const antMunchDistance = 20;
const antMunchRate = 0.006;
const antSquishMinSpeed = 1.2;
const antSplatMinSpeed = 0.7;
const antSplatFeedbackCooldownFrames = 24;
const antWaterAvoidanceFrames = 18;
const antWaterAvoidancePadding = 10;
const antWaterOutwardBias = 0.35;
const antWaterSoakRejectionThreshold = 0.05;
const crumbRadiusRatio = 0.0032;
const cerealHitMinSpeed = 0.8;
const cerealHitFeedbackCooldownFrames = 20;
const kitchenFloorMapId = "kitchen-floor";
const cheerioWaterSoakRate = 0.006;
const spongeMass = 4;
const spongeInverseMass = 1 / spongeMass;
const spongeRestitution = 0;
const spongeLinearDragRetention = 0.94;
const spongeAngularDragRetention = 0.9;
const spongeMaxLinearSpeed = 3.5;
const spongeMaxAngularSpeed = 0.025;
const spongeLinearSettleSpeed = 0.01;
const spongeAngularSettleSpeed = 0.00005;
const spongeMaxAngleOffset = 0.55;
const spongeCollisionCornerRadius = 18;
const spongeCollisionSeparation = 0.5;
const spongeWaterSoakRate = 0.01;
const spongeMaxPuddleLinearShrink = 0.2;
const spongeWaterRedrawSteps = 20;

const cheerioLayout = Object.freeze([
  { x: 0.16, y: 0.49 },
  { x: 0.19, y: 0.52 },
  { x: 0.22, y: 0.48 },
  { x: 0.24, y: 0.55 },
  { x: 0.27, y: 0.51 },
  { x: 0.31, y: 0.57 },
  { x: 0.36, y: 0.46 },
  { x: 0.39, y: 0.5 },
  { x: 0.42, y: 0.55 },
  { x: 0.44, y: 0.61 },
  { x: 0.6, y: 0.37 },
  { x: 0.63, y: 0.39 },
  { x: 0.66, y: 0.36 },
  { x: 0.69, y: 0.4 },
  { x: 0.47, y: 0.68 },
  { x: 0.49, y: 0.71 },
  { x: 0.52, y: 0.69 },
  { x: 0.54, y: 0.73 },
  { x: 0.57, y: 0.7 },
  { x: 0.59, y: 0.75 },
  { x: 0.51, y: 0.77 },
  { x: 0.45, y: 0.74 },
  { x: 0.61, y: 0.8 },
  { x: 0.64, y: 0.76 },
  { x: 0.67, y: 0.82 },
  { x: 0.7, y: 0.78 },
  { x: 0.74, y: 0.84 },
  { x: 0.78, y: 0.8 },
  { x: 0.8, y: 0.87 },
  { x: 0.73, y: 0.69 },
  { x: 0.78, y: 0.64 },
  { x: 0.83, y: 0.71 },
  { x: 0.86, y: 0.59 },
  { x: 0.88, y: 0.67 },
]);

const crumbLayout = Object.freeze([
  { x: 0.2, y: 0.5, rotation: 0.3 },
  { x: 0.25, y: 0.49, rotation: -0.4 },
  { x: 0.29, y: 0.55, rotation: 0.8 },
  { x: 0.36, y: 0.53, rotation: -0.1 },
  { x: 0.41, y: 0.59, rotation: 0.55 },
  { x: 0.62, y: 0.35, rotation: -0.65 },
  { x: 0.67, y: 0.39, rotation: 0.18 },
  { x: 0.48, y: 0.73, rotation: -0.75 },
  { x: 0.56, y: 0.76, rotation: 0.42 },
  { x: 0.66, y: 0.79, rotation: -0.22 },
  { x: 0.76, y: 0.82, rotation: 0.66 },
  { x: 0.83, y: 0.65, rotation: -0.3 },
]);

const antSpawnPoints = Object.freeze([
  { x: 0.04, y: 0.24 },
  { x: 0.08, y: 0.82 },
  { x: 0.18, y: 0.96 },
  { x: 0.36, y: 0.05 },
  { x: 0.54, y: 0.94 },
  { x: 0.72, y: 0.07 },
  { x: 0.9, y: 0.26 },
  { x: 0.96, y: 0.52 },
  { x: 0.86, y: 0.92 },
  { x: 0.47, y: 0.02 },
]);

function createCereal(world, point, options = {}) {
  return {
    kind: options.kind ?? "cheerio",
    originX: point.x * world.width,
    originY: point.y * world.height,
    pushX: 0,
    pushY: 0,
    vx: 0,
    vy: 0,
    radius: (options.radiusRatio ?? cheerioRadiusRatio) * world.width,
    eaten: 0,
    active: true,
    playerDisturbed: false,
    rotation: options.rotation ?? 0,
    lastHitFeedbackFrame: Number.NEGATIVE_INFINITY,
    sweptClosestX: 0,
    sweptClosestY: 0,
    sweptDistance: 0,
    waterSoak: 0,
    waterStainX: null,
    waterStainY: null,
    revision: 0,
  };
}

function createAnt(world, point, index) {
  return {
    x: point.x * world.width,
    y: point.y * world.height,
    angle: (index % 2) * Math.PI,
    alive: true,
    squished: false,
    lastSplatFeedbackFrame: Number.NEGATIVE_INFINITY,
    targetIndex: -1,
    waterAvoidanceFrames: 0,
    wobble: index * 1.7,
    revision: 0,
  };
}

export function createKitchenDynamicsState() {
  return {
    ants: [],
    cheerios: [],
    elementCacheSource: null,
    frameIndex: 0,
    obstacles: [],
    terrainElements: [],
    collisionCircle: { x: 0, y: 0, r: 0, vx: 0, vy: 0 },
    collisionContact: {},
    events: {
      cerealHits: 0,
      splatHits: 0,
      spongeChanges: 0,
      spongeImpact: 0,
      spongeSoaks: 0,
      squishedAnts: 0,
      waterChanges: 0,
    },
    lastWaterRenderStep: 0,
    sponge: null,
    spongeContact: {},
    spongeDisturbed: false,
    spongeOriginAngle: 0,
    spongeSoakAnchorX: 0.5,
    spongeSoakAnchorY: 0.5,
    waterPatch: null,
    waterPatchOriginal: null,
    world: null,
  };
}

function elementCaches(elements = []) {
  const obstacles = [];
  const terrainElements = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.type === MAP_ELEMENT_TYPES.obstacle) {
      obstacles.push(element);
    } else if (surfaceInfluences[element.type]) {
      terrainElements.push(element);
    }
  }

  return { obstacles, terrainElements };
}

function useRuntimeWaterPatch(state, waterPatches) {
  if (!Array.isArray(waterPatches) || !waterPatches[0]) return;

  const patch = waterPatches[0];
  state.waterPatch = patch;
  state.waterPatchOriginal = {
    h: patch.h,
    w: patch.w,
    x: patch.x,
    y: patch.y,
  };
}

export function resetKitchenDynamics(
  state,
  { mapConfig, obstacles, waterPatches, world },
) {
  state.ants = [];
  state.cheerios = [];
  state.elementCacheSource = null;
  state.frameIndex = 0;
  state.obstacles = [];
  state.terrainElements = [];
  state.lastWaterRenderStep = 0;
  state.sponge = null;
  state.spongeDisturbed = false;
  state.spongeOriginAngle = 0;
  state.spongeSoakAnchorX = 0.5;
  state.spongeSoakAnchorY = 0.5;
  state.waterPatch = null;
  state.waterPatchOriginal = null;
  state.world = world ?? null;
  if (mapConfig?.theme !== "kitchenFloor" || !world) return state;

  state.cheerios = cheerioLayout.map((point) => createCereal(world, point));
  state.cheerios.push(
    ...crumbLayout.map((point) =>
      createCereal(world, point, {
        kind: "crumb",
        radiusRatio: crumbRadiusRatio,
        rotation: point.rotation,
      }),
    ),
  );
  state.ants = antSpawnPoints.map((point, index) =>
    createAnt(world, point, index),
  );
  const caches = elementCaches(mapConfig.elements);
  state.elementCacheSource = mapConfig.elements;
  state.obstacles = Array.isArray(obstacles) ? obstacles : caches.obstacles;
  state.terrainElements = caches.terrainElements;
  if (mapConfig.variantId === kitchenFloorMapId) {
    state.sponge = state.obstacles.find(
      (obstacle) => obstacle.fixture === KITCHEN_FIXTURES.sponge,
    );
    if (state.sponge) {
      state.sponge.angularVelocity = 0;
      state.sponge.saturation = 0;
      state.sponge.staticCollision = false;
      state.sponge.vx = 0;
      state.sponge.vy = 0;
      state.spongeOriginAngle = state.sponge.angle ?? 0;
    }
    useRuntimeWaterPatch(state, waterPatches);
  }
  return state;
}

function pointInRect(x, y, rect) {
  return (
    x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  );
}

function surfaceInfluence(x, y, elements) {
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const influence = surfaceInfluences[element.type];
    if (influence && pointInRect(x, y, element)) return influence;
  }

  return defaultSurfaceInfluence;
}

function soakPlayerDisturbedCheerio(cereal, elements, frameDelta) {
  const waterSoak = cereal.waterSoak ?? 0;
  if (cereal.kind !== "cheerio" || !cereal.playerDisturbed || waterSoak >= 1) {
    return;
  }

  const x = cereal.originX + cereal.pushX;
  const y = cereal.originY + cereal.pushY;
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (
      element.type !== MAP_ELEMENT_TYPES.waterPatch ||
      !pointInRect(x, y, element)
    ) {
      continue;
    }

    cereal.waterSoak = Math.min(
      1,
      waterSoak + cheerioWaterSoakRate * frameDelta,
    );
    cereal.waterStainX = x;
    cereal.waterStainY = y;
    cereal.revision += 1;
    return;
  }
}

function ensureElementCaches(state, elements = []) {
  if (state.elementCacheSource === elements) return;

  const caches = elementCaches(elements);
  state.elementCacheSource = elements;
  state.obstacles = caches.obstacles;
  state.terrainElements = caches.terrainElements;
}

function cappedVectorScale(x, y, maxLength) {
  const length = Math.hypot(x, y);
  if (length <= maxLength || length === 0) return 1;

  return maxLength / length;
}

function moveSponge(state, dx, dy) {
  const sponge = state.sponge;
  const nextX = Math.max(
    0,
    Math.min(state.world.width - sponge.w, sponge.x + dx),
  );
  const nextY = Math.max(
    0,
    Math.min(state.world.height - sponge.h, sponge.y + dy),
  );
  const moveX = nextX - sponge.x;
  const moveY = nextY - sponge.y;
  if (Math.abs(moveX) < 0.01 && Math.abs(moveY) < 0.01) return false;

  sponge.x = nextX;
  sponge.y = nextY;
  if (Number.isFinite(sponge.collisionCenterX)) {
    sponge.collisionCenterX += moveX;
  }
  if (Number.isFinite(sponge.collisionCenterY)) {
    sponge.collisionCenterY += moveY;
  }
  return true;
}

function limitSpongeVelocity(sponge) {
  const velocityScale = cappedVectorScale(
    sponge.vx,
    sponge.vy,
    spongeMaxLinearSpeed,
  );
  sponge.vx *= velocityScale;
  sponge.vy *= velocityScale;
  sponge.angularVelocity = Math.max(
    -spongeMaxAngularSpeed,
    Math.min(spongeMaxAngularSpeed, sponge.angularVelocity),
  );
}

function resolveSpongeCollision(state, marble) {
  const sponge = state.sponge;
  const contact = circleOrientedRoundedRectContact(
    marble,
    sponge,
    spongeCollisionCornerRadius,
    0,
    state.spongeContact,
    collisionZeroDistanceEpsilon,
  );
  if (!contact.intersects) return null;

  const distance = Math.sqrt(contact.distanceSq);
  const normalX =
    distance > collisionZeroDistanceEpsilon
      ? contact.dx / distance
      : Number.isFinite(contact.insideNx)
        ? contact.insideNx
        : 1;
  const normalY =
    distance > collisionZeroDistanceEpsilon
      ? contact.dy / distance
      : Number.isFinite(contact.insideNy)
        ? contact.insideNy
        : 0;
  const contactX =
    distance > collisionZeroDistanceEpsilon
      ? marble.x - contact.dx
      : marble.x - normalX * marble.r;
  const contactY =
    distance > collisionZeroDistanceEpsilon
      ? marble.y - contact.dy
      : marble.y - normalY * marble.r;
  const centerX = sponge.collisionCenterX ?? sponge.x + sponge.w / 2;
  const centerY = sponge.collisionCenterY ?? sponge.y + sponge.h / 2;
  const leverX = contactX - centerX;
  const leverY = contactY - centerY;
  const overlap =
    distance > collisionZeroDistanceEpsilon
      ? marble.r - distance
      : marble.r + (contact.insideDistance || 0);
  marble.x += normalX * (Math.max(0, overlap) + spongeCollisionSeparation);
  marble.y += normalY * (Math.max(0, overlap) + spongeCollisionSeparation);

  const angularVelocity = sponge.angularVelocity ?? 0;
  const contactVelocityX = (sponge.vx ?? 0) - angularVelocity * leverY;
  const contactVelocityY = (sponge.vy ?? 0) + angularVelocity * leverX;
  const relativeVelocityX = marble.vx - contactVelocityX;
  const relativeVelocityY = marble.vy - contactVelocityY;
  const normalSpeed = relativeVelocityX * normalX + relativeVelocityY * normalY;
  if (normalSpeed >= 0) return 0;

  const width = sponge.hitboxW ?? sponge.w;
  const height = sponge.hitboxH ?? sponge.h;
  const inverseInertia = 12 / (spongeMass * (width * width + height * height));
  const leverCrossNormal = leverX * normalY - leverY * normalX;
  const impulse =
    (-(1 + spongeRestitution) * normalSpeed) /
    (1 +
      spongeInverseMass +
      leverCrossNormal * leverCrossNormal * inverseInertia);
  const impulseX = impulse * normalX;
  const impulseY = impulse * normalY;
  marble.vx += impulseX;
  marble.vy += impulseY;
  sponge.vx = (sponge.vx ?? 0) - impulseX * spongeInverseMass;
  sponge.vy = (sponge.vy ?? 0) - impulseY * spongeInverseMass;
  sponge.angularVelocity =
    angularVelocity - impulse * leverCrossNormal * inverseInertia;
  limitSpongeVelocity(sponge);
  return -normalSpeed;
}

function advanceSponge(state, frameDelta) {
  const sponge = state.sponge;
  sponge.vx *= Math.pow(spongeLinearDragRetention, frameDelta);
  sponge.vy *= Math.pow(spongeLinearDragRetention, frameDelta);
  sponge.angularVelocity *= Math.pow(spongeAngularDragRetention, frameDelta);
  if (Math.hypot(sponge.vx, sponge.vy) < spongeLinearSettleSpeed) {
    sponge.vx = 0;
    sponge.vy = 0;
  }
  if (Math.abs(sponge.angularVelocity) < spongeAngularSettleSpeed) {
    sponge.angularVelocity = 0;
  }

  const moved = moveSponge(
    state,
    sponge.vx * frameDelta,
    sponge.vy * frameDelta,
  );
  const previousAngle = sponge.angle ?? 0;
  const nextAngle = Math.max(
    state.spongeOriginAngle - spongeMaxAngleOffset,
    Math.min(
      state.spongeOriginAngle + spongeMaxAngleOffset,
      previousAngle + sponge.angularVelocity * frameDelta,
    ),
  );
  if (nextAngle !== previousAngle) {
    sponge.angle = nextAngle;
    sponge.collisionCos = Math.cos(nextAngle);
    sponge.collisionSin = Math.sin(nextAngle);
  } else if (
    nextAngle === state.spongeOriginAngle - spongeMaxAngleOffset ||
    nextAngle === state.spongeOriginAngle + spongeMaxAngleOffset
  ) {
    sponge.angularVelocity = 0;
  }
  return moved || nextAngle !== previousAngle;
}

function spongePointTouchesWater(
  centerX,
  centerY,
  cos,
  sin,
  localX,
  localY,
  patch,
) {
  return pointInPuddle(
    centerX + cos * localX - sin * localY,
    centerY + sin * localX + cos * localY,
    patch,
  );
}

function spongeTouchesWater(sponge, patch) {
  const centerX = sponge.collisionCenterX ?? sponge.x + sponge.w / 2;
  const centerY = sponge.collisionCenterY ?? sponge.y + sponge.h / 2;
  const halfWidth =
    sponge.collisionHalfWidth ?? (sponge.hitboxW ?? sponge.w) / 2;
  const halfHeight =
    sponge.collisionHalfHeight ?? (sponge.hitboxH ?? sponge.h) / 2;
  const cos = sponge.collisionCos ?? Math.cos(sponge.angle ?? 0);
  const sin = sponge.collisionSin ?? Math.sin(sponge.angle ?? 0);
  const cornerRadius = Math.min(
    spongeCollisionCornerRadius,
    halfWidth,
    halfHeight,
  );
  const cornerX = halfWidth - cornerRadius + cornerRadius * Math.SQRT1_2;
  const cornerY = halfHeight - cornerRadius + cornerRadius * Math.SQRT1_2;

  if (pointInPuddle(centerX, centerY, patch)) return true;

  for (let sign = -1; sign <= 1; sign += 2) {
    if (
      spongePointTouchesWater(
        centerX,
        centerY,
        cos,
        sin,
        sign * halfWidth,
        0,
        patch,
      ) ||
      spongePointTouchesWater(
        centerX,
        centerY,
        cos,
        sin,
        0,
        sign * halfHeight,
        patch,
      )
    ) {
      return true;
    }

    for (let crossSign = -1; crossSign <= 1; crossSign += 2) {
      if (
        spongePointTouchesWater(
          centerX,
          centerY,
          cos,
          sin,
          sign * cornerX,
          crossSign * cornerY,
          patch,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function shrinkWaterPatch(state, saturation) {
  const patch = state.waterPatch;
  const original = state.waterPatchOriginal;
  const scale = 1 - saturation * spongeMaxPuddleLinearShrink;
  const width = original.w * scale;
  const height = original.h * scale;
  patch.x = original.x + (original.w - width) * (1 - state.spongeSoakAnchorX);
  patch.y = original.y + (original.h - height) * (1 - state.spongeSoakAnchorY);
  patch.w = width;
  patch.h = height;
}

function captureSpongeSoakAnchor(state) {
  const sponge = state.sponge;
  const original = state.waterPatchOriginal;
  const centerX = sponge.collisionCenterX ?? sponge.x + sponge.w / 2;
  const centerY = sponge.collisionCenterY ?? sponge.y + sponge.h / 2;
  state.spongeSoakAnchorX = Math.max(
    0,
    Math.min(1, (centerX - original.x) / original.w),
  );
  state.spongeSoakAnchorY = Math.max(
    0,
    Math.min(1, (centerY - original.y) / original.h),
  );
}

function updateSponge(state, marble, frameDelta, events) {
  if (!state.sponge || !state.waterPatch || !state.waterPatchOriginal) return;

  const impact = resolveSpongeCollision(state, marble);
  if (impact > 0) {
    state.spongeDisturbed = true;
    events.spongeImpact = Math.max(events.spongeImpact, impact);
  }
  if (advanceSponge(state, frameDelta)) events.spongeChanges = 1;
  if (
    !state.spongeDisturbed ||
    !spongeTouchesWater(state.sponge, state.waterPatch)
  ) {
    return;
  }

  const previousSaturation = state.sponge.saturation ?? 0;
  if (previousSaturation >= 1) return;
  if (previousSaturation === 0) captureSpongeSoakAnchor(state);

  const saturation = Math.min(
    1,
    previousSaturation + spongeWaterSoakRate * frameDelta,
  );
  state.sponge.saturation = saturation;
  shrinkWaterPatch(state, saturation);
  const renderStep = Math.floor(saturation * spongeWaterRedrawSteps);
  if (previousSaturation === 0) {
    events.spongeSoaks = 1;
    events.spongeChanges = 1;
    events.waterChanges = 1;
  } else if (renderStep !== state.lastWaterRenderStep) {
    events.spongeChanges = 1;
    events.waterChanges = 1;
  }
  state.lastWaterRenderStep = renderStep;
}

function setDistanceToSegment(pointX, pointY, start, end, target) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSq = segmentX * segmentX + segmentY * segmentY;
  const t =
    lengthSq > 0
      ? Math.max(
          0,
          Math.min(
            1,
            ((pointX - start.x) * segmentX + (pointY - start.y) * segmentY) /
              lengthSq,
          ),
        )
      : 1;

  target.sweptClosestX = start.x + segmentX * t;
  target.sweptClosestY = start.y + segmentY * t;
  target.sweptDistance = Math.hypot(
    pointX - target.sweptClosestX,
    pointY - target.sweptClosestY,
  );
}

function pointInPuddle(x, y, patch, padding = 0) {
  if (!patch) return false;

  const centerX = patch.x + patch.w * 0.5;
  const centerY = patch.y + patch.h * 0.52;
  const radiusX = patch.w * 0.44 + padding;
  const radiusY = patch.h * 0.35 + padding;
  const dx = (x - centerX) / Math.max(1, radiusX);
  const dy = (y - centerY) / Math.max(1, radiusY);
  return dx * dx + dy * dy <= 1;
}

function cerealUnavailableToAnt(cereal, waterPatch) {
  if ((cereal.waterSoak ?? 0) >= antWaterSoakRejectionThreshold) return true;

  return pointInPuddle(
    cereal.originX + cereal.pushX,
    cereal.originY + cereal.pushY,
    waterPatch,
  );
}

function nearestActiveCheerio(ant, cheerios, waterPatch) {
  let bestIndex = -1;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i < cheerios.length; i++) {
    const cheerio = cheerios[i];
    if (!cheerio.active || cerealUnavailableToAnt(cheerio, waterPatch)) {
      continue;
    }

    const x = cheerio.originX + cheerio.pushX;
    const y = cheerio.originY + cheerio.pushY;
    const dx = x - ant.x;
    const dy = y - ant.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function antTarget(ant, cheerios, waterPatch) {
  if (
    ant.targetIndex < 0 ||
    !cheerios[ant.targetIndex] ||
    !cheerios[ant.targetIndex].active
  ) {
    ant.targetIndex = nearestActiveCheerio(ant, cheerios, waterPatch);
  }

  return cheerios[ant.targetIndex] ?? null;
}

function updateAnts(state, marble, frameDelta, events) {
  const marbleSpeed = Math.hypot(marble.vx || 0, marble.vy || 0);
  const squishDistance = marble.r + antRadius;
  const squishDistanceSq = squishDistance * squishDistance;

  for (let i = 0; i < state.ants.length; i++) {
    const ant = state.ants[i];
    const marbleDx = ant.x - marble.x;
    const marbleDy = ant.y - marble.y;
    const overlapsMarble =
      marbleDx * marbleDx + marbleDy * marbleDy <= squishDistanceSq;
    if (ant.squished) {
      if (
        overlapsMarble &&
        marbleSpeed >= antSplatMinSpeed &&
        state.frameIndex -
          (ant.lastSplatFeedbackFrame ?? Number.NEGATIVE_INFINITY) >=
          antSplatFeedbackCooldownFrames
      ) {
        ant.lastSplatFeedbackFrame = state.frameIndex;
        events.splatHits += 1;
      }
      continue;
    }

    if (marbleSpeed >= antSquishMinSpeed && overlapsMarble) {
      ant.alive = false;
      ant.squished = true;
      ant.lastSplatFeedbackFrame = state.frameIndex;
      ant.revision = (ant.revision ?? 0) + 1;
      events.squishedAnts += 1;
      continue;
    }

    if ((ant.waterAvoidanceFrames ?? 0) > 0) {
      const avoidanceStep = antSpeed * frameDelta;
      ant.x += Math.cos(ant.angle) * avoidanceStep;
      ant.y += Math.sin(ant.angle) * avoidanceStep;
      ant.waterAvoidanceFrames = Math.max(
        0,
        ant.waterAvoidanceFrames - frameDelta,
      );
      continue;
    }

    const target = antTarget(ant, state.cheerios, state.waterPatch);
    if (!target) continue;

    const targetX = target.originX + target.pushX;
    const targetY = target.originY + target.pushY;
    const dx = targetX - ant.x;
    const dy = targetY - ant.y;
    const targetUnavailable = cerealUnavailableToAnt(target, state.waterPatch);
    const munchDistance = target.radius + antMunchDistance;
    if (
      !targetUnavailable &&
      dx * dx + dy * dy <= munchDistance * munchDistance
    ) {
      target.eaten = Math.min(1, target.eaten + antMunchRate * frameDelta);
      if (target.eaten >= 1) target.active = false;
      continue;
    }

    const desiredAngle = Math.atan2(dy, dx) + Math.sin(ant.wobble) * 0.18;
    ant.wobble += 0.11 * frameDelta;
    const step = antSpeed * frameDelta;
    const proposedX = ant.x + Math.cos(desiredAngle) * step;
    const proposedY = ant.y + Math.sin(desiredAngle) * step;
    if (
      state.waterPatch &&
      pointInPuddle(
        proposedX,
        proposedY,
        state.waterPatch,
        antWaterAvoidancePadding,
      )
    ) {
      const centerX = state.waterPatch.x + state.waterPatch.w * 0.5;
      const centerY = state.waterPatch.y + state.waterPatch.h * 0.52;
      const radialX =
        (ant.x - centerX) /
        Math.max(1, state.waterPatch.w * 0.44 + antWaterAvoidancePadding);
      const radialY =
        (ant.y - centerY) /
        Math.max(1, state.waterPatch.h * 0.35 + antWaterAvoidancePadding);
      const radialLength = Math.hypot(radialX, radialY) || 1;
      const normalX = radialX / radialLength;
      const normalY = radialY / radialLength;

      if (targetUnavailable) {
        ant.targetIndex = -1;
        ant.waterAvoidanceFrames = antWaterAvoidanceFrames;
        ant.angle = Math.atan2(normalY, normalX);
      } else {
        let tangentX = -normalY;
        let tangentY = normalX;
        if (tangentX * dx + tangentY * dy < 0) {
          tangentX = -tangentX;
          tangentY = -tangentY;
        }
        ant.angle = Math.atan2(
          tangentY + normalY * antWaterOutwardBias,
          tangentX + normalX * antWaterOutwardBias,
        );
      }
    } else {
      ant.angle = desiredAngle;
    }
    ant.x += Math.cos(ant.angle) * step;
    ant.y += Math.sin(ant.angle) * step;
  }
}

function resolveCerealObstacleCollision(circle, obstacle, contact) {
  circleOrientedRectContact(
    circle,
    obstacle,
    0,
    contact,
    collisionZeroDistanceEpsilon,
  );
  if (!contact.intersects) return;

  let distance = Math.sqrt(contact.distanceSq);
  let nx = contact.dx / (distance || 1);
  let ny = contact.dy / (distance || 1);
  let overlap = circle.r - distance;

  if (distance <= collisionZeroDistanceEpsilon) {
    nx = Number.isFinite(contact.insideNx) ? contact.insideNx : 1;
    ny = Number.isFinite(contact.insideNy) ? contact.insideNy : 0;
    overlap = circle.r + (contact.insideDistance || 0);
  }

  const separation = Math.max(0, overlap) + cheerioObstacleSeparation;
  circle.x += nx * separation;
  circle.y += ny * separation;
  const normalSpeed = (circle.vx ?? 0) * nx + (circle.vy ?? 0) * ny;
  if (normalSpeed < 0) {
    circle.vx -= normalSpeed * nx;
    circle.vy -= normalSpeed * ny;
  }
}

function resolveCerealObstacleCollisions(circle, obstacles, contact) {
  for (let pass = 0; pass < obstacleResolvePasses; pass++) {
    for (let i = 0; i < obstacles.length; i++) {
      resolveCerealObstacleCollision(circle, obstacles[i], contact);
    }
  }
}

function constrainCerealToWorld(circle, world) {
  if (!world) return;

  if (circle.x < circle.r) {
    circle.x = circle.r;
    if (circle.vx < 0) circle.vx = 0;
  } else if (circle.x > world.width - circle.r) {
    circle.x = world.width - circle.r;
    if (circle.vx > 0) circle.vx = 0;
  }
  if (circle.y < circle.r) {
    circle.y = circle.r;
    if (circle.vy < 0) circle.vy = 0;
  } else if (circle.y > world.height - circle.r) {
    circle.y = world.height - circle.r;
    if (circle.vy > 0) circle.vy = 0;
  }
}

function setCerealFromCircle(cereal, circle) {
  cereal.pushX = circle.x - cereal.originX;
  cereal.pushY = circle.y - cereal.originY;
  cereal.vx = circle.vx;
  cereal.vy = circle.vy;
}

function advanceCereal(state, cereal, frameDelta) {
  let vx = cereal.vx ?? 0;
  let vy = cereal.vy ?? 0;
  if (Math.hypot(vx, vy) < cerealLinearSettleSpeed) {
    cereal.vx = 0;
    cereal.vy = 0;
    return;
  }

  const currentX = cereal.originX + cereal.pushX;
  const currentY = cereal.originY + cereal.pushY;
  const influence = surfaceInfluence(currentX, currentY, state.terrainElements);
  const drag = Math.pow(influence.dragRetention, frameDelta);
  vx *= drag;
  vy *= drag;
  if (Math.hypot(vx, vy) < cerealLinearSettleSpeed) {
    cereal.vx = 0;
    cereal.vy = 0;
    return;
  }

  const circle = state.collisionCircle;
  circle.x = currentX + vx * frameDelta;
  circle.y = currentY + vy * frameDelta;
  circle.r = cereal.radius;
  circle.vx = vx;
  circle.vy = vy;
  resolveCerealObstacleCollisions(
    circle,
    state.obstacles,
    state.collisionContact,
  );
  constrainCerealToWorld(circle, state.world);
  setCerealFromCircle(cereal, circle);
}

function transferMarbleMomentum(cereal, marble, nx, ny, influence) {
  const incomingSpeed = Math.max(
    0,
    (marble.vx ?? 0) * nx + (marble.vy ?? 0) * ny,
  );
  const kindMultiplier = cereal.kind === "crumb" ? crumbMomentumMultiplier : 1;
  const targetSpeed =
    incomingSpeed * influence.momentumTransfer * kindMultiplier;
  const currentSpeed = (cereal.vx ?? 0) * nx + (cereal.vy ?? 0) * ny;
  if (targetSpeed > currentSpeed) {
    const addedSpeed = targetSpeed - currentSpeed;
    cereal.vx = (cereal.vx ?? 0) + nx * addedSpeed;
    cereal.vy = (cereal.vy ?? 0) + ny * addedSpeed;
  }

  const velocityScale = cappedVectorScale(cereal.vx, cereal.vy, cerealMaxSpeed);
  cereal.vx *= velocityScale;
  cereal.vy *= velocityScale;
}

function updateCereal(
  state,
  marble,
  previousMarble,
  frameDelta,
  events,
  soakInWater,
) {
  for (let i = 0; i < state.cheerios.length; i++) {
    const cereal = state.cheerios[i];
    if (!cereal.active) continue;

    advanceCereal(state, cereal, frameDelta);

    if (soakInWater) {
      soakPlayerDisturbedCheerio(cereal, state.terrainElements, frameDelta);
    }

    const { originX, originY, radius, pushX, pushY } = cereal;
    const currentX = originX + pushX;
    const currentY = originY + pushY;
    const shoveDistance = marble.r + radius;
    const minX = Math.min(previousMarble.x, marble.x) - shoveDistance;
    const maxX = Math.max(previousMarble.x, marble.x) + shoveDistance;
    const minY = Math.min(previousMarble.y, marble.y) - shoveDistance;
    const maxY = Math.max(previousMarble.y, marble.y) + shoveDistance;
    if (
      currentX < minX ||
      currentX > maxX ||
      currentY < minY ||
      currentY > maxY
    ) {
      continue;
    }

    setDistanceToSegment(currentX, currentY, previousMarble, marble, cereal);
    const dx = currentX - cereal.sweptClosestX;
    const dy = currentY - cereal.sweptClosestY;
    const distance = cereal.sweptDistance;
    const influence = surfaceInfluence(
      currentX,
      currentY,
      state.terrainElements,
    );
    if (distance >= shoveDistance) continue;

    const speed = Math.hypot(marble.vx || 0, marble.vy || 0);
    const nx =
      distance > collisionZeroDistanceEpsilon
        ? dx / distance
        : (marble.vx || 1) / Math.max(speed, 1);
    const ny =
      distance > collisionZeroDistanceEpsilon
        ? dy / distance
        : (marble.vy || 0) / Math.max(speed, 1);
    const amount = shoveDistance - distance + cheerioObstacleSeparation;
    const nextPushX = pushX + nx * amount;
    const nextPushY = pushY + ny * amount;
    transferMarbleMomentum(cereal, marble, nx, ny, influence);
    const cerealCircle = state.collisionCircle;
    cerealCircle.x = originX + nextPushX;
    cerealCircle.y = originY + nextPushY;
    cerealCircle.r = radius;
    cerealCircle.vx = cereal.vx ?? 0;
    cerealCircle.vy = cereal.vy ?? 0;

    resolveCerealObstacleCollisions(
      cerealCircle,
      state.obstacles,
      state.collisionContact,
    );
    constrainCerealToWorld(cerealCircle, state.world);
    setCerealFromCircle(cereal, cerealCircle);
    cereal.playerDisturbed = true;
    if (
      speed >= cerealHitMinSpeed &&
      state.frameIndex - cereal.lastHitFeedbackFrame >=
        cerealHitFeedbackCooldownFrames
    ) {
      cereal.lastHitFeedbackFrame = state.frameIndex;
      events.cerealHits += 1;
    }
  }
}

export function updateKitchenDynamics(
  state,
  mapConfig,
  marble,
  previousMarble = marble,
  frameDelta = 1,
) {
  const events = state.events;
  events.cerealHits = 0;
  events.splatHits = 0;
  events.spongeChanges = 0;
  events.spongeImpact = 0;
  events.spongeSoaks = 0;
  events.squishedAnts = 0;
  events.waterChanges = 0;
  if (mapConfig?.theme !== "kitchenFloor" || !marble) return events;

  ensureElementCaches(state, mapConfig.elements);
  updateSponge(state, marble, frameDelta, events);
  updateCereal(
    state,
    marble,
    previousMarble,
    frameDelta,
    events,
    mapConfig.variantId === kitchenFloorMapId,
  );
  updateAnts(state, marble, frameDelta, events);
  state.frameIndex += 1;
  return events;
}

export function createKitchenDynamics(state = createKitchenDynamicsState()) {
  return {
    state,
    reset(context) {
      return resetKitchenDynamics(state, context);
    },
    update(mapConfig, marble, previousMarble, frameDelta) {
      return updateKitchenDynamics(
        state,
        mapConfig,
        marble,
        previousMarble,
        frameDelta,
      );
    },
  };
}

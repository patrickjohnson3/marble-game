import { kitchenPoint } from "../maps/kitchen-layout.js";
import { antConfig } from "./game-config.js";
import { pointInEllipsePatch } from "./geometry.js";
import { createForkCollisionRects } from "./map-obstacles.js";
import {
  ELLIPTICAL_SURFACE_SHAPES,
  KITCHEN_FIXTURES,
  MAP_ELEMENT_TYPES,
} from "./map-elements.js";
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
const antWaterOutwardBias = 0.35;
const antWaterSoakRejectionThreshold = 0.05;
const antNeighborAvoidanceWeight = 1.7;
const antLiquidSpeedScales = Object.freeze({ gooPatch: 0.5, waterPatch: 0.75 });
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
  const individuality = ((index * 37 + 17) % 101) / 100;
  return {
    x: point.x * world.width,
    y: point.y * world.height,
    angle: Math.atan2(0.55 - point.y, 0.5 - point.x),
    alive: true,
    squished: false,
    mode: "forage",
    size: 0.92 + individuality * 0.16,
    speedScale: 0.88 + individuality * 0.24,
    turnBias: index % 2 ? -1 : 1,
    gaitPhase: index * 2.1,
    antennaPhase: index * 1.3,
    probeInFrames: antConfig.probeIntervalFrames * (0.5 + individuality),
    probeFrames: 0,
    alertFrames: 0,
    reactionFrames: antConfig.reactionFrames * (0.7 + individuality * 0.6),
    fleeFrames: 0,
    recoverFrames: 0,
    squishAge: 0,
    squishAngle: 0,
    squishStrength: 0,
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
      antCrushes: [],
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
      if (element.fixture === KITCHEN_FIXTURES.fork) {
        obstacles.push(...createForkCollisionRects(element));
      } else {
        obstacles.push(element);
      }
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
  state.events.antCrushes.length = 0;
  state.events.squishedAnts = 0;
  state.events.splatHits = 0;
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

  const clusters = mapConfig.clusters ?? [];
  for (const cluster of clusters) {
    for (const point of cluster.cheerios) {
      state.cheerios.push(createCereal(world, kitchenPoint(cluster, point)));
    }
  }
  for (const cluster of clusters) {
    for (const point of cluster.crumbs) {
      state.cheerios.push(
        createCereal(world, kitchenPoint(cluster, point), {
          kind: "crumb",
          radiusRatio: crumbRadiusRatio,
          rotation: cluster.angle + point[0] * 0.01,
        }),
      );
    }
    for (const point of cluster.ants) {
      state.ants.push(
        createAnt(world, kitchenPoint(cluster, point), state.ants.length),
      );
    }
  }
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
  return pointInEllipsePatch(
    x,
    y,
    patch,
    ELLIPTICAL_SURFACE_SHAPES.waterPatch,
    padding,
  );
}

function antLiquidAt(state, x, y, padding = 0) {
  for (const patch of state.terrainElements) {
    const shape = ELLIPTICAL_SURFACE_SHAPES[patch.type];
    if (shape && pointInEllipsePatch(x, y, patch, shape, padding)) return patch;
  }
  return null;
}

function cerealUnavailableToAnt(cereal, state) {
  if ((cereal.waterSoak ?? 0) >= antWaterSoakRejectionThreshold) return true;
  return Boolean(
    antLiquidAt(
      state,
      cereal.originX + cereal.pushX,
      cereal.originY + cereal.pushY,
    ),
  );
}

function nearestActiveCheerio(ant, state) {
  let bestIndex = -1;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i < state.cheerios.length; i++) {
    const cheerio = state.cheerios[i];
    if (!cheerio.active || cerealUnavailableToAnt(cheerio, state)) {
      continue;
    }

    const x = cheerio.originX + cheerio.pushX;
    const y = cheerio.originY + cheerio.pushY;
    const dx = x - ant.x;
    const dy = y - ant.y;
    let neighbors = 0;
    for (const other of state.ants) {
      if (other !== ant && other.alive && other.targetIndex === i) neighbors++;
    }
    const distanceSq = (dx * dx + dy * dy) * (1 + neighbors * 0.3);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function turnAntToward(ant, angle, limit) {
  const difference = Math.atan2(
    Math.sin(angle - ant.angle),
    Math.cos(angle - ant.angle),
  );
  ant.angle += Math.max(-limit, Math.min(limit, difference));
  ant.angle = Math.atan2(Math.sin(ant.angle), Math.cos(ant.angle));
}

function antSurfaceTangent(ant, normalX, normalY, desiredAngle) {
  const dot =
    -normalY * Math.cos(desiredAngle) + normalX * Math.sin(desiredAngle);
  const direction = Math.abs(dot) < 0.01 ? (ant.turnBias ?? 1) : Math.sign(dot);
  return Math.atan2(
    normalX * direction + normalY * antWaterOutwardBias,
    -normalY * direction + normalX * antWaterOutwardBias,
  );
}

function moveAnt(state, ant, desiredAngle, speed, frameDelta) {
  const oldX = ant.x;
  const oldY = ant.y;
  const step = speed * frameDelta;
  const feelDistance = Math.max(antConfig.feelAhead, step);
  const feelX = ant.x + Math.cos(ant.angle) * feelDistance;
  const feelY = ant.y + Math.sin(ant.angle) * feelDistance;
  const liquid = antLiquidAt(state, feelX, feelY, antConfig.liquidPadding);
  if (liquid) {
    const shape = ELLIPTICAL_SURFACE_SHAPES[liquid.type];
    const dx = ant.x - liquid.x - liquid.w * shape.centerX;
    const dy = ant.y - liquid.y - liquid.h * shape.centerY;
    const localX = shape.cos * dx + shape.sin * dy;
    const localY = -shape.sin * dx + shape.cos * dy;
    const nx =
      localX / Math.pow(liquid.w * shape.radiusX + antConfig.liquidPadding, 2);
    const ny =
      localY / Math.pow(liquid.h * shape.radiusY + antConfig.liquidPadding, 2);
    const length = Math.hypot(nx, ny) || 1;
    ant.angle = antSurfaceTangent(
      ant,
      (shape.cos * nx - shape.sin * ny) / length,
      (shape.sin * nx + shape.cos * ny) / length,
      desiredAngle,
    );
  }

  const circle = state.collisionCircle;
  circle.x = ant.x + Math.cos(ant.angle) * feelDistance;
  circle.y = ant.y + Math.sin(ant.angle) * feelDistance;
  circle.r = antConfig.radius;
  for (const obstacle of state.obstacles) {
    const contact = circleOrientedRectContact(
      circle,
      obstacle,
      0,
      state.collisionContact,
      collisionZeroDistanceEpsilon,
    );
    if (!contact.intersects) continue;
    const distance = Math.sqrt(contact.distanceSq);
    ant.angle = antSurfaceTangent(
      ant,
      distance > collisionZeroDistanceEpsilon
        ? contact.dx / distance
        : contact.insideNx,
      distance > collisionZeroDistanceEpsilon
        ? contact.dy / distance
        : contact.insideNy,
      desiredAngle,
    );
    break;
  }

  circle.x = ant.x + Math.cos(ant.angle) * step;
  circle.y = ant.y + Math.sin(ant.angle) * step;
  circle.vx = 0;
  circle.vy = 0;
  resolveCerealObstacleCollisions(
    circle,
    state.obstacles,
    state.collisionContact,
  );
  constrainCerealToWorld(circle, state.world);
  const nextLiquid = antLiquidAt(state, circle.x, circle.y, antConfig.radius);
  if (!nextLiquid || antLiquidAt(state, oldX, oldY, antConfig.radius)) {
    ant.x = circle.x;
    ant.y = circle.y;
  }
  // Feet advance with distance traveled, including short recoil and escape steps.
  ant.gaitPhase =
    ((ant.gaitPhase ?? 0) +
      Math.hypot(ant.x - oldX, ant.y - oldY) / antConfig.gaitDistance) %
    (Math.PI * 2);
}

function advanceAnt(state, ant, marble, frameDelta) {
  ant.mode = "forage";
  ant.antennaPhase =
    ((ant.antennaPhase ?? 0) + 0.16 * frameDelta) % (Math.PI * 2);
  ant.wobble = ((ant.wobble ?? 0) + 0.07 * frameDelta) % (Math.PI * 2);
  ant.recoverFrames = Math.max(0, (ant.recoverFrames ?? 0) - frameDelta);

  const awayX = ant.x - marble.x;
  const awayY = ant.y - marble.y;
  const distance = Math.hypot(awayX, awayY);
  const approach =
    ((marble.vx ?? 0) * awayX + (marble.vy ?? 0) * awayY) /
    Math.max(1, distance);
  const threatened =
    distance < marble.r + antConfig.threatDistance &&
    (approach > 0.25 || distance < marble.r + antConfig.radius * 3);
  if (
    !(ant.fleeFrames > 0) &&
    (threatened || ant.alertFrames > 0) &&
    ant.recoverFrames === 0
  ) {
    ant.alertFrames = (ant.alertFrames ?? 0) + frameDelta;
    if (ant.alertFrames < (ant.reactionFrames ?? antConfig.reactionFrames)) {
      ant.mode = "probe";
      return;
    }
    ant.fleeFrames = antConfig.fleeDurationFrames * (ant.speedScale ?? 1);
    ant.alertFrames = 0;
    ant.probeFrames = 0;
  }

  let desiredAngle;
  let speed =
    antConfig.speed * (ant.speedScale ?? 1) * (1 + Math.sin(ant.wobble) * 0.1);
  if (ant.fleeFrames > 0) {
    ant.mode = "flee";
    desiredAngle = Math.atan2(awayY, awayX) + (ant.turnBias ?? 1) * 0.28;
    speed = antConfig.fleeSpeed * (ant.speedScale ?? 1);
    ant.fleeFrames = Math.max(0, ant.fleeFrames - frameDelta);
    if (ant.fleeFrames === 0) {
      ant.recoverFrames = antConfig.recoverFrames;
      ant.probeFrames = antConfig.probeDurationFrames;
    }
  } else if ((ant.waterAvoidanceFrames ?? 0) > 0) {
    ant.waterAvoidanceFrames = Math.max(
      0,
      ant.waterAvoidanceFrames - frameDelta,
    );
    desiredAngle = ant.angle;
  } else {
    let target = state.cheerios[ant.targetIndex];
    if (target?.active && cerealUnavailableToAnt(target, state)) {
      ant.targetIndex = -1;
      ant.waterAvoidanceFrames = antConfig.waterAvoidanceFrames;
      ant.angle = Math.atan2(
        ant.y - target.originY - target.pushY,
        ant.x - target.originX - target.pushX,
      );
      desiredAngle = ant.angle;
    } else {
      if (!target?.active) {
        ant.targetIndex = nearestActiveCheerio(ant, state);
        target = state.cheerios[ant.targetIndex];
      }
      const dx = target
        ? target.originX + target.pushX - ant.x
        : Math.cos(ant.angle);
      const dy = target
        ? target.originY + target.pushY - ant.y
        : Math.sin(ant.angle);
      desiredAngle = Math.atan2(dy, dx) + Math.sin(ant.wobble) * 0.16;
      if (
        target &&
        Math.hypot(dx, dy) <= target.radius + antConfig.munchDistance
      ) {
        ant.mode = "eat";
        turnAntToward(ant, Math.atan2(dy, dx), antConfig.turnRate * frameDelta);
        target.eaten = Math.min(
          1,
          target.eaten + antConfig.munchRate * frameDelta,
        );
        if (target.eaten >= 1) target.active = false;
        return;
      }
      ant.probeInFrames =
        (ant.probeInFrames ?? antConfig.probeIntervalFrames) - frameDelta;
      if (ant.probeInFrames <= 0) {
        ant.probeFrames = antConfig.probeDurationFrames * (ant.speedScale ?? 1);
        ant.probeInFrames =
          antConfig.probeIntervalFrames *
          (1 + Math.sin(ant.antennaPhase) * 0.35);
      }
      if (ant.probeFrames > 0) {
        ant.probeFrames = Math.max(0, ant.probeFrames - frameDelta);
        ant.mode = "probe";
        turnAntToward(ant, desiredAngle, antConfig.turnRate * frameDelta * 0.2);
        return;
      }
      let headingX = Math.cos(desiredAngle);
      let headingY = Math.sin(desiredAngle);
      for (const other of state.ants) {
        if (other === ant || !other.alive) continue;
        const gapX = ant.x - other.x;
        const gapY = ant.y - other.y;
        const gap = Math.hypot(gapX, gapY);
        if (gap > 0 && gap < antConfig.radius * 3) {
          const weight =
            (1 - gap / (antConfig.radius * 3)) * antNeighborAvoidanceWeight;
          headingX += (gapX / gap) * weight;
          headingY += (gapY / gap) * weight;
        }
      }
      desiredAngle = Math.atan2(headingY, headingX);
    }
  }
  turnAntToward(
    ant,
    desiredAngle,
    (ant.mode === "flee" ? antConfig.fleeTurnRate : antConfig.turnRate) *
      frameDelta,
  );
  const liquidUnderAnt = antLiquidAt(state, ant.x, ant.y);
  if (liquidUnderAnt) speed *= antLiquidSpeedScales[liquidUnderAnt.type];
  moveAnt(state, ant, desiredAngle, speed, frameDelta);
}

function updateAnts(state, marble, previousMarble, frameDelta, events) {
  if (frameDelta <= 0) return;
  const sweepX = marble.x - previousMarble.x;
  const sweepY = marble.y - previousMarble.y;
  const sweepLength = Math.hypot(sweepX, sweepY);
  // A utensil can stop the marble after it has already rolled over an ant.
  const marbleSpeed = Math.max(
    Math.hypot(marble.vx || 0, marble.vy || 0),
    sweepLength / frameDelta,
  );
  for (const ant of state.ants) {
    setDistanceToSegment(
      ant.x,
      ant.y,
      previousMarble,
      marble,
      state.collisionContact,
    );
    const overlapsMarble =
      state.collisionContact.sweptDistance <= marble.r + antConfig.radius;
    if (ant.squished) {
      const oldAge = ant.squishAge ?? antConfig.squishDurationFrames;
      ant.squishAge = Math.min(
        antConfig.squishDurationFrames,
        oldAge + frameDelta,
      );
      if (ant.squishAge !== oldAge) ant.revision = (ant.revision ?? 0) + 1;
      if (
        overlapsMarble &&
        marbleSpeed >= antConfig.splatMinSpeed &&
        state.frameIndex -
          (ant.lastSplatFeedbackFrame ?? Number.NEGATIVE_INFINITY) >=
          antConfig.splatFeedbackCooldownFrames
      ) {
        ant.lastSplatFeedbackFrame = state.frameIndex;
        events.splatHits += 1;
      }
      continue;
    }
    if (!ant.alive) continue;
    if (overlapsMarble && marbleSpeed >= antConfig.squishMinSpeed) {
      ant.alive = false;
      ant.squished = true;
      ant.mode = "squished";
      ant.squishAge = 0;
      ant.squishAngle =
        sweepLength > collisionZeroDistanceEpsilon
          ? Math.atan2(sweepY, sweepX)
          : Math.atan2(marble.vy || 0, marble.vx || 0);
      ant.squishStrength = Math.min(
        1,
        marbleSpeed / (antConfig.squishMinSpeed * 6),
      );
      ant.targetIndex = -1;
      ant.lastSplatFeedbackFrame = state.frameIndex;
      ant.revision = (ant.revision ?? 0) + 1;
      events.squishedAnts += 1;
      events.antCrushes.push(ant);
      continue;
    }
    if (
      marbleSpeed >= antConfig.splatMinSpeed &&
      state.collisionContact.sweptDistance < marble.r + antConfig.radius * 3 &&
      !(ant.fleeFrames > 0) &&
      !(ant.recoverFrames > 0)
    ) {
      // A close pass can already be behind an ant when its reaction begins.
      ant.alertFrames = Math.max(ant.alertFrames ?? 0, Number.EPSILON);
    }
    // Normal play is at most two frame units; slicing also keeps long updates
    // from stepping over a utensil or skipping an entire hesitation.
    for (let remaining = frameDelta; remaining > 0; remaining -= 2) {
      advanceAnt(state, ant, marble, Math.min(2, remaining));
    }
    ant.revision = (ant.revision ?? 0) + 1;
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
  events.antCrushes.length = 0;
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
  updateAnts(state, marble, previousMarble, frameDelta, events);
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

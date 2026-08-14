import { MAP_ELEMENT_TYPES } from "./map-elements.js";
import { circleOrientedRectContact } from "./physics-collisions.js";

const cheerioRadiusRatio = 0.00525;
const cheerioShovePadding = 18;
const cheerioMaxPushRadiusMultiplier = 3.2;
const collisionZeroDistanceEpsilon = 0.001;
const defaultSurfaceInfluence = Object.freeze({
  maxPush: 1,
  shove: 0.78,
  speed: 0.04,
});
const surfaceInfluences = Object.freeze({
  gooPatch: Object.freeze({ maxPush: 0.55, shove: 0.36, speed: 0.015 }),
  icePatch: Object.freeze({ maxPush: 1.35, shove: 1.08, speed: 0.08 }),
  roughPatch: Object.freeze({ maxPush: 0.75, shove: 0.55, speed: 0.025 }),
  waterPatch: Object.freeze({ maxPush: 1.18, shove: 0.92, speed: 0.06 }),
});
const cheerioObstacleSeparation = 0.5;
const obstacleResolvePasses = 2;
const antRadius = 7;
const antSpeed = 0.9;
const antMunchDistance = 20;
const antMunchRate = 0.006;
const antSquishMinSpeed = 1.2;
const antSplatMinSpeed = 0.7;
const antSplatFeedbackCooldownFrames = 24;
const crumbRadiusRatio = 0.0032;
const cerealHitMinSpeed = 0.8;
const cerealHitFeedbackCooldownFrames = 20;
const kitchenFloorMapId = "kitchen-floor";
const cheerioWaterSoakRate = 0.006;

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
    collisionCircle: { x: 0, y: 0, r: 0 },
    collisionContact: {},
    events: { cerealHits: 0, splatHits: 0, squishedAnts: 0 },
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

export function resetKitchenDynamics(state, { mapConfig, world }) {
  state.ants = [];
  state.cheerios = [];
  state.elementCacheSource = null;
  state.frameIndex = 0;
  state.obstacles = [];
  state.terrainElements = [];
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
  state.obstacles = caches.obstacles;
  state.terrainElements = caches.terrainElements;
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

function nearestActiveCheerio(ant, cheerios) {
  let bestIndex = -1;
  let bestDistanceSq = Number.POSITIVE_INFINITY;

  for (let i = 0; i < cheerios.length; i++) {
    const cheerio = cheerios[i];
    if (!cheerio.active) continue;

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

function antTarget(ant, cheerios) {
  if (
    ant.targetIndex < 0 ||
    !cheerios[ant.targetIndex] ||
    !cheerios[ant.targetIndex].active
  ) {
    ant.targetIndex = nearestActiveCheerio(ant, cheerios);
  }

  return cheerios[ant.targetIndex] ?? null;
}

function updateAnts({ state, frameDelta, marble, events }) {
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

    const target = antTarget(ant, state.cheerios);
    if (!target) continue;

    const targetX = target.originX + target.pushX;
    const targetY = target.originY + target.pushY;
    const dx = targetX - ant.x;
    const dy = targetY - ant.y;
    const munchDistance = target.radius + antMunchDistance;
    if (dx * dx + dy * dy <= munchDistance * munchDistance) {
      target.eaten = Math.min(1, target.eaten + antMunchRate * frameDelta);
      if (target.eaten >= 1) target.active = false;
      continue;
    }

    ant.angle = Math.atan2(dy, dx) + Math.sin(ant.wobble) * 0.18;
    ant.wobble += 0.11 * frameDelta;
    ant.x += Math.cos(ant.angle) * antSpeed * frameDelta;
    ant.y += Math.sin(ant.angle) * antSpeed * frameDelta;
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
}

function resolveCerealObstacleCollisions(circle, obstacles, contact) {
  for (let pass = 0; pass < obstacleResolvePasses; pass++) {
    for (let i = 0; i < obstacles.length; i++) {
      resolveCerealObstacleCollision(circle, obstacles[i], contact);
    }
  }
}

function updateCereal({
  state,
  marble,
  previousMarble,
  events,
  frameDelta,
  soakInWater,
}) {
  for (let i = 0; i < state.cheerios.length; i++) {
    const cereal = state.cheerios[i];
    if (!cereal.active) continue;

    if (soakInWater) {
      soakPlayerDisturbedCheerio(cereal, state.terrainElements, frameDelta);
    }

    const { originX, originY, radius, pushX, pushY } = cereal;
    const currentX = originX + pushX;
    const currentY = originY + pushY;
    const shoveDistance = marble.r + radius + cheerioShovePadding;
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
    const maxPush =
      marble.r * cheerioMaxPushRadiusMultiplier * influence.maxPush;
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
    const amount =
      (shoveDistance - distance) * influence.shove + speed * influence.speed;
    const nextPushX = pushX + nx * amount;
    const nextPushY = pushY + ny * amount;
    const pushScale = cappedVectorScale(nextPushX, nextPushY, maxPush);
    const cerealCircle = state.collisionCircle;
    cerealCircle.x = originX + nextPushX * pushScale;
    cerealCircle.y = originY + nextPushY * pushScale;
    cerealCircle.r = radius;

    resolveCerealObstacleCollisions(
      cerealCircle,
      state.obstacles,
      state.collisionContact,
    );
    cereal.pushX = cerealCircle.x - originX;
    cereal.pushY = cerealCircle.y - originY;
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
  { mapConfig, marble, previousMarble = marble, frameDelta = 1 },
) {
  const events = state.events;
  events.cerealHits = 0;
  events.splatHits = 0;
  events.squishedAnts = 0;
  if (mapConfig?.theme !== "kitchenFloor" || !marble) return events;

  ensureElementCaches(state, mapConfig.elements);
  updateCereal({
    state,
    marble,
    previousMarble,
    events,
    frameDelta,
    soakInWater: mapConfig.id === kitchenFloorMapId,
  });
  updateAnts({ state, frameDelta, marble, events });
  state.frameIndex += 1;
  return events;
}

export function createKitchenDynamics(state = createKitchenDynamicsState()) {
  return {
    state,
    reset(context) {
      return resetKitchenDynamics(state, context);
    },
    update(context) {
      return updateKitchenDynamics(state, context);
    },
  };
}

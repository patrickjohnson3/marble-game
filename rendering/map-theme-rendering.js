import { MAP_ELEMENT_TYPES } from "../core/map-elements.js";
import { circleOrientedRectContact } from "../core/physics-collisions.js";

const realWorldThemes = new Set([
  "hockeyRink",
  "kitchenFloor",
  "livingRoom",
  "parkingLot",
  "sandLot",
]);

const kitchenCheerioRadiusRatio = 0.00525;
const kitchenCheerioShovePadding = 18;
const kitchenCheerioMaxPushRadiusMultiplier = 3.2;
const kitchenCheerioZeroDistanceEpsilon = 0.001;
const defaultCheerioSurfaceInfluence = Object.freeze({
  maxPush: 1,
  shove: 0.78,
  speed: 0.04,
});
const cheerioSurfaceInfluences = Object.freeze({
  gooPatch: Object.freeze({ maxPush: 0.55, shove: 0.36, speed: 0.015 }),
  icePatch: Object.freeze({ maxPush: 1.35, shove: 1.08, speed: 0.08 }),
  roughPatch: Object.freeze({ maxPush: 0.75, shove: 0.55, speed: 0.025 }),
  waterPatch: Object.freeze({ maxPush: 1.18, shove: 0.92, speed: 0.06 }),
});
const kitchenCheerioObstacleSeparation = 0.5;
const cheerioObstacleResolvePasses = 2;
const kitchenFloorCanvasScale = 0.4;
const kitchenDynamicCanvasScale = 0.35;
const kitchenAntRadius = 7;
const kitchenAntDrawRadius = 18;
const kitchenAntSpeed = 0.9;
const kitchenAntMunchDistance = 20;
const kitchenAntMunchRate = 0.006;
const kitchenAntSquishMinSpeed = 1.2;
const kitchenAntSplatMinSpeed = 0.7;
const kitchenAntSplatFeedbackCooldownFrames = 24;
const kitchenCheerioMinScale = 0.45;
const kitchenCheerioOpacityFloor = 0.18;
const kitchenCheerioSpriteUrl = "assets/sprites/cheerio.png";
const kitchenDynamicDirtyPadding = 18;
const kitchenCrumbRadiusRatio = 0.0032;
const kitchenCerealHitMinSpeed = 0.8;
const kitchenCerealHitFeedbackCooldownFrames = 20;
const kitchenAntSpawnPoints = Object.freeze([
  Object.freeze({ x: 0.04, y: 0.24 }),
  Object.freeze({ x: 0.08, y: 0.82 }),
  Object.freeze({ x: 0.18, y: 0.96 }),
  Object.freeze({ x: 0.36, y: 0.05 }),
  Object.freeze({ x: 0.54, y: 0.94 }),
  Object.freeze({ x: 0.72, y: 0.07 }),
  Object.freeze({ x: 0.9, y: 0.26 }),
  Object.freeze({ x: 0.96, y: 0.52 }),
  Object.freeze({ x: 0.86, y: 0.92 }),
  Object.freeze({ x: 0.47, y: 0.02 }),
]);
let kitchenCheerioSprite = null;

function getKitchenCheerioSprite() {
  if (kitchenCheerioSprite || typeof globalThis.Image !== "function") {
    return kitchenCheerioSprite;
  }

  kitchenCheerioSprite = new globalThis.Image();
  kitchenCheerioSprite.decoding = "async";
  kitchenCheerioSprite.src = kitchenCheerioSpriteUrl;
  return kitchenCheerioSprite;
}

function rectFromRatio(world, rect) {
  return {
    x: rect.x * world.width,
    y: rect.y * world.height,
    w: rect.w * world.width,
    h: rect.h * world.height,
  };
}

function applyBox(element, rect) {
  element.style.left = rect.x + "px";
  element.style.top = rect.y + "px";
  element.style.width = rect.w + "px";
  element.style.height = rect.h + "px";
}

function appendBox(parent, className, world, rect, options = {}) {
  const element = document.createElement("div");

  element.className = className;
  applyBox(element, rectFromRatio(world, rect));
  if (Number.isFinite(options.angle)) {
    element.style.setProperty("--theme-angle", options.angle + "rad");
  }
  parent.appendChild(element);
  return element;
}

function appendCircle(parent, className, world, circle) {
  return appendBox(parent, className, world, {
    x: circle.x - circle.r,
    y: circle.y - circle.r,
    w: circle.r * 2,
    h: circle.r * 2,
  });
}

function appendKitchenCereal(world, circle, themeState, options = {}) {
  const state = {
    kind: options.kind ?? "cheerio",
    originX: circle.x * world.width,
    originY: circle.y * world.height,
    pushX: 0,
    pushY: 0,
    radius: (options.radiusRatio ?? kitchenCheerioRadiusRatio) * world.width,
    eaten: 0,
    active: true,
    rotation: options.rotation ?? 0,
    lastHitFeedbackFrame: Number.NEGATIVE_INFINITY,
    sweptClosestX: 0,
    sweptClosestY: 0,
    sweptDistance: 0,
  };

  themeState.kitchenCheerios.push(state);
}

function appendKitchenCheerio(world, circle, themeState) {
  appendKitchenCereal(world, circle, themeState);
}

function appendKitchenCrumb(world, circle, themeState) {
  appendKitchenCereal(world, circle, themeState, {
    kind: "crumb",
    radiusRatio: circle.radiusRatio ?? kitchenCrumbRadiusRatio,
    rotation: circle.rotation ?? 0,
  });
}

function appendKitchenDynamicCanvas(parent, world, themeState) {
  const canvas = document.createElement("canvas");

  canvas.className = "kitchenDynamicCanvas";
  canvas.width = Math.ceil(world.width * kitchenDynamicCanvasScale);
  canvas.height = Math.ceil(world.height * kitchenDynamicCanvasScale);
  applyBox(canvas, { x: 0, y: 0, w: world.width, h: world.height });
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute(
    "data-kitchen-dynamics",
    String(kitchenAntSpawnPoints.length),
  );
  parent.appendChild(canvas);

  themeState.kitchenDynamicCanvas = canvas;
  themeState.kitchenDynamicContext = canvas.getContext("2d");
  themeState.kitchenDynamicWorld = world;
  themeState.kitchenDynamicRenderScale = kitchenDynamicCanvasScale;
  themeState.kitchenDynamicNeedsFullRedraw = true;
  themeState.kitchenAnts = kitchenAntSpawnPoints.map((point, index) => ({
    x: point.x * world.width,
    y: point.y * world.height,
    angle: (index % 2) * Math.PI,
    alive: true,
    squished: false,
    lastSplatFeedbackFrame: Number.NEGATIVE_INFINITY,
    needsRedraw: true,
    targetIndex: -1,
    wobble: index * 1.7,
  }));
  const cheerioSprite = getKitchenCheerioSprite();
  if (
    cheerioSprite &&
    !cheerioSprite.complete &&
    cheerioSprite.addEventListener
  ) {
    cheerioSprite.addEventListener(
      "load",
      () => {
        themeState.kitchenDynamicNeedsFullRedraw = true;
        renderKitchenDynamics(themeState);
      },
      { once: true },
    );
  }
  renderKitchenDynamics(themeState);
}

function appendFloor(parent, theme, world, rect = {}) {
  appendBox(parent, "mapThemeSurface " + theme + "Surface", world, {
    x: rect.x ?? 0.055,
    y: rect.y ?? 0.055,
    w: rect.w ?? 0.89,
    h: rect.h ?? 0.89,
  });
}

function appendKitchenFloorCanvas(parent, world) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const tileSize = 220;

  canvas.className = "kitchenFloorCanvas";
  canvas.width = Math.ceil(world.width * kitchenFloorCanvasScale);
  canvas.height = Math.ceil(world.height * kitchenFloorCanvasScale);
  applyBox(canvas, { x: 0, y: 0, w: world.width, h: world.height });
  canvas.setAttribute("aria-hidden", "true");
  parent.appendChild(canvas);
  if (!context) return;

  context.setTransform(
    kitchenFloorCanvasScale,
    0,
    0,
    kitchenFloorCanvasScale,
    0,
    0,
  );
  context.fillStyle = "#dec684";
  context.fillRect(0, 0, world.width, world.height);

  for (let y = 0; y < world.height; y += tileSize) {
    for (let x = 0; x < world.width; x += tileSize) {
      const alternate = (x / tileSize + y / tileSize) % 2 === 0;
      context.fillStyle = alternate ? "#ead9a8" : "#cdb16d";
      context.fillRect(x, y, tileSize, tileSize);
      context.fillStyle = alternate ? "#fff2bc26" : "#7a622626";
      context.fillRect(x + 12, y + 12, tileSize - 24, tileSize - 24);
    }
  }

  context.strokeStyle = "#7e6a3a4d";
  context.lineWidth = 3;
  for (let x = 0; x <= world.width; x += tileSize) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, world.height);
    context.stroke();
  }
  for (let y = 0; y <= world.height; y += tileSize) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(world.width, y);
    context.stroke();
  }

  for (let y = 70; y < world.height; y += 275) {
    for (let x = 70; x < world.width; x += 335) {
      context.fillStyle = (x + y) % 2 === 0 ? "#fff8d94a" : "#745d2a26";
      context.beginPath();
      context.ellipse(x, y, 3, 3, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  [
    { x: 0.18, y: 0.58, rx: 30, ry: 8, angle: 0.22 },
    { x: 0.32, y: 0.72, rx: 42, ry: 10, angle: -0.18 },
    { x: 0.64, y: 0.44, rx: 28, ry: 7, angle: 0.35 },
    { x: 0.78, y: 0.68, rx: 36, ry: 9, angle: -0.28 },
  ].forEach((smudge) => {
    context.fillStyle = "#7b633026";
    context.beginPath();
    context.ellipse(
      smudge.x * world.width,
      smudge.y * world.height,
      smudge.rx,
      smudge.ry,
      smudge.angle,
      0,
      Math.PI * 2,
    );
    context.fill();
  });
}

function renderHockeyRink({ underlay, overlay, world }) {
  appendFloor(underlay, "hockeyRink", world);
  appendBox(underlay, "rinkLine redLine horizontal", world, {
    x: 0.08,
    y: 0.496,
    w: 0.84,
    h: 0.008,
  });
  [0.32, 0.68].forEach((y) =>
    appendBox(underlay, "rinkLine blueLine horizontal", world, {
      x: 0.08,
      y,
      w: 0.84,
      h: 0.007,
    }),
  );
  appendCircle(underlay, "rinkCircle centerCircle", world, {
    x: 0.5,
    y: 0.5,
    r: 0.09,
  });
  [
    { x: 0.26, y: 0.24 },
    { x: 0.74, y: 0.24 },
    { x: 0.26, y: 0.76 },
    { x: 0.74, y: 0.76 },
  ].forEach((circle) =>
    appendCircle(underlay, "rinkCircle faceoffCircle", world, {
      ...circle,
      r: 0.06,
    }),
  );
  [0.105, 0.855].forEach((y) =>
    appendBox(overlay, "goalCrease", world, { x: 0.42, y, w: 0.16, h: 0.055 }),
  );
  [
    { x: 0.18, y: 0.58, w: 0.24, h: 0.018, angle: 0.38 },
    { x: 0.62, y: 0.32, w: 0.22, h: 0.018, angle: -0.42 },
  ].forEach((stick) =>
    appendBox(overlay, "themeObject hockeyStick", world, stick, {
      angle: stick.angle,
    }),
  );
  [
    { x: 0.26, y: 0.61, r: 0.018 },
    { x: 0.71, y: 0.29, r: 0.016 },
  ].forEach((puck) =>
    appendCircle(overlay, "themeObject hockeyPuck", world, puck),
  );
}

function renderKitchenStaticFloor({ underlay, world }) {
  appendKitchenFloorCanvas(underlay, world);
}

function renderKitchenDynamicObjects({ overlay, themeState, world }) {
  [
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
  ].forEach((circle) => appendKitchenCheerio(world, circle, themeState));
  [
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
  ].forEach((circle) => appendKitchenCrumb(world, circle, themeState));
  appendKitchenDynamicCanvas(overlay, world, themeState);
}

function renderKitchenFloor({ underlay, overlay, themeState, world }) {
  renderKitchenStaticFloor({ underlay, world });
  renderKitchenDynamicObjects({ overlay, themeState, world });
}

function renderLivingRoom({ underlay, overlay, world }) {
  appendFloor(underlay, "livingRoom", world);
  appendBox(underlay, "themeRug", world, { x: 0.25, y: 0.3, w: 0.42, h: 0.34 });
  [
    { x: 0.1, y: 0.16, w: 0.34, h: 0.11 },
    { x: 0.7, y: 0.14, w: 0.12, h: 0.3 },
    { x: 0.35, y: 0.47, w: 0.24, h: 0.11 },
  ].forEach((rect) => appendBox(overlay, "themeObject sofa", world, rect));
  [
    { x: 0.13, y: 0.75, w: 0.22, h: 0.06 },
    { x: 0.69, y: 0.7, w: 0.2, h: 0.06 },
  ].forEach((rect) => appendBox(overlay, "themeObject shelf", world, rect));
  appendBox(overlay, "themeObject coffeeTable", world, {
    x: 0.4,
    y: 0.53,
    w: 0.18,
    h: 0.08,
  });
  [
    { x: 0.22, y: 0.62, w: 0.045, h: 0.045 },
    { x: 0.63, y: 0.38, w: 0.04, h: 0.04 },
    { x: 0.74, y: 0.82, w: 0.05, h: 0.05 },
  ].forEach((rect) => appendBox(overlay, "themeObject toyBlock", world, rect));
  appendBox(overlay, "themeObject sock", world, {
    x: 0.54,
    y: 0.73,
    w: 0.09,
    h: 0.045,
  });
}

function renderParkingLot({ underlay, overlay, world }) {
  appendFloor(underlay, "parkingLot", world);
  [0.2, 0.36, 0.52, 0.68].forEach((x) =>
    appendBox(underlay, "parkingStripe", world, {
      x,
      y: 0.13,
      w: 0.006,
      h: 0.7,
    }),
  );
  [0.22, 0.52, 0.75].forEach((y) =>
    appendBox(underlay, "parkingDriveLine", world, {
      x: 0.1,
      y,
      w: 0.8,
      h: 0.004,
    }),
  );
  [
    { x: 0.16, y: 0.13, w: 0.18, h: 0.08 },
    { x: 0.47, y: 0.13, w: 0.18, h: 0.08 },
    { x: 0.14, y: 0.37, w: 0.08, h: 0.2 },
    { x: 0.75, y: 0.35, w: 0.08, h: 0.2 },
    { x: 0.32, y: 0.65, w: 0.22, h: 0.08 },
    { x: 0.66, y: 0.69, w: 0.2, h: 0.08 },
  ].forEach((rect) => appendBox(overlay, "themeObject parkedCar", world, rect));
  appendBox(underlay, "themeOil", world, {
    x: 0.42,
    y: 0.38,
    w: 0.13,
    h: 0.09,
  });
  [
    { x: 0.16, y: 0.78, w: 0.2, h: 0.025, angle: -0.08 },
    { x: 0.52, y: 0.58, w: 0.24, h: 0.025, angle: 0.14 },
  ].forEach((mark) =>
    appendBox(underlay, "parkingTireMark", world, mark, { angle: mark.angle }),
  );
  [
    { x: 0.28, y: 0.84, w: 0.04, h: 0.06 },
    { x: 0.6, y: 0.47, w: 0.04, h: 0.06 },
    { x: 0.84, y: 0.26, w: 0.04, h: 0.06 },
  ].forEach((rect) =>
    appendBox(overlay, "themeObject trafficCone", world, rect),
  );
}

function renderSandLot({ underlay, overlay, world }) {
  appendFloor(underlay, "sandLot", world);
  [
    { x: 0.2, y: 0.18, w: 0.38, h: 0.035, angle: 0.28 },
    { x: 0.55, y: 0.46, w: 0.32, h: 0.035, angle: -0.4 },
    { x: 0.25, y: 0.78, w: 0.42, h: 0.035, angle: 0.12 },
  ].forEach((track) =>
    appendBox(underlay, "sandTrack", world, track, { angle: track.angle }),
  );
  [
    { x: 0.28, y: 0.43, r: 0.035 },
    { x: 0.7, y: 0.23, r: 0.028 },
    { x: 0.78, y: 0.72, r: 0.035 },
    { x: 0.44, y: 0.67, r: 0.025 },
  ].forEach((circle) =>
    appendCircle(overlay, "themeObject sandRock", world, circle),
  );
  [
    { x: 0.24, y: 0.5, w: 0.06, h: 0.04 },
    { x: 0.62, y: 0.18, w: 0.055, h: 0.038 },
    { x: 0.73, y: 0.6, w: 0.06, h: 0.04 },
  ].forEach((rect) => appendBox(overlay, "themeObject sandCrate", world, rect));
  [
    { x: 0.36, y: 0.25, w: 0.07, h: 0.055 },
    { x: 0.58, y: 0.77, w: 0.075, h: 0.058 },
  ].forEach((rect) =>
    appendBox(overlay, "themeObject sandBucket", world, rect),
  );
  appendBox(
    overlay,
    "themeObject sandShovel",
    world,
    {
      x: 0.15,
      y: 0.68,
      w: 0.16,
      h: 0.035,
      angle: -0.38,
    },
    { angle: -0.38 },
  );
}

const renderers = {
  hockeyRink: renderHockeyRink,
  kitchenFloor: renderKitchenFloor,
  livingRoom: renderLivingRoom,
  parkingLot: renderParkingLot,
  sandLot: renderSandLot,
};

export function isRealWorldTheme(theme) {
  return realWorldThemes.has(theme);
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

function pointInRect(x, y, rect) {
  return (
    x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  );
}

function cheerioSurfaceInfluence(x, y, elements = []) {
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const influence = cheerioSurfaceInfluences[element.type];
    if (influence && pointInRect(x, y, element)) return influence;
  }

  return defaultCheerioSurfaceInfluence;
}

function kitchenElementCaches(elements = []) {
  const obstacles = [];
  const terrainElements = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.type === MAP_ELEMENT_TYPES.obstacle) {
      obstacles.push(element);
    } else if (cheerioSurfaceInfluences[element.type]) {
      terrainElements.push(element);
    }
  }

  return { obstacles, terrainElements };
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

function updateCheerioMunchVisual(cheerio) {
  if (cheerio.eaten >= 1) {
    cheerio.active = false;
  }
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

function updateKitchenAnts({
  ants,
  cheerios,
  frameDelta,
  frameIndex,
  marble,
  visibleWorld,
}) {
  let splatHits = 0;
  let squishedAnts = 0;
  const marbleSpeed = Math.hypot(marble.vx || 0, marble.vy || 0);
  const squishDistance = marble.r + kitchenAntRadius;
  const squishDistanceSq = squishDistance * squishDistance;

  for (let i = 0; i < ants.length; i++) {
    const ant = ants[i];
    if (!dynamicBoundsVisible(antBounds(ant), visibleWorld)) continue;

    const marbleDx = ant.x - marble.x;
    const marbleDy = ant.y - marble.y;
    const overlapsMarble =
      marbleDx * marbleDx + marbleDy * marbleDy <= squishDistanceSq;
    if (ant.squished) {
      if (
        overlapsMarble &&
        marbleSpeed >= kitchenAntSplatMinSpeed &&
        frameIndex - (ant.lastSplatFeedbackFrame ?? Number.NEGATIVE_INFINITY) >=
          kitchenAntSplatFeedbackCooldownFrames
      ) {
        ant.lastSplatFeedbackFrame = frameIndex;
        splatHits += 1;
      }
      continue;
    }

    if (marbleSpeed >= kitchenAntSquishMinSpeed && overlapsMarble) {
      ant.alive = false;
      ant.squished = true;
      ant.lastSplatFeedbackFrame = frameIndex;
      ant.needsRedraw = true;
      squishedAnts += 1;
      continue;
    }

    const target = antTarget(ant, cheerios);
    if (!target) continue;

    const targetX = target.originX + target.pushX;
    const targetY = target.originY + target.pushY;
    const dx = targetX - ant.x;
    const dy = targetY - ant.y;
    const munchDistance = target.radius + kitchenAntMunchDistance;
    if (dx * dx + dy * dy <= munchDistance * munchDistance) {
      target.eaten = Math.min(
        1,
        target.eaten + kitchenAntMunchRate * frameDelta,
      );
      updateCheerioMunchVisual(target);
      continue;
    }

    ant.angle = Math.atan2(dy, dx) + Math.sin(ant.wobble) * 0.18;
    ant.wobble += 0.11 * frameDelta;
    ant.x += Math.cos(ant.angle) * kitchenAntSpeed * frameDelta;
    ant.y += Math.sin(ant.angle) * kitchenAntSpeed * frameDelta;
  }

  return { splatHits, squishedAnts };
}

function drawAnt(context, ant) {
  const cos = Math.cos(ant.angle);
  const sin = Math.sin(ant.angle);
  const sideX = -sin;
  const sideY = cos;

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#110d09";
  context.lineWidth = 1.6;
  context.beginPath();
  for (let leg = -1; leg <= 1; leg++) {
    const along = leg * 4;
    const baseX = ant.x + cos * along;
    const baseY = ant.y + sin * along;
    context.moveTo(baseX + sideX * 2.4, baseY + sideY * 2.4);
    context.lineTo(
      baseX - cos * 3 + sideX * (8.5 + leg * 0.8),
      baseY - sin * 3 + sideY * (8.5 + leg * 0.8),
    );
    context.moveTo(baseX - sideX * 2.4, baseY - sideY * 2.4);
    context.lineTo(
      baseX - cos * 3 - sideX * (8.5 - leg * 0.8),
      baseY - sin * 3 - sideY * (8.5 - leg * 0.8),
    );
  }
  context.moveTo(ant.x + cos * 8, ant.y + sin * 8);
  context.lineTo(ant.x + cos * 13 + sideX * 4, ant.y + sin * 13 + sideY * 4);
  context.moveTo(ant.x + cos * 8, ant.y + sin * 8);
  context.lineTo(ant.x + cos * 13 - sideX * 4, ant.y + sin * 13 - sideY * 4);
  context.stroke();

  context.fillStyle = "#1a120c";
  context.strokeStyle = "#3a2615";
  context.lineWidth = 0.8;
  context.beginPath();
  context.ellipse(
    ant.x - cos * 6,
    ant.y - sin * 6,
    5.4,
    3.8,
    ant.angle,
    0,
    Math.PI * 2,
  );
  context.ellipse(ant.x, ant.y, 4.1, 3.1, ant.angle, 0, Math.PI * 2);
  context.ellipse(
    ant.x + cos * 6,
    ant.y + sin * 6,
    3.4,
    2.8,
    ant.angle,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.stroke();

  context.fillStyle = "#6f4a21";
  context.globalAlpha = 0.5;
  context.beginPath();
  context.ellipse(
    ant.x - cos * 7 - sideX * 1.2,
    ant.y - sin * 7 - sideY * 1.2,
    1.2,
    0.8,
    ant.angle,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.globalAlpha = 1;
  context.restore();
}

function drawSquishedAnt(context, ant) {
  const cos = Math.cos(ant.angle);
  const sin = Math.sin(ant.angle);
  const sideX = -sin;
  const sideY = cos;

  context.save();
  context.globalAlpha = 0.82;
  context.fillStyle = "#56611f";
  context.beginPath();
  context.ellipse(ant.x, ant.y, 13, 7, ant.angle, 0, Math.PI * 2);
  context.ellipse(
    ant.x - cos * 7 + sideX * 2,
    ant.y - sin * 7 + sideY * 2,
    6,
    3.5,
    ant.angle + 0.4,
    0,
    Math.PI * 2,
  );
  context.ellipse(
    ant.x + cos * 6 - sideX * 2,
    ant.y + sin * 6 - sideY * 2,
    5,
    3,
    ant.angle - 0.35,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.globalAlpha = 0.96;
  context.fillStyle = "#1b100a";
  context.beginPath();
  context.ellipse(
    ant.x - cos * 3,
    ant.y - sin * 3,
    5,
    2.2,
    ant.angle,
    0,
    Math.PI * 2,
  );
  context.ellipse(
    ant.x + cos * 5,
    ant.y + sin * 5,
    3.8,
    1.8,
    ant.angle,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.strokeStyle = "#0e0905";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(ant.x - sideX * 8, ant.y - sideY * 8);
  context.lineTo(ant.x + sideX * 8, ant.y + sideY * 8);
  context.moveTo(ant.x - cos * 8 - sideX * 5, ant.y - sin * 8 - sideY * 5);
  context.lineTo(ant.x + cos * 7 + sideX * 5, ant.y + sin * 7 + sideY * 5);
  context.stroke();
  context.restore();
}

function dynamicBounds(x, y, radius) {
  return {
    bottom: y + radius,
    left: x - radius,
    right: x + radius,
    top: y - radius,
  };
}

function paddedBounds(bounds) {
  return {
    bottom: bounds.bottom + kitchenDynamicDirtyPadding,
    left: bounds.left - kitchenDynamicDirtyPadding,
    right: bounds.right + kitchenDynamicDirtyPadding,
    top: bounds.top - kitchenDynamicDirtyPadding,
  };
}

function cheerioBounds(cheerio) {
  const radius =
    cheerio.radius * (1 - cheerio.eaten * (1 - kitchenCheerioMinScale));
  return paddedBounds(
    dynamicBounds(
      cheerio.originX + cheerio.pushX,
      cheerio.originY + cheerio.pushY,
      radius,
    ),
  );
}

function antBounds(ant) {
  return paddedBounds(dynamicBounds(ant.x, ant.y, kitchenAntDrawRadius));
}

function boundsChanged(a, b) {
  if (!b) return Boolean(a);

  return (
    !a ||
    Math.abs(a.left - b.left) > 0.1 ||
    Math.abs(a.top - b.top) > 0.1 ||
    Math.abs(a.right - b.right) > 0.1 ||
    Math.abs(a.bottom - b.bottom) > 0.1
  );
}

function rectsIntersect(a, b) {
  if (!a || !b) return false;

  return (
    a.left <= b.right &&
    b.left <= a.right &&
    a.top <= b.bottom &&
    b.top <= a.bottom
  );
}

function dynamicBoundsVisible(bounds, visibleWorld) {
  return !visibleWorld || rectsIntersect(bounds, visibleWorld);
}

function clearDynamicRect(context, scale, rect) {
  const left = Math.floor(rect.left * scale) - 1;
  const top = Math.floor(rect.top * scale) - 1;
  const right = Math.ceil(rect.right * scale) + 1;
  const bottom = Math.ceil(rect.bottom * scale) + 1;

  context.clearRect(left, top, right - left, bottom - top);
}

function dynamicObjectEntries(themeState) {
  const entries = [];
  const cheerios = themeState.kitchenCheerios ?? [];
  const ants = themeState.kitchenAnts ?? [];

  for (let i = 0; i < cheerios.length; i++) {
    const cheerio = cheerios[i];
    if (!cheerio.active && !cheerio.lastBounds) continue;
    entries.push({
      bounds: cheerio.active ? cheerioBounds(cheerio) : null,
      draw: (context) => drawCheerio(context, cheerio),
      object: cheerio,
    });
  }

  for (let i = 0; i < ants.length; i++) {
    const ant = ants[i];
    if (!ant.alive && !ant.squished && !ant.lastBounds) continue;
    entries.push({
      bounds: ant.alive || ant.squished ? antBounds(ant) : null,
      draw: (context) => {
        if (ant.squished) drawSquishedAnt(context, ant);
        else if (ant.alive) drawAnt(context, ant);
      },
      object: ant,
    });
  }

  return entries;
}

function dynamicDirtyRects(entries) {
  const dirtyRects = [];

  for (let i = 0; i < entries.length; i++) {
    const { bounds, object } = entries[i];
    if (object.needsRedraw || boundsChanged(object.lastBounds, bounds)) {
      if (object.lastBounds) dirtyRects.push(object.lastBounds);
      if (bounds) dirtyRects.push(bounds);
      object.needsRedraw = false;
    }
  }

  return dirtyRects;
}

function storeDynamicBounds(entries) {
  for (let i = 0; i < entries.length; i++) {
    const { bounds, object } = entries[i];
    object.lastBounds = bounds ? { ...bounds } : null;
  }
}

function drawFallbackCheerio(context, x, y, radius) {
  context.fillStyle = "#d89b3a";
  context.beginPath();
  context.ellipse(x, y, radius, radius, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f2d27a";
  context.beginPath();
  context.ellipse(
    x - radius * 0.12,
    y - radius * 0.14,
    radius * 0.55,
    radius * 0.52,
    0.2,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.fillStyle = "#c17b27";
  context.beginPath();
  context.ellipse(x, y, radius * 0.34, radius * 0.32, -0.2, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.ellipse(x, y, radius * 0.26, radius * 0.24, -0.2, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-over";
  context.strokeStyle = "#b87324";
  context.lineWidth = Math.max(1, radius * 0.1);
  context.beginPath();
  context.ellipse(x, y, radius * 0.88, radius * 0.86, 0, 0, Math.PI * 2);
  context.stroke();
}

function drawCerealCrumb(context, crumb, x, y, radius, opacity) {
  context.save();
  context.globalAlpha = opacity;
  context.translate?.(x, y);
  context.rotate?.(crumb.rotation ?? 0);
  context.fillStyle = "#d69a3b";
  context.beginPath();
  context.ellipse(0, 0, radius * 1.15, radius * 0.72, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f0c76e";
  context.beginPath();
  context.ellipse(
    -radius * 0.18,
    -radius * 0.12,
    radius * 0.62,
    radius * 0.38,
    -0.24,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.strokeStyle = "#9b621f";
  context.lineWidth = Math.max(1, radius * 0.14);
  context.beginPath();
  context.ellipse(0, 0, radius * 1.12, radius * 0.7, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawCheerioSprite(context, sprite, x, y, radius, opacity) {
  if (!sprite?.complete || sprite.naturalWidth <= 0) return false;

  const size = radius * 2;
  context.save();
  context.globalAlpha = opacity;
  context.drawImage(sprite, x - radius, y - radius, size, size);
  context.restore();
  return true;
}

function drawCheerio(context, cheerio) {
  if (!cheerio.active) return;

  const x = cheerio.originX + cheerio.pushX;
  const y = cheerio.originY + cheerio.pushY;
  const radius =
    cheerio.radius * (1 - cheerio.eaten * (1 - kitchenCheerioMinScale));
  const opacity = 1 - cheerio.eaten * (1 - kitchenCheerioOpacityFloor);
  const sprite = getKitchenCheerioSprite();

  if (cheerio.kind === "crumb") {
    drawCerealCrumb(context, cheerio, x, y, radius, opacity);
    return;
  }

  if (drawCheerioSprite(context, sprite, x, y, radius, opacity)) return;

  context.globalAlpha = opacity;
  drawFallbackCheerio(context, x, y, radius);
  context.globalAlpha = 1;
}

function renderKitchenDynamics(themeState) {
  const context = themeState.kitchenDynamicContext;
  const canvas = themeState.kitchenDynamicCanvas;
  const world = themeState.kitchenDynamicWorld;
  if (!context || !canvas || !world) return;

  const entries = dynamicObjectEntries(themeState);
  let dirtyRects = dynamicDirtyRects(entries);

  context.setTransform(1, 0, 0, 1, 0, 0);
  if (themeState.kitchenDynamicNeedsFullRedraw) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    dirtyRects = [
      {
        bottom: world.height,
        left: 0,
        right: world.width,
        top: 0,
      },
    ];
    themeState.kitchenDynamicNeedsFullRedraw = false;
  } else if (dirtyRects.length === 0) {
    return;
  } else {
    const scale = themeState.kitchenDynamicRenderScale;
    for (let i = 0; i < dirtyRects.length; i++) {
      clearDynamicRect(context, scale, dirtyRects[i]);
    }
  }

  context.setTransform(
    themeState.kitchenDynamicRenderScale,
    0,
    0,
    themeState.kitchenDynamicRenderScale,
    0,
    0,
  );

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.bounds) continue;
    for (let j = 0; j < dirtyRects.length; j++) {
      if (!rectsIntersect(entry.bounds, dirtyRects[j])) continue;
      entry.draw(context);
      break;
    }
  }
  storeDynamicBounds(entries);
}

function resolveCheerioObstacleCollision(cheerioCircle, obstacle, contact) {
  circleOrientedRectContact(
    cheerioCircle,
    obstacle,
    0,
    contact,
    kitchenCheerioZeroDistanceEpsilon,
  );
  if (!contact.intersects) return;

  let distance = Math.sqrt(contact.distanceSq);
  let nx = contact.dx / (distance || 1);
  let ny = contact.dy / (distance || 1);
  let overlap = cheerioCircle.r - distance;

  if (distance <= kitchenCheerioZeroDistanceEpsilon) {
    nx = Number.isFinite(contact.insideNx) ? contact.insideNx : 1;
    ny = Number.isFinite(contact.insideNy) ? contact.insideNy : 0;
    overlap = cheerioCircle.r + (contact.insideDistance || 0);
  }

  const separation = Math.max(0, overlap) + kitchenCheerioObstacleSeparation;
  cheerioCircle.x += nx * separation;
  cheerioCircle.y += ny * separation;
}

function resolveCheerioObstacleCollisions(cheerioCircle, elements = []) {
  const contact = {};

  for (let pass = 0; pass < cheerioObstacleResolvePasses; pass++) {
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      resolveCheerioObstacleCollision(cheerioCircle, element, contact);
    }
  }
}

export function updateMapThemeDynamics({
  mapConfig,
  marble,
  previousMarble = marble,
  frameDelta = 1,
  themeState = {},
  visibleWorld,
}) {
  const events = { splatHits: 0, squishedAnts: 0 };
  if (mapConfig?.theme !== "kitchenFloor" || !marble) return events;

  const cheerios = themeState?.kitchenCheerios ?? [];
  const frameIndex = themeState.kitchenAntFrameIndex ?? 0;
  const cacheValid =
    themeState.kitchenElementCacheSource === mapConfig.elements &&
    themeState.kitchenObstacles &&
    themeState.kitchenTerrainElements;
  const fallbackCaches = cacheValid
    ? null
    : kitchenElementCaches(mapConfig.elements);
  const kitchenObstacles = cacheValid
    ? themeState.kitchenObstacles
    : fallbackCaches.obstacles;
  const kitchenTerrainElements = cacheValid
    ? themeState.kitchenTerrainElements
    : fallbackCaches.terrainElements;
  if (fallbackCaches) {
    themeState.kitchenElementCacheSource = mapConfig.elements;
    themeState.kitchenObstacles = fallbackCaches.obstacles;
    themeState.kitchenTerrainElements = fallbackCaches.terrainElements;
  }

  cheerios.forEach((cheerio) => {
    if (!cheerio.active) return;
    if (!dynamicBoundsVisible(cheerioBounds(cheerio), visibleWorld)) return;

    const { originX, originY, radius, pushX, pushY } = cheerio;
    const currentX = originX + pushX;
    const currentY = originY + pushY;
    const shoveDistance = marble.r + radius + kitchenCheerioShovePadding;
    const minX = Math.min(previousMarble.x, marble.x) - shoveDistance;
    const maxX = Math.max(previousMarble.x, marble.x) + shoveDistance;
    const minY = Math.min(previousMarble.y, marble.y) - shoveDistance;
    const maxY = Math.max(previousMarble.y, marble.y) + shoveDistance;
    if (
      currentX < minX ||
      currentX > maxX ||
      currentY < minY ||
      currentY > maxY
    )
      return;

    setDistanceToSegment(currentX, currentY, previousMarble, marble, cheerio);
    const dx = currentX - cheerio.sweptClosestX;
    const dy = currentY - cheerio.sweptClosestY;
    const distance = cheerio.sweptDistance;
    const influence = cheerioSurfaceInfluence(
      currentX,
      currentY,
      kitchenTerrainElements,
    );
    const maxPush =
      marble.r * kitchenCheerioMaxPushRadiusMultiplier * influence.maxPush;
    if (distance >= shoveDistance) return;

    const speed = Math.hypot(marble.vx || 0, marble.vy || 0);
    const nx =
      distance > kitchenCheerioZeroDistanceEpsilon
        ? dx / distance
        : (marble.vx || 1) / Math.max(speed, 1);
    const ny =
      distance > kitchenCheerioZeroDistanceEpsilon
        ? dy / distance
        : (marble.vy || 0) / Math.max(speed, 1);
    const amount =
      (shoveDistance - distance) * influence.shove + speed * influence.speed;
    const nextPushX = pushX + nx * amount;
    const nextPushY = pushY + ny * amount;
    const pushScale = cappedVectorScale(nextPushX, nextPushY, maxPush);
    const cheerioCircle = {
      x: originX + nextPushX * pushScale,
      y: originY + nextPushY * pushScale,
      r: radius,
    };

    resolveCheerioObstacleCollisions(cheerioCircle, kitchenObstacles);

    cheerio.pushX = cheerioCircle.x - originX;
    cheerio.pushY = cheerioCircle.y - originY;
    if (
      speed >= kitchenCerealHitMinSpeed &&
      frameIndex - cheerio.lastHitFeedbackFrame >=
        kitchenCerealHitFeedbackCooldownFrames
    ) {
      cheerio.lastHitFeedbackFrame = frameIndex;
      events.cerealHits = (events.cerealHits ?? 0) + 1;
    }
  });

  const antEvents = updateKitchenAnts({
    ants: themeState?.kitchenAnts ?? [],
    cheerios,
    frameDelta,
    frameIndex,
    marble,
    visibleWorld,
  });
  events.splatHits = antEvents.splatHits;
  events.squishedAnts = antEvents.squishedAnts;
  themeState.kitchenAntFrameIndex = (themeState.kitchenAntFrameIndex ?? 0) + 1;
  renderKitchenDynamics(themeState);
  return events;
}

export function renderMapTheme({
  container,
  overlayContainer,
  mapConfig,
  themeState = {},
  world = mapConfig?.world,
}) {
  container.replaceChildren();
  overlayContainer.replaceChildren();
  themeState.kitchenCheerios = [];
  themeState.kitchenAnts = [];
  themeState.kitchenDynamicCanvas = null;
  themeState.kitchenDynamicContext = null;
  themeState.kitchenDynamicWorld = null;
  themeState.kitchenDynamicRenderScale = kitchenDynamicCanvasScale;
  themeState.kitchenDynamicNeedsFullRedraw = false;
  themeState.kitchenElementCacheSource = null;
  themeState.kitchenObstacles = [];
  themeState.kitchenTerrainElements = [];
  const theme = mapConfig?.theme;
  if (!theme || !renderers[theme] || !world) return;

  const kitchenCaches = kitchenElementCaches(mapConfig.elements);
  themeState.kitchenElementCacheSource = mapConfig.elements;
  themeState.kitchenObstacles = kitchenCaches.obstacles;
  themeState.kitchenTerrainElements = kitchenCaches.terrainElements;

  const underlay = document.createElement("div");
  const overlay = document.createElement("div");
  underlay.className = "mapThemeLayer theme-" + theme;
  overlay.className = "mapThemeOverlayLayer theme-" + theme;
  underlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-hidden", "true");

  renderers[theme]({ overlay, underlay, themeState, world });
  container.replaceChildren(underlay);
  overlayContainer.replaceChildren(overlay);
}

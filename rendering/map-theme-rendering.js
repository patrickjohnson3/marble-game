import { drawKitchenFloorDetails } from "./kitchen-floor-details.js";
import { antConfig } from "../core/game-config.js";

const kitchenFloorCanvasScale = 0.4;
const kitchenDynamicCanvasScale = 0.5;
const kitchenAntDrawRadius = 22;
const kitchenCheerioMinScale = 0.45;
const kitchenCheerioOpacityFloor = 0.18;
const kitchenCheerioSpriteUrl = "assets/sprites/cheerio.png";
const kitchenDynamicDirtyPadding = 18;
const kitchenSoggyCheerioScale = 1.14;
const kitchenWaterStainRadiusScale = 2.25;
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

function scheduleKitchenDynamicsRender(themeState, dynamicsState, canvas) {
  const render = () => {
    if (themeState.kitchenDynamicCanvas !== canvas) return;
    renderKitchenDynamics(themeState, dynamicsState);
  };
  if (typeof globalThis.requestAnimationFrame === "function") {
    globalThis.requestAnimationFrame(render);
  } else {
    render();
  }
}

function appendKitchenDynamicCanvas(parent, world, themeState, dynamicsState) {
  const canvas = document.createElement("canvas");

  canvas.className = "kitchenDynamicCanvas";
  canvas.width = Math.ceil(world.width * kitchenDynamicCanvasScale);
  canvas.height = Math.ceil(world.height * kitchenDynamicCanvasScale);
  applyBox(canvas, { x: 0, y: 0, w: world.width, h: world.height });
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute(
    "data-kitchen-dynamics",
    String(dynamicsState.ants.length),
  );
  parent.appendChild(canvas);

  themeState.kitchenDynamicCanvas = canvas;
  themeState.kitchenDynamicContext = canvas.getContext("2d");
  if (themeState.kitchenDynamicContext) {
    themeState.kitchenDynamicContext.imageSmoothingEnabled = true;
    themeState.kitchenDynamicContext.imageSmoothingQuality = "high";
  }
  themeState.kitchenDynamicWorld = world;
  themeState.kitchenDynamicRenderScale = kitchenDynamicCanvasScale;
  themeState.kitchenDynamicNeedsFullRedraw = true;
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
        scheduleKitchenDynamicsRender(themeState, dynamicsState, canvas);
      },
      { once: true },
    );
  }
  scheduleKitchenDynamicsRender(themeState, dynamicsState, canvas);
}

function appendFloor(parent, theme, world, rect = {}) {
  appendBox(parent, "mapThemeSurface " + theme + "Surface", world, {
    x: rect.x ?? 0.055,
    y: rect.y ?? 0.055,
    w: rect.w ?? 0.89,
    h: rect.h ?? 0.89,
  });
}

function appendKitchenFloorCanvas(parent, world, mapConfig) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const tileSize = 550;
  const tileTones = ["#e6e1d5", "#e8e3d8", "#e4dfd2", "#e7e2d6", "#e5e0d4"];

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
  context.fillStyle = "#c5bfb2";
  context.fillRect(0, 0, world.width, world.height);

  // Glazed ceramic has broad, quiet variation; all detail is baked on map load.
  for (let y = 0, row = 0; y < world.height; y += tileSize, row += 1) {
    for (let x = 0, column = 0; x < world.width; x += tileSize, column += 1) {
      const toneIndex =
        (column * 17 + row * 11 + Math.floor(column * row * 0.37)) %
        tileTones.length;
      context.fillStyle = tileTones[toneIndex];
      context.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

      const glaze = context.createLinearGradient(
        x,
        y,
        x + tileSize,
        y + tileSize,
      );
      glaze.addColorStop(0, "#fffdf61a");
      glaze.addColorStop(0.5, "#fffdf600");
      glaze.addColorStop(1, "#685e4f06");
      context.fillStyle = glaze;
      context.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);

      context.strokeStyle = "#fffdf64a";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(x + 3.5, y + tileSize - 3.5);
      context.lineTo(x + 3.5, y + 3.5);
      context.lineTo(x + tileSize - 3.5, y + 3.5);
      context.stroke();
    }
  }

  // Sparse marks break repetition without carpeting the floor in tiny noise.
  context.strokeStyle = "#786d5b14";
  context.lineWidth = 3;
  for (const scuff of [
    { x: 0.18, y: 0.58, rx: 34, ry: 8, angle: 0.22 },
    { x: 0.32, y: 0.72, rx: 48, ry: 10, angle: -0.18 },
    { x: 0.78, y: 0.68, rx: 39, ry: 9, angle: -0.28 },
  ]) {
    context.beginPath();
    context.ellipse(
      scuff.x * world.width,
      scuff.y * world.height,
      scuff.rx,
      scuff.ry,
      scuff.angle,
      0.25,
      Math.PI * 1.3,
    );
    context.stroke();
  }

  context.strokeStyle = "#8277652a";
  context.lineWidth = 1.6;
  for (const crack of [
    { x: world.width * 0.13, y: world.height * 0.82, direction: 1 },
    { x: world.width * 0.72, y: world.height * 0.88, direction: -1 },
  ]) {
    context.beginPath();
    context.moveTo(crack.x - 60 * crack.direction, crack.y - 23);
    context.lineTo(crack.x - 22 * crack.direction, crack.y - 5);
    context.lineTo(crack.x + 14 * crack.direction, crack.y + 36);
    context.lineTo(crack.x + 48 * crack.direction, crack.y + 50);
    context.moveTo(crack.x - 22 * crack.direction, crack.y - 5);
    context.lineTo(crack.x - 6 * crack.direction, crack.y - 29);
    context.stroke();
  }

  context.fillStyle = "#a79b8747";
  for (const chip of [
    { column: 2, row: 3 },
    { column: 6, row: 1 },
    { column: 5, row: 7 },
  ]) {
    const x = chip.column * tileSize + 2;
    const y = chip.row * tileSize + 2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 10, y);
    context.lineTo(x + 4, y + 5);
    context.lineTo(x, y + 9);
    context.closePath();
    context.fill();
  }

  // A faded cup ring is a floor stain, not a new obstacle or liquid surface.
  context.strokeStyle = "#8c79601a";
  context.lineWidth = 4;
  context.beginPath();
  context.ellipse(
    world.width * 0.9,
    world.height * 0.54,
    75,
    58,
    0.24,
    0.1,
    Math.PI * 1.8,
  );
  context.stroke();
  drawKitchenFloorDetails(context, world, mapConfig);
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

function renderKitchenStaticFloor({ underlay, world, mapConfig }) {
  appendKitchenFloorCanvas(underlay, world, mapConfig);
}

function renderKitchenDynamicObjects({
  dynamicsState,
  overlay,
  themeState,
  world,
}) {
  appendKitchenDynamicCanvas(overlay, world, themeState, dynamicsState);
}

function renderKitchenFloor({
  mapConfig,
  dynamicsState,
  underlay,
  overlay,
  themeState,
  world,
}) {
  renderKitchenStaticFloor({ underlay, world, mapConfig });
  renderKitchenDynamicObjects({ dynamicsState, overlay, themeState, world });
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

function transformAnt(context, ant) {
  const size = ant.size ?? 1;
  const cos = Math.cos(ant.angle) * size;
  const sin = Math.sin(ant.angle) * size;
  context.transform(cos, sin, -sin, cos, ant.x, ant.y);
  context.lineCap = "round";
  context.lineJoin = "round";
}

function drawAntBody(context, flatten, headOffset, squished) {
  // The thin waist and neck keep the three segments distinct at half resolution.
  context.strokeStyle = "#25170f";
  context.lineWidth = 1.8;
  context.beginPath();
  context.moveTo(-7, 0);
  context.lineTo(7 + headOffset, 0);
  context.stroke();

  context.fillStyle = squished ? "#30231a" : "#21160f";
  context.beginPath();
  context.ellipse(-9, 0, squished ? 6 : 5.3, 4.2 * flatten, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.ellipse(0, 0, 2.7, 2.3 * flatten, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = squished ? "#39291c" : "#302016";
  context.beginPath();
  context.ellipse(7 + headOffset, 0, 3.5, 3 * flatten, 0, 0, Math.PI * 2);
  context.fill();
}

function drawAnt(context, ant, detail) {
  const gait = ant.gaitPhase ?? 0;
  const antenna = ant.antennaPhase ?? 0;
  const headOffset = ant.mode === "eat" ? Math.sin(antenna * 2) * 0.35 : 0;

  context.save();
  transformAnt(context, ant);
  context.fillStyle = "#4d32171a";
  context.beginPath();
  context.ellipse(-2, 1.8, 11.5, 4.6, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#281a11";
  context.lineWidth = 1.8;
  context.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    for (let leg = -1; leg <= 1; leg++) {
      // Opposite front/rear legs and the middle leg form alternating tripods.
      const stride = Math.sin(gait + (leg === 0 ? Math.PI : 0)) * side * 1.9;
      const root = leg * 2.5;
      context.moveTo(root, side * 1.3);
      context.lineTo(root + leg * 2.3 + stride * 0.5, side * 5.8);
      context.lineTo(
        root + leg * 5 + stride,
        side * (9.5 - Math.abs(stride) * 0.3),
      );
    }
  }
  context.stroke();

  context.lineWidth = 1.6;
  context.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    const feeler = Math.sin(antenna + side * 0.9) * 0.9;
    context.moveTo(8 + headOffset, side * 1.6);
    context.lineTo(12 + headOffset, side * (3 + feeler * 0.3));
    context.lineTo(15.3 + headOffset - feeler * 0.4, side * (5.4 + feeler));
  }
  context.stroke();
  drawAntBody(context, 1, headOffset, false);

  if (detail) {
    context.fillStyle = "#98704780";
    context.beginPath();
    context.ellipse(-10, -1.3, 2.7, 0.85, -0.12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#a980534d";
    context.beginPath();
    context.ellipse(6.5 + headOffset, -1, 1.4, 0.7, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSquishedAnt(context, ant) {
  const age = ant.squishAge ?? antConfig.squishDurationFrames;
  const progress = Math.min(
    1,
    Math.max(0, age / antConfig.squishDurationFrames),
  );
  const settle = 1 - Math.pow(1 - progress, 3);
  const strength = ant.squishStrength ?? 0.5;
  const imprintAngle = (ant.squishAngle ?? ant.angle) - ant.angle;
  const spread = 12 + strength * 4 + settle;

  context.save();
  transformAnt(context, ant);
  // A dry contact imprint anchors the flattened silhouette without a goo puddle.
  context.fillStyle = "#70532b26";
  context.beginPath();
  context.ellipse(
    Math.cos(imprintAngle) * strength * 3,
    Math.sin(imprintAngle) * strength * 3,
    spread,
    4.5,
    imprintAngle,
    0,
    Math.PI * 2,
  );
  context.fill();

  context.strokeStyle = "#3b2a1b";
  context.lineWidth = 1.7;
  context.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    for (let leg = -1; leg <= 1; leg++) {
      const root = leg * 2.5;
      const splay = 9 + settle * 2 + leg * side * 0.8;
      context.moveTo(root, side);
      context.lineTo(root + leg * 3.5 + side * 0.8, side * splay);
      context.lineTo(root + leg * 4.5 - side * 1.6, side * (splay - 2.8));
    }
    context.moveTo(8, side * 1.1);
    context.lineTo(13, side * 4.5);
    context.lineTo(12 + side, side * 6.4);
  }
  context.stroke();
  drawAntBody(
    context,
    0.76 - settle * 0.3,
    Math.sin(ant.wobble ?? 0) * 0.2,
    true,
  );
  context.restore();
}

function setDynamicBounds(target, x, y, radius) {
  target.bottom = y + radius + kitchenDynamicDirtyPadding;
  target.left = x - radius - kitchenDynamicDirtyPadding;
  target.right = x + radius + kitchenDynamicDirtyPadding;
  target.top = y - radius - kitchenDynamicDirtyPadding;
}

function setCheerioBounds(target, cheerio) {
  const radius =
    cheerio.radius * (1 - cheerio.eaten * (1 - kitchenCheerioMinScale));
  const waterSoak = cheerio.waterSoak ?? 0;
  const drawRadius = radius * (1 + waterSoak * (kitchenSoggyCheerioScale - 1));
  const x = cheerio.originX + cheerio.pushX;
  const y = cheerio.originY + cheerio.pushY;

  setDynamicBounds(target, x, y, drawRadius);
  if (
    waterSoak <= 0 ||
    !Number.isFinite(cheerio.waterStainX) ||
    !Number.isFinite(cheerio.waterStainY)
  ) {
    return;
  }

  const stainRadius = radius * kitchenWaterStainRadiusScale;
  target.bottom = Math.max(
    target.bottom,
    cheerio.waterStainY + stainRadius + kitchenDynamicDirtyPadding,
  );
  target.left = Math.min(
    target.left,
    cheerio.waterStainX - stainRadius - kitchenDynamicDirtyPadding,
  );
  target.right = Math.max(
    target.right,
    cheerio.waterStainX + stainRadius + kitchenDynamicDirtyPadding,
  );
  target.top = Math.min(
    target.top,
    cheerio.waterStainY - stainRadius - kitchenDynamicDirtyPadding,
  );
}

function setAntBounds(target, ant) {
  setDynamicBounds(
    target,
    ant.x,
    ant.y,
    kitchenAntDrawRadius * (ant.size ?? 1),
  );
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

function clearDynamicRect(context, scale, rect) {
  const left = Math.floor(rect.left * scale) - 1;
  const top = Math.floor(rect.top * scale) - 1;
  const right = Math.ceil(rect.right * scale) + 1;
  const bottom = Math.ceil(rect.bottom * scale) + 1;

  context.clearRect(left, top, right - left, bottom - top);
  // Redraw only the pixels cleared, including their antialiasing border.
  context.rect(left, top, right - left, bottom - top);
}

function createDynamicEntry(object, kind) {
  return {
    bounds: { bottom: 0, left: 0, right: 0, top: 0 },
    dirtyBounds: { bottom: 0, left: 0, right: 0, top: 0 },
    kind,
    nextBounds: { bottom: 0, left: 0, right: 0, top: 0 },
    object,
    revision: Number.NEGATIVE_INFINITY,
    angle: null,
    squished: null,
    visible: false,
  };
}

function dynamicEntries(themeState, dynamicsState) {
  if (
    themeState.kitchenDynamicCheerios === dynamicsState.cheerios &&
    themeState.kitchenDynamicAnts === dynamicsState.ants
  ) {
    return themeState.kitchenDynamicEntries;
  }

  const entries = themeState.kitchenDynamicEntries ?? [];
  entries.length = 0;
  for (let i = 0; i < dynamicsState.cheerios.length; i++) {
    entries.push(createDynamicEntry(dynamicsState.cheerios[i], "cheerio"));
  }
  for (let i = 0; i < dynamicsState.ants.length; i++) {
    entries.push(createDynamicEntry(dynamicsState.ants[i], "ant"));
  }
  themeState.kitchenDynamicEntries = entries;
  themeState.kitchenDynamicCheerios = dynamicsState.cheerios;
  themeState.kitchenDynamicAnts = dynamicsState.ants;
  themeState.kitchenDynamicNeedsFullRedraw = true;
  return entries;
}

function dynamicEntryVisible(entry) {
  return entry.kind === "cheerio"
    ? entry.object.active
    : entry.object.alive || entry.object.squished;
}

function setNextDynamicBounds(entry) {
  if (entry.kind === "cheerio") {
    setCheerioBounds(entry.nextBounds, entry.object);
  } else {
    setAntBounds(entry.nextBounds, entry.object);
  }
}

function dynamicDirtyRects(entries, dirtyRects) {
  dirtyRects.length = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const nextVisible = dynamicEntryVisible(entry);
    if (nextVisible) setNextDynamicBounds(entry);
    if (
      entry.visible !== nextVisible ||
      entry.revision !== entry.object.revision ||
      (entry.kind === "ant" &&
        (entry.angle !== entry.object.angle ||
          entry.squished !== entry.object.squished)) ||
      (nextVisible && boundsChanged(entry.bounds, entry.nextBounds))
    ) {
      const previousVisible = entry.visible;
      const previousBounds = entry.bounds;
      entry.bounds = entry.nextBounds;
      entry.nextBounds = previousBounds;
      entry.visible = nextVisible;
      entry.revision = entry.object.revision;
      if (entry.kind === "ant") {
        entry.angle = entry.object.angle;
        entry.squished = entry.object.squished;
      }
      if (previousVisible && entry.visible) {
        entry.dirtyBounds.bottom = Math.max(
          previousBounds.bottom,
          entry.bounds.bottom,
        );
        entry.dirtyBounds.left = Math.min(
          previousBounds.left,
          entry.bounds.left,
        );
        entry.dirtyBounds.right = Math.max(
          previousBounds.right,
          entry.bounds.right,
        );
        entry.dirtyBounds.top = Math.min(previousBounds.top, entry.bounds.top);
        dirtyRects.push(entry.dirtyBounds);
      } else if (previousVisible) {
        dirtyRects.push(previousBounds);
      } else if (entry.visible) {
        dirtyRects.push(entry.bounds);
      }
    }
  }

  return dirtyRects;
}

function drawDynamicEntry(context, entry, scale) {
  if (entry.kind === "cheerio") {
    drawCheerio(context, entry.object);
  } else if (entry.object.squished) {
    drawSquishedAnt(context, entry.object);
  } else if (entry.object.alive) {
    drawAnt(context, entry.object, scale >= 0.45);
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

function drawSoggyWaterStain(context, cheerio, radius, waterSoak) {
  if (
    waterSoak <= 0 ||
    !Number.isFinite(cheerio.waterStainX) ||
    !Number.isFinite(cheerio.waterStainY)
  ) {
    return;
  }

  const x = cheerio.waterStainX;
  const y = cheerio.waterStainY;
  const spread = radius * (1.1 + waterSoak * 1.15);
  context.save();
  context.globalAlpha = 0.08 + waterSoak * 0.16;
  context.fillStyle = "#b78032";
  context.beginPath();
  context.ellipse(x, y, spread, spread * 0.62, -0.18, 0, Math.PI * 2);
  context.ellipse(
    x - spread * 0.48,
    y + spread * 0.12,
    spread * 0.58,
    spread * 0.34,
    0.2,
    0,
    Math.PI * 2,
  );
  context.ellipse(
    x + spread * 0.44,
    y - spread * 0.16,
    spread * 0.52,
    spread * 0.3,
    -0.32,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function drawSoggyCheerioFinish(context, x, y, radius, waterSoak) {
  if (waterSoak <= 0) return;

  context.save();
  context.globalAlpha = 0.08 + waterSoak * 0.24;
  context.strokeStyle = "#754718";
  context.lineWidth = Math.max(1, radius * (0.12 + waterSoak * 0.1));
  context.beginPath();
  context.ellipse(
    x,
    y,
    radius * 0.78,
    radius * (0.76 - waterSoak * 0.04),
    0.12,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.restore();
}

function drawCheerio(context, cheerio) {
  if (!cheerio.active) return;

  const x = cheerio.originX + cheerio.pushX;
  const y = cheerio.originY + cheerio.pushY;
  const radius =
    cheerio.radius * (1 - cheerio.eaten * (1 - kitchenCheerioMinScale));
  const opacity = 1 - cheerio.eaten * (1 - kitchenCheerioOpacityFloor);
  const waterSoak = cheerio.waterSoak ?? 0;
  const soggyRadius = radius * (1 + waterSoak * (kitchenSoggyCheerioScale - 1));
  const sprite = getKitchenCheerioSprite();

  if (cheerio.kind === "crumb") {
    drawCerealCrumb(context, cheerio, x, y, radius, opacity);
    return;
  }

  drawSoggyWaterStain(context, cheerio, radius, waterSoak);

  if (drawCheerioSprite(context, sprite, x, y, soggyRadius, opacity)) {
    drawSoggyCheerioFinish(context, x, y, soggyRadius, waterSoak);
    return;
  }

  context.globalAlpha = opacity;
  drawFallbackCheerio(context, x, y, soggyRadius);
  context.globalAlpha = 1;
  drawSoggyCheerioFinish(context, x, y, soggyRadius, waterSoak);
}

function renderKitchenDynamics(themeState, dynamicsState) {
  const context = themeState.kitchenDynamicContext;
  const canvas = themeState.kitchenDynamicCanvas;
  const world = themeState.kitchenDynamicWorld;
  if (!context || !canvas || !world) return;

  const entries = dynamicEntries(themeState, dynamicsState);
  const dirtyRects = dynamicDirtyRects(
    entries,
    (themeState.kitchenDynamicDirtyRects ??= []),
  );
  if (!themeState.kitchenDynamicNeedsFullRedraw && dirtyRects.length === 0) {
    return;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.save();
  if (themeState.kitchenDynamicNeedsFullRedraw) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const fullBounds = (themeState.kitchenDynamicFullBounds ??= {});
    fullBounds.bottom = world.height;
    fullBounds.left = 0;
    fullBounds.right = world.width;
    fullBounds.top = 0;
    dirtyRects.length = 1;
    dirtyRects[0] = fullBounds;
    themeState.kitchenDynamicNeedsFullRedraw = false;
  } else {
    const scale = themeState.kitchenDynamicRenderScale;
    context.beginPath();
    for (let i = 0; i < dirtyRects.length; i++) {
      clearDynamicRect(context, scale, dirtyRects[i]);
    }
    context.clip();
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
    if (!entry.visible) continue;
    for (let j = 0; j < dirtyRects.length; j++) {
      if (!rectsIntersect(entry.bounds, dirtyRects[j])) continue;
      drawDynamicEntry(context, entry, themeState.kitchenDynamicRenderScale);
      break;
    }
  }
  context.restore();
}

export function renderMapThemeDynamics({
  dynamicsState,
  mapConfig,
  themeState = {},
}) {
  if (mapConfig?.theme === "kitchenFloor") {
    renderKitchenDynamics(themeState, dynamicsState);
  }
}

export function renderMapTheme({
  container,
  dynamicsState = { ants: [], cheerios: [] },
  overlayContainer,
  mapConfig,
  themeState = {},
  world = mapConfig?.world,
}) {
  container.replaceChildren();
  overlayContainer.replaceChildren();
  themeState.kitchenDynamicCanvas = null;
  themeState.kitchenDynamicContext = null;
  themeState.kitchenDynamicWorld = null;
  themeState.kitchenDynamicRenderScale = kitchenDynamicCanvasScale;
  themeState.kitchenDynamicNeedsFullRedraw = false;
  themeState.kitchenDynamicAnts = null;
  themeState.kitchenDynamicCheerios = null;
  themeState.kitchenDynamicDirtyRects = [];
  themeState.kitchenDynamicEntries = [];
  themeState.kitchenDynamicFullBounds = {};
  const theme = mapConfig?.theme;
  if (!theme || !renderers[theme] || !world) return;

  const underlay = document.createElement("div");
  const overlay = document.createElement("div");
  underlay.className = "mapThemeLayer theme-" + theme;
  overlay.className = "mapThemeOverlayLayer theme-" + theme;
  underlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("aria-hidden", "true");

  renderers[theme]({
    mapConfig,
    dynamicsState,
    overlay,
    underlay,
    themeState,
    world,
  });
  container.replaceChildren(underlay);
  overlayContainer.replaceChildren(overlay);
}

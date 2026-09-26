import assert from "node:assert/strict";
import { mouseConfig } from "../core/game-config.js";
import {
  appendMouseCanvas,
  renderMouse,
} from "../rendering/mouse-rendering.js";
import {
  renderMapTheme,
  renderMapThemeDynamics,
} from "../rendering/map-theme-rendering.js";
import { createTerrainView } from "../rendering/map-renderer.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

const oldDocument = globalThis.document;
const oldImage = globalThis.Image;
const images = [];
globalThis.Image = class {
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }
  dispatch(type) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
  constructor() {
    images.push(this);
  }
};
globalThis.document = {
  createElement: (tag) =>
    tag === "canvas" ? new FakeCanvasElement() : new FakeElement(),
};

function liveMouse() {
  return {
    x: 1600,
    y: 2700,
    r: mouseConfig.radius,
    angle: 0,
    health: 100,
    maxHealth: 100,
    hitFlash: 0,
    gait: 0,
  };
}

try {
  const mouse = liveMouse();
  const original = { ...mouse };
  const overlay = new FakeElement();
  const themeState = {};
  appendMouseCanvas(overlay, themeState, mouse);
  const canvas = themeState.mouseCanvas;
  const context = canvas.context;
  const bars = () => context.calls.filter((call) => call[0] === "fillRect");
  const fullWidth = bars().at(-1)[3];
  assert.equal(overlay.children.length, 1);
  assert.equal(canvas.style.transform, "translate(1600px, 2700px)");
  assert.ok(
    canvas.width * canvas.height * 4 < 1024 * 1024,
    "one mouse should not allocate a world-sized canvas",
  );
  assert.deepEqual(
    mouse,
    original,
    "drawing must not own or mutate encounter state",
  );

  context.calls.length = 0;
  renderMouse(themeState, mouse);
  assert.equal(context.calls.length, 0, "an unchanged pose should not redraw");
  mouse.x += 17;
  renderMouse(themeState, mouse);
  assert.equal(canvas.style.transform, "translate(1617px, 2700px)");
  assert.equal(
    context.calls.length,
    0,
    "world movement should translate the existing local canvas",
  );

  assert.equal(images.length, 1, "one cached sprite serves the encounter");
  assert.equal(
    context.calls.some((call) => call[0] === "drawImage"),
    false,
  );
  const retiredState = {};
  appendMouseCanvas(new FakeElement(), retiredState, liveMouse());
  const retiredContext = retiredState.mouseContext;
  renderMouse(retiredState, null);
  retiredContext.calls.length = 0;
  images[0].complete = true;
  images[0].naturalWidth = 1254;
  images[0].naturalHeight = 1254;
  images[0].dispatch("load");
  assert.equal(
    retiredContext.calls.length,
    0,
    "late loading cannot repaint a retired actor",
  );
  assert.equal(images[0].listeners.get("load").size, 0);
  assert.equal(images[0].listeners.get("error").size, 0);
  assert.ok(
    context.calls.some(
      (call) =>
        call[0] === "drawImage" && call[1] === "assets/sprites/mouse.webp",
    ),
    "late sprite readiness redraws even a paused pose without a game tick",
  );
  const bodyDraw = context.calls.find((call) => call[0] === "drawImage");
  assert.equal(
    bodyDraw[4] / bodyDraw[5],
    images[0].naturalWidth / images[0].naturalHeight,
    "the body must preserve the source sprite's proportions instead of stretching its width",
  );
  context.calls.length = 0;
  renderMouse(themeState, mouse);
  assert.equal(context.calls.length, 0, "a loaded static pose is cached too");
  mouse.pauseFrames = 10;
  renderMouse(themeState, mouse);
  assert.ok(context.calls.length > 0, "a stationary sniff updates its muzzle");
  context.calls.length = 0;

  mouse.angle = Math.PI / 2;
  mouse.health = 50;
  renderMouse(themeState, mouse);
  assert.equal(
    bars().at(-1)[3],
    fullWidth / 2,
    "health fill must track authoritative health",
  );
  const heading = context.calls.find((call) => call[0] === "transform");
  assert.ok(Math.abs(heading[1]) < 1e-10 && Math.abs(heading[4]) < 1e-10);
  assert.equal(heading[2], mouse.r / 44);
  assert.equal(heading[3], -mouse.r / 44);
  const firstBarIndex = context.calls.findIndex(
    (call) => call[0] === "fillRect",
  );
  assert.equal(
    context.calls[firstBarIndex - 1][0],
    "restore",
    "health bar must remain horizontal after restoring body heading",
  );

  const fills = [];
  Object.defineProperty(context, "fillStyle", {
    set(color) {
      fills.push(color);
    },
  });
  context.calls.length = 0;
  mouse.hitFlash = 1;
  renderMouse(themeState, mouse);
  assert.ok(
    fills.includes("#fff7cf"),
    "successful hit should visibly flash the health bar",
  );
  assert.equal(
    bars().at(-1)[3],
    fullWidth / 2,
    "hit flash must not change the displayed health",
  );
  // The rotated tail must remain within the local canvas at the actual
  // gameplay radius, including diagonal headings and a changed actor size.
  for (const radius of [mouseConfig.radius, mouseConfig.radius * 1.1]) {
    mouse.r = radius;
    for (let i = 0; i < 8; i++) {
      mouse.angle = (i * Math.PI) / 4;
      context.calls.length = 0;
      renderMouse(themeState, mouse);
      const rotation = context.calls.find((call) => call[0] === "transform");
      const tail = context.calls.find((call) => call[0] === "quadraticCurveTo");
      const x =
        canvas.width / 2 + rotation[1] * tail[3] + rotation[3] * tail[4];
      const y =
        canvas.height / 2 + rotation[2] * tail[3] + rotation[4] * tail[4];
      assert.ok(
        x > 0 && x < canvas.width && y > 0 && y < canvas.height,
        "tail must not be cropped when the enlarged mouse turns",
      );
      assert.equal(canvas.style.width, canvas.width + "px");
      assert.equal(canvas.style.left, -canvas.width / 2 + "px");
    }
  }
  context.calls.length = 0;
  mouse.health = 0;
  renderMouse(themeState, mouse);
  assert.equal(
    bars().length,
    0,
    "defeated mouse should have no live health bar",
  );
  assert.ok(
    context.calls.some((call) => call[0] === "drawImage"),
    "defeat should leave the textured resting body",
  );
  const deadPose = context.calls.filter((call) => call[0] === "transform");
  assert.equal(deadPose.length, 2, "defeat has a distinct collapsed body pose");
  context.calls.length = 0;
  mouse.pauseFrames -= 1;
  renderMouse(themeState, mouse);
  assert.equal(context.calls.length, 0, "defeated pose should stay still");
  renderMouse(themeState, null);
  assert.equal(overlay.children.length, 0);
  assert.equal(themeState.mouseCanvas, null);

  const map = {
    theme: "livingRoom",
    world: { width: 4400, height: 4400 },
    objective: { type: "reach", region: "exit-door", defeat: "mouse" },
    regions: [
      { id: "exit-door", label: "Next room", x: 3500, y: 0, w: 340, h: 480 },
    ],
    scenery: [],
  };
  const mapState = {
    activeMap: map,
    mouse: liveMouse(),
    obstacles: [],
    terrainByType: {},
  };
  const goal = new FakeElement();
  let label = "";
  let labelWrites = 0;
  Object.defineProperty(goal, "textContent", {
    get: () => label,
    set(value) {
      label = value;
      labelWrites += 1;
    },
  });
  const underlay = new FakeElement();
  const dynamicOverlay = new FakeElement();
  const view = createTerrainView({
    mapThemeEl: underlay,
    mapThemeOverlayEl: dynamicOverlay,
    goalEl: goal,
    mapState,
    renderMapTheme,
    renderMapThemeDynamics,
    renderObstacleWalls() {},
  });
  view.renderTerrain();
  const firstCanvas = dynamicOverlay.firstChild.children.find(
    (item) => item.className === "mouseCanvas",
  );
  assert.ok(firstCanvas);
  assert.equal(label, "Defeat mouse to exit");
  const writesAtStart = labelWrites;
  for (let i = 0; i < 10; i += 1) view.renderMapThemeDynamics();
  assert.equal(
    labelWrites,
    writesAtStart,
    "unchanged exit state must not rewrite DOM text each frame",
  );
  mapState.mouse.health = 0;
  view.renderMapThemeDynamics();
  assert.equal(label, "Next room");
  assert.equal(labelWrites, writesAtStart + 1);
  view.renderMapThemeDynamics();
  assert.equal(labelWrites, writesAtStart + 1);

  mapState.mouse = null;
  view.renderMapThemeDynamics();
  assert.equal(
    label,
    "Defeat mouse to exit",
    "missing encounter state must not show an unlocked exit",
  );

  mapState.mouse = liveMouse();
  view.renderTerrain();
  const resetCanvas = dynamicOverlay.firstChild.children.find(
    (item) => item.className === "mouseCanvas",
  );
  assert.notEqual(
    firstCanvas,
    resetCanvas,
    "Retry rebuilds a disposable view of fresh runtime state",
  );
  assert.equal(label, "Defeat mouse to exit");
  const resetBars = resetCanvas.context.calls.filter(
    (call) => call[0] === "fillRect",
  );
  assert.equal(
    resetBars.at(-1)[3],
    fullWidth,
    "Retry restores the full health display",
  );
  mapState.activeMap = {
    theme: "parkingLot",
    world: map.world,
    goal: { x: 100, y: 100, r: 40 },
  };
  mapState.mouse = null;
  view.renderTerrain();
  assert.equal(
    dynamicOverlay.firstChild.children.some(
      (item) => item.className === "mouseCanvas",
    ),
    false,
  );
  assert.equal(label, "", "other maps retain their existing goal presentation");
  assert.equal(
    images.length,
    1,
    "Retry reuses the decoded image without duplicating asset state",
  );
} finally {
  if (oldImage === undefined) delete globalThis.Image;
  else globalThis.Image = oldImage;
  if (oldDocument === undefined) delete globalThis.document;
  else globalThis.document = oldDocument;
}

console.log("Mouse rendering tests passed");

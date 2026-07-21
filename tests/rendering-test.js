import assert from "node:assert/strict";
import { renderIcePatches } from "../rendering/ice-patch-rendering.js";
import { renderObstacleWalls } from "../rendering/obstacle-rendering.js";
import { renderRoughPatches } from "../rendering/rough-patch-rendering.js";
import { renderOuterWalls } from "../rendering/wall-rendering.js";
import { createTerrainView } from "../rendering/map-renderer.js";
import { createMarbleView } from "../rendering/marble-view.js";
import { createUi } from "../rendering/ui.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function withFakeDocument(callback) {
  const originalDocument = globalThis.document;

  globalThis.document = {
    createElement(tagName) {
      return tagName === "canvas" ? new FakeCanvasElement() : new FakeElement();
    },
  };
  try {
    callback();
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
}

function testRenderOuterWallsKeepsPositiveInterior() {
  const container = new FakeElement();

  withFakeDocument(() => {
    renderOuterWalls(container, [
      { x: -34, y: -34, w: 2268, h: 34 },
      { x: -34, y: 2200, w: 2268, h: 34 },
      { x: -34, y: 0, w: 34, h: 2200 },
      { x: 2200, y: 0, w: 34, h: 2200 },
    ]);
  });

  const canvas = container.children[0];
  const clearCall = canvas.context.calls.find(
    (call) => call[0] === "clearRect",
  );

  assert.deepEqual(clearCall, ["clearRect", 0, 0, 2200, 2200]);
}

testRenderOuterWallsKeepsPositiveInterior();

function testRenderOuterWallsRejectsInvalidWalls() {
  [
    [],
    [{ x: 0, y: 0, w: 100, h: 10 }],
    [{ x: 0, y: 0, w: 10, h: 100 }],
    [{ x: 0, y: 0, w: Number.NaN, h: 10 }],
  ].forEach((walls) => {
    const container = new FakeElement();

    withFakeDocument(() => {
      renderOuterWalls(container, walls);
    });

    assert.equal(container.children.length, 0);
  });
}

testRenderOuterWallsRejectsInvalidWalls();

function testRenderOuterWallsCapsHighDensityDisplays() {
  const originalDevicePixelRatio = globalThis.devicePixelRatio;
  const container = new FakeElement();

  globalThis.devicePixelRatio = 4;
  try {
    withFakeDocument(() => {
      renderOuterWalls(container, [
        { x: -34, y: -34, w: 2268, h: 34 },
        { x: -34, y: 2200, w: 2268, h: 34 },
        { x: -34, y: 0, w: 34, h: 2200 },
        { x: 2200, y: 0, w: 34, h: 2200 },
      ]);
    });
  } finally {
    if (originalDevicePixelRatio === undefined) {
      delete globalThis.devicePixelRatio;
    } else {
      globalThis.devicePixelRatio = originalDevicePixelRatio;
    }
  }

  assert.equal(container.children[0].width, 4536);
}

testRenderOuterWallsCapsHighDensityDisplays();

function testRenderOuterWallsUsesFrameGeometry() {
  const container = new FakeElement();

  withFakeDocument(() => {
    renderOuterWalls(container, [
      { x: -34, y: -34, w: 2268, h: 34 },
      { x: -34, y: 2200, w: 2268, h: 34 },
      { x: -34, y: 0, w: 34, h: 2200 },
      { x: 2200, y: 0, w: 34, h: 2200 },
    ]);
  });

  assert.equal(container.children.length, 1);
}

testRenderOuterWallsUsesFrameGeometry();

function testFpsCounterDefaultsHiddenAndUpdatesWhenEnabled() {
  const hint = new FakeElement();
  const fpsCounter = new FakeElement();
  const debug = new FakeElement();
  const settingsOverlay = new FakeElement();
  const settings = { fpsEnabled: false, statsEnabled: false };
  const ui = createUi({
    hint,
    fpsCounter,
    debug,
    settings,
    settingsOverlay,
    debugLines: () => [],
    state: {},
  });

  ui.updateFps(1000);
  assert.equal(fpsCounter.hidden, true);
  assert.equal(fpsCounter.attributes["aria-hidden"], "true");

  settings.fpsEnabled = true;
  ui.setFpsEnabled(settings.fpsEnabled);
  ui.updateFps(1000);
  ui.updateFps(1500);

  assert.equal(fpsCounter.hidden, false);
  assert.equal(fpsCounter.attributes["aria-hidden"], "false");
  assert.equal(fpsCounter.textContent, "fps 2");
}

testFpsCounterDefaultsHiddenAndUpdatesWhenEnabled();

function testStatsDefaultsHiddenAndUpdatesWhenEnabled() {
  const hint = new FakeElement();
  const fpsCounter = new FakeElement();
  const debug = new FakeElement();
  const settingsOverlay = new FakeElement();
  const settings = { fpsEnabled: false, statsEnabled: false };
  let phase = "running";
  const ui = createUi({
    hint,
    fpsCounter,
    debug,
    settings,
    settingsOverlay,
    debugLines: () => ["phase: " + phase],
    state: {},
  });

  ui.updateDebugPanel();
  assert.equal(debug.hidden, true);
  assert.equal(debug.attributes["aria-hidden"], "true");
  assert.equal(debug.textContent, "");

  settings.statsEnabled = true;
  ui.setStatsEnabled(settings.statsEnabled);
  ui.updateDebugPanel();

  assert.equal(debug.hidden, false);
  assert.equal(debug.attributes["aria-hidden"], "false");
  assert.equal(debug.textContent, "phase: running");

  phase = "paused";
  ui.updateDebugPanel({ now: performance.now() + 10 });
  assert.equal(debug.textContent, "phase: running");

  ui.updateDebugPanel({ now: performance.now() + 300 });
  assert.equal(debug.textContent, "phase: paused");
}

testStatsDefaultsHiddenAndUpdatesWhenEnabled();

function testGoalProgressUsesRadialFillRadius() {
  const goalEl = new FakeElement();
  const terrainView = createTerrainView({
    roughPatchesEl: new FakeElement(),
    obstaclesEl: new FakeElement(),
    goalEl,
    goal: { x: 100, y: 120, r: 50 },
    roughPatches: [],
    obstacles: [],
    renderObstacleWalls() {},
    renderRoughPatches() {},
  });

  terrainView.updateGoalProgress(0.5);

  assert.equal(goalEl.classList.contains("active"), true);
  assert.equal(goalEl.style.properties["--goal-fill-radius"], "35.4%");
  assert.equal(goalEl.style.properties["--goal-progress"], undefined);

  terrainView.updateGoalProgress(2);
  assert.equal(goalEl.style.properties["--goal-fill-radius"], "70.8%");

  terrainView.updateGoalProgress(-1);
  assert.equal(goalEl.classList.contains("active"), false);
  assert.equal(goalEl.style.properties["--goal-fill-radius"], "0.0%");
}

testGoalProgressUsesRadialFillRadius();

function testTerrainViewSkipsUnchangedTerrainRedraw() {
  let obstacleRenderCount = 0;
  let roughPatchRenderCount = 0;
  const goal = { x: 100, y: 120, r: 50 };
  const obstacles = [{ x: 10, y: 10, w: 20, h: 20 }];
  const obstacleBounds = {
    left: 10,
    top: 10,
    right: 30,
    bottom: 30,
    width: 20,
    height: 20,
  };
  const roughPatches = [{ x: 40, y: 40, w: 20, h: 20 }];
  const roughPatchBounds = {
    left: 40,
    top: 40,
    right: 60,
    bottom: 60,
    width: 20,
    height: 20,
  };
  const terrainView = createTerrainView({
    roughPatchesEl: new FakeElement(),
    obstaclesEl: new FakeElement(),
    goalEl: new FakeElement(),
    goal,
    roughPatches,
    roughPatchBounds,
    obstacles,
    obstacleBounds,
    renderObstacleWalls() {
      obstacleRenderCount++;
    },
    renderRoughPatches() {
      roughPatchRenderCount++;
    },
  });

  terrainView.renderTerrain();
  terrainView.setTerrain({
    goal,
    obstacles,
    obstacleBounds,
    roughPatches,
    roughPatchBounds,
  });

  assert.equal(obstacleRenderCount, 1);
  assert.equal(roughPatchRenderCount, 1);
}

testTerrainViewSkipsUnchangedTerrainRedraw();

const originalDocument = globalThis.document;

globalThis.document = {
  createElement(tagName) {
    return tagName === "canvas" ? new FakeCanvasElement() : new FakeElement();
  },
  createElementNS() {
    return new FakeElement();
  },
};

try {
  const wallsContainer = new FakeElement();
  renderOuterWalls(wallsContainer, [{ x: 0, y: 0, w: 100, h: 10 }]);
  assert.deepEqual(
    wallsContainer.children,
    [],
    "invalid wall frame should clear container",
  );

  renderOuterWalls(wallsContainer, [
    { x: -10, y: -10, w: 120, h: 10 },
    { x: -10, y: 100, w: 120, h: 10 },
    { x: -10, y: 0, w: 10, h: 100 },
    { x: 100, y: 0, w: 10, h: 100 },
  ]);
  const wallCanvas = wallsContainer.children[0];
  assert.equal(
    wallCanvas.classList.contains("wallCanvas"),
    true,
    "wall frame should render to canvas",
  );
  assert.equal(
    wallCanvas.context.calls.some((call) => call[0] === "fillRect"),
    true,
    "wall canvas should draw fill",
  );
  assert.equal(
    wallCanvas.context.calls.some((call) => call[0] === "clearRect"),
    true,
    "wall canvas should clear interior",
  );

  const container = new FakeElement();
  const roughPatchContainer = new FakeElement();
  const icePatchContainer = new FakeElement();

  renderIcePatches(icePatchContainer, [{ x: 25, y: 35, w: 90, h: 70 }], {
    padding: 18,
  });
  const icePatchCanvas = icePatchContainer.children[0];
  assert.equal(
    icePatchCanvas.classList.contains("icePatchCanvas"),
    true,
    "ice patches should render to canvas",
  );
  assert.equal(icePatchCanvas.attributes["data-ice-patches"], "1");
  assert.equal(
    icePatchCanvas.context.calls.some((call) => call[0] === "lineTo"),
    true,
    "ice patch canvas should draw cracks",
  );
  assert.equal(
    icePatchCanvas.context.calls.some((call) => call[0] === "ellipse"),
    true,
    "ice patch canvas should draw cloudy frost",
  );

  renderRoughPatches(roughPatchContainer, [{ x: 20, y: 30, w: 80, h: 60 }], {
    padding: 18,
  });
  const roughPatchCanvas = roughPatchContainer.children[0];
  assert.equal(
    roughPatchCanvas.classList.contains("roughPatchCanvas"),
    true,
    "rough patches should render to canvas",
  );
  assert.equal(roughPatchCanvas.attributes["data-rough-patches"], "1");
  assert.equal(roughPatchCanvas.style.left, "2px");
  assert.equal(roughPatchCanvas.style.top, "12px");
  assert.equal(roughPatchCanvas.style.width, "116px");
  assert.equal(roughPatchCanvas.style.height, "96px");
  assert.equal(
    roughPatchCanvas.context.calls.some((call) => call[0] === "fillRect"),
    true,
    "rough patch canvas should draw grit",
  );
  assert.equal(
    roughPatchCanvas.context.calls.filter((call) => call[0] === "fillRect")
      .length >= 40,
    true,
    "rough patch canvas should draw layered grit",
  );

  renderObstacleWalls(
    container,
    [
      { x: 0, y: 0, w: 10, h: 20 },
      { x: 10, y: 0, w: 10, h: 10 },
    ],
    { padding: 32 },
  );

  const canvas = container.children[0];

  assert.equal(
    canvas.classList.contains("obstacleCanvas"),
    true,
    "obstacle walls should render to canvas",
  );
  assert.equal(canvas.style.left, "-32px");
  assert.equal(canvas.style.top, "-32px");
  assert.equal(canvas.style.width, "84px");
  assert.equal(canvas.style.height, "84px");
  assert.equal(canvas.attributes["data-wall-groups"], "1");
  assert.equal(
    canvas.context.calls.some((call) => call[0] === "fill"),
    true,
    "obstacle canvas should draw fills",
  );
  assert.equal(
    canvas.context.calls.some((call) => call[0] === "stroke"),
    true,
    "obstacle canvas should draw outline",
  );
} finally {
  if (originalDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = originalDocument;
  }
}

function testMarbleViewRendersWithTransform() {
  const marbleEl = new FakeElement("marble");
  const marble = {
    x: 120,
    y: 80,
    vx: 2,
    vy: -1,
    r: 0,
    roll: 0.4,
    impactSquash: 0.5,
  };
  const view = createMarbleView({
    marbleEl,
    marble,
    world: { width: 400, height: 300 },
    mapConfig: {
      light: {
        x: 0,
        y: 0,
        shadowMinDistance: 5,
        shadowMaxDistance: 10,
        shadowMinBlur: 6,
        shadowMaxBlur: 12,
        contactShadowY: 3,
        contactShadowBlur: 5,
      },
    },
    visualConfig: {
      marble: {
        glintCenter: 20,
        glintLightOffset: 5,
        glintVelocityScale: 0.1,
        glintVelocityLimit: 4,
        impactScaleX: 0.18,
        impactScaleY: 0.12,
      },
    },
    clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },
  });

  view.syncRadius();
  view.render();

  assert.equal(marble.r, 29);
  assert.equal(
    marbleEl.style.transform,
    "translate(120px, 80px) translate(-50%, -50%) scale(1.090, 0.940)",
  );
  assert.equal(marbleEl.style.left, undefined);
  assert.equal(marbleEl.style.properties["--marble-contact-shadow-y"], "3.0px");
}

testMarbleViewRendersWithTransform();

console.log("Rendering tests passed.");

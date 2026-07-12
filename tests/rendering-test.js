import assert from "node:assert/strict";
import {
  canvasPixelRatio,
  renderObstacleWalls,
  renderRoughPatches,
  renderWalls,
  wallFrameGeometry
} from "../rendering/rendering.js";
import { createTerrainView } from "../rendering/terrain-view.js";
import { createUi } from "../rendering/ui.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function testWallFrameGeometryKeepsPositiveInterior() {
  const frame = wallFrameGeometry([
    { x: -34, y: -34, w: 2268, h: 34 },
    { x: -34, y: 2200, w: 2268, h: 34 },
    { x: -34, y: 0, w: 34, h: 2200 },
    { x: 2200, y: 0, w: 34, h: 2200 }
  ]);

  assert.equal(frame.innerLeft, 0);
  assert.equal(frame.innerRight, 2200);
  assert.equal(frame.innerTop, 0);
  assert.equal(frame.innerBottom, 2200);
  assert.equal(frame.innerRight > frame.innerLeft, true);
  assert.equal(frame.innerBottom > frame.innerTop, true);
}

testWallFrameGeometryKeepsPositiveInterior();

function testWallFrameGeometryRejectsInvalidWalls() {
  assert.equal(wallFrameGeometry([]), null);
  assert.equal(wallFrameGeometry([{ x: 0, y: 0, w: 100, h: 10 }]), null);
  assert.equal(wallFrameGeometry([{ x: 0, y: 0, w: 10, h: 100 }]), null);
  assert.equal(wallFrameGeometry([{ x: 0, y: 0, w: Number.NaN, h: 10 }]), null);
}

testWallFrameGeometryRejectsInvalidWalls();

function testCanvasPixelRatioCapsHighDensityDisplays() {
  const originalDevicePixelRatio = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 4;

  try {
    assert.equal(canvasPixelRatio(), 2);
  } finally {
    if (originalDevicePixelRatio === undefined) {
      delete globalThis.devicePixelRatio;
    } else {
      globalThis.devicePixelRatio = originalDevicePixelRatio;
    }
  }
}

testCanvasPixelRatioCapsHighDensityDisplays();

function testFpsCounterDefaultsHiddenAndUpdatesWhenEnabled() {
  const hint = new FakeElement();
  const fpsCounter = new FakeElement();
  const debug = new FakeElement();
  const settingsOverlay = new FakeElement();
  const settings = { fpsEnabled: false };
  const ui = createUi({
    hint,
    fpsCounter,
    debug,
    settings,
    settingsOverlay,
    debugLines: () => [],
    state: {}
  });

  ui.updateFps(1000);
  assert.equal(fpsCounter.hidden, true);

  settings.fpsEnabled = true;
  ui.setFpsEnabled(settings.fpsEnabled);
  ui.updateFps(1000);
  ui.updateFps(1500);

  assert.equal(fpsCounter.hidden, false);
  assert.equal(fpsCounter.textContent, "fps 2");
}

testFpsCounterDefaultsHiddenAndUpdatesWhenEnabled();

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
    renderRoughPatches() {}
  });

  terrainView.updateGoalProgress(.5);

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

const originalDocument = globalThis.document;

globalThis.document = {
  createElement(tagName) {
    return tagName === "canvas" ? new FakeCanvasElement() : new FakeElement();
  },
  createElementNS() {
    return new FakeElement();
  }
};

try {
  const wallsContainer = new FakeElement();
  renderWalls(wallsContainer, [{ x: 0, y: 0, w: 100, h: 10 }]);
  assert.deepEqual(wallsContainer.children, [], "invalid wall frame should clear container");

  renderWalls(wallsContainer, [
    { x: -10, y: -10, w: 120, h: 10 },
    { x: -10, y: 100, w: 120, h: 10 },
    { x: -10, y: 0, w: 10, h: 100 },
    { x: 100, y: 0, w: 10, h: 100 }
  ]);
  const wallCanvas = wallsContainer.children[0];
  assert.equal(wallCanvas.classList.contains("wallCanvas"), true, "wall frame should render to canvas");
  assert.equal(wallCanvas.context.calls.some((call) => call[0] === "fillRect"), true, "wall canvas should draw fill");
  assert.equal(wallCanvas.context.calls.some((call) => call[0] === "clearRect"), true, "wall canvas should clear interior");

  const container = new FakeElement();
  const roughPatchContainer = new FakeElement();

  renderRoughPatches(roughPatchContainer, [{ x: 20, y: 30, w: 80, h: 60 }], { padding: 18 });
  const roughPatchCanvas = roughPatchContainer.children[0];
  assert.equal(roughPatchCanvas.classList.contains("roughPatchCanvas"), true, "rough patches should render to canvas");
  assert.equal(roughPatchCanvas.attributes["data-rough-patches"], "1");
  assert.equal(roughPatchCanvas.style.left, "2px");
  assert.equal(roughPatchCanvas.style.top, "12px");
  assert.equal(roughPatchCanvas.style.width, "116px");
  assert.equal(roughPatchCanvas.style.height, "96px");
  assert.equal(
    roughPatchCanvas.context.calls.some((call) => call[0] === "fillRect"),
    true,
    "rough patch canvas should draw grit"
  );
  assert.equal(
    roughPatchCanvas.context.calls.filter((call) => call[0] === "fillRect").length >= 40,
    true,
    "rough patch canvas should draw layered grit"
  );

  renderObstacleWalls(container, [
    { x: 0, y: 0, w: 10, h: 20 },
    { x: 10, y: 0, w: 10, h: 10 }
  ], { padding: 32 });

  const canvas = container.children[0];

  assert.equal(canvas.classList.contains("obstacleCanvas"), true, "obstacle walls should render to canvas");
  assert.equal(canvas.style.left, "-32px");
  assert.equal(canvas.style.top, "-32px");
  assert.equal(canvas.style.width, "84px");
  assert.equal(canvas.style.height, "84px");
  assert.equal(canvas.attributes["data-wall-groups"], "1");
  assert.equal(canvas.context.calls.some((call) => call[0] === "fill"), true, "obstacle canvas should draw fills");
  assert.equal(canvas.context.calls.some((call) => call[0] === "stroke"), true, "obstacle canvas should draw outline");
} finally {
  if (originalDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = originalDocument;
  }
}

console.log("Rendering tests passed.");

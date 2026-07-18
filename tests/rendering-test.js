import assert from "node:assert/strict";
import { renderObstacleWalls } from "../rendering/obstacle-rendering.js";
import { renderRoughPatches } from "../rendering/rough-patch-rendering.js";
import { renderSlopeZones } from "../rendering/slope-rendering.js";
import {
  canvasPixelRatio,
  renderOuterWalls,
  wallFrameGeometry,
} from "../rendering/wall-rendering.js";
import { createTerrainView } from "../rendering/terrain-view.js";
import { createUi } from "../rendering/ui.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function testWallFrameGeometryKeepsPositiveInterior() {
  const frame = wallFrameGeometry([
    { x: -34, y: -34, w: 2268, h: 34 },
    { x: -34, y: 2200, w: 2268, h: 34 },
    { x: -34, y: 0, w: 34, h: 2200 },
    { x: 2200, y: 0, w: 34, h: 2200 },
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

  settings.fpsEnabled = true;
  ui.setFpsEnabled(settings.fpsEnabled);
  ui.updateFps(1000);
  ui.updateFps(1500);

  assert.equal(fpsCounter.hidden, false);
  assert.equal(fpsCounter.textContent, "fps 2");
}

testFpsCounterDefaultsHiddenAndUpdatesWhenEnabled();

function testStatsDefaultsHiddenAndUpdatesWhenEnabled() {
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
    debugLines: () => ["phase: running"],
    state: {},
  });

  ui.updateDebugPanel();
  assert.equal(debug.hidden, true);
  assert.equal(debug.textContent, "");

  settings.statsEnabled = true;
  ui.setStatsEnabled(settings.statsEnabled);
  ui.updateDebugPanel();

  assert.equal(debug.hidden, false);
  assert.equal(debug.textContent, "phase: running");
}

testStatsDefaultsHiddenAndUpdatesWhenEnabled();

function testGoalProgressUsesRadialFillRadius() {
  const goalEl = new FakeElement();
  const terrainView = createTerrainView({
    roughPatchesEl: new FakeElement(),
    slopeZonesEl: new FakeElement(),
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
  let slopeZoneRenderCount = 0;
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
  const slopeZones = [{ x: 70, y: 70, w: 30, h: 20, dx: 1, dy: 0 }];
  const slopeZoneBounds = {
    left: 70,
    top: 70,
    right: 100,
    bottom: 90,
    width: 30,
    height: 20,
  };
  const terrainView = createTerrainView({
    roughPatchesEl: new FakeElement(),
    slopeZonesEl: new FakeElement(),
    obstaclesEl: new FakeElement(),
    goalEl: new FakeElement(),
    goal,
    roughPatches,
    roughPatchBounds,
    slopeZones,
    slopeZoneBounds,
    obstacles,
    obstacleBounds,
    renderObstacleWalls() {
      obstacleRenderCount++;
    },
    renderRoughPatches() {
      roughPatchRenderCount++;
    },
    renderSlopeZones() {
      slopeZoneRenderCount++;
    },
  });

  terrainView.renderTerrain();
  terrainView.setTerrain({
    goal,
    obstacles,
    obstacleBounds,
    roughPatches,
    roughPatchBounds,
    slopeZones,
    slopeZoneBounds,
  });

  assert.equal(obstacleRenderCount, 1);
  assert.equal(roughPatchRenderCount, 1);
  assert.equal(slopeZoneRenderCount, 1);
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
  const slopeZoneContainer = new FakeElement();

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

  renderSlopeZones(
    slopeZoneContainer,
    [{ x: 30, y: 40, w: 100, h: 70, dx: 1, dy: 0 }],
    {
      padding: 18,
    },
  );
  const slopeZoneCanvas = slopeZoneContainer.children[0];
  assert.equal(
    slopeZoneCanvas.classList.contains("slopeZoneCanvas"),
    true,
    "slope zones should render to canvas",
  );
  assert.equal(slopeZoneCanvas.attributes["data-slope-zones"], "1");
  assert.equal(
    slopeZoneCanvas.context.calls.some((call) => call[0] === "lineTo"),
    true,
    "slope zone canvas should draw arrows",
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

console.log("Rendering tests passed.");

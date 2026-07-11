import assert from "node:assert/strict";
import {
  renderObstacleWalls,
  renderWalls,
  wallFrameGeometry
} from "../rendering/rendering.js";
import { createUi } from "../rendering/ui.js";
import { FakeElement } from "./test-dom.js";

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
  ui.updateFps(1000);
  ui.updateFps(1500);

  assert.equal(fpsCounter.hidden, false);
  assert.equal(fpsCounter.textContent, "fps 2");
}

testFpsCounterDefaultsHiddenAndUpdatesWhenEnabled();

const originalDocument = globalThis.document;

globalThis.document = {
  createElementNS() {
    return new FakeElement();
  }
};

try {
  const wallsContainer = new FakeElement();
  renderWalls(wallsContainer, [{ x: 0, y: 0, w: 100, h: 10 }]);
  assert.deepEqual(wallsContainer.children, [], "invalid wall frame should clear container");

  const container = new FakeElement();

  renderObstacleWalls(container, [
    { x: 0, y: 0, w: 10, h: 20 },
    { x: 10, y: 0, w: 10, h: 10 }
  ]);

  const svg = container.children[0];
  const outline = svg.children.find((child) => child.classList.contains("obstacleWallOutline"));

  assert.ok(outline, "obstacle outline should render");
  assert.equal(
    outline.attributes.d.includes("M10 0V10"),
    false,
    "connected obstacle walls should not draw an internal join outline"
  );
} finally {
  if (originalDocument === undefined) {
    delete globalThis.document;
  } else {
    globalThis.document = originalDocument;
  }
}

console.log("Rendering tests passed.");

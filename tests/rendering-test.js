import assert from "node:assert/strict";
import {
  renderObstacleWalls,
  wallFrameGeometry
} from "../rendering/rendering.js";
import { normalizedObstacleRects } from "../core/map.js";
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

function testObstacleVisualsTrimSmallJoinOverhangs() {
  const [horizontal, vertical] = normalizedObstacleRects([
    { x: 0, y: 20, w: 100, h: 20 },
    { x: 80, y: 0, w: 20, h: 50 }
  ]);

  assert.equal(horizontal.h, 20);
  assert.equal(vertical.h, 40);
}

testObstacleVisualsTrimSmallJoinOverhangs();

function testObstacleVisualsTrimTouchingJoinOverhangs() {
  const [, vertical] = normalizedObstacleRects([
    { x: 0, y: 20, w: 100, h: 20 },
    { x: 100, y: 0, w: 20, h: 50 }
  ]);

  assert.equal(vertical.h, 40);
}

testObstacleVisualsTrimTouchingJoinOverhangs();

const originalDocument = globalThis.document;

globalThis.document = {
  createElementNS() {
    return new FakeElement();
  }
};

try {
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

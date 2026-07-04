import assert from "node:assert/strict";
import { renderObstacleWalls } from "../rendering/rendering.js";
import { FakeElement } from "./test-dom.js";

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

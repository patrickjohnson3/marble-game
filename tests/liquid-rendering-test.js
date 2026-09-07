import assert from "node:assert/strict";
import { ELLIPTICAL_SURFACE_SHAPES } from "../core/map-elements.js";
import { renderGooPatches } from "../rendering/goo-patch-rendering.js";
import { traceLiquidPatchPath } from "../rendering/liquid-patch-shape.js";
import { renderWaterPatches } from "../rendering/water-patch-rendering.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function testLiquidEdgesTrackPhysics() {
  for (const type of ["waterPatch", "gooPatch"]) {
    const shape = ELLIPTICAL_SURFACE_SHAPES[type];
    for (const patch of [
      { x: 2060, y: 1280, w: 1120, h: 760 },
      { x: 37, y: 71, w: 100, h: 60 },
      { x: 100, y: 200, w: 12, h: 8 },
    ]) {
      Object.freeze(patch);
      const context = new FakeCanvasElement().context;
      traceLiquidPatchPath(context, patch, type);
      const points = context.calls.filter(
        ([name]) => name === "moveTo" || name === "lineTo",
      );
      let unevenEdge = false;
      for (const [, x, y] of points) {
        const dx = x - (patch.x + patch.w * shape.centerX);
        const dy = y - (patch.y + patch.h * shape.centerY);
        const localX = shape.cos * dx + shape.sin * dy;
        const localY = -shape.sin * dx + shape.cos * dy;
        const radius = Math.hypot(
          localX / (patch.w * shape.radiusX),
          localY / (patch.h * shape.radiusY),
        );
        const distanceFromEllipse = Math.hypot(
          localX - localX / radius,
          localY - localY / radius,
        );
        assert.ok(Number.isFinite(distanceFromEllipse));
        assert.ok(
          distanceFromEllipse < (type === "waterPatch" ? 4 : 6),
          "the visible meniscus must stay close to the authoritative physics ellipse",
        );
        if (distanceFromEllipse > 0.005) unevenEdge = true;
      }
      assert.ok(
        unevenEdge,
        "the edge should have restrained organic variation",
      );
      assert.ok(context.calls.some(([name]) => name === "closePath"));
      assert.ok(
        points.length <= 100,
        "contour work should stay bounded at every patch size",
      );
    }
  }
}

function testCachedLiquidLayers() {
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => new FakeCanvasElement() };
  try {
    for (const render of [renderWaterPatches, renderGooPatches]) {
      const patch = Object.freeze({ x: 240, y: 120, w: 800, h: 500 });
      const container = new FakeElement();
      const options = {
        padding: 24,
        bounds: { left: 240, top: 120, width: 800, height: 500 },
      };
      render(container, [patch], options);
      const canvas = container.firstChild;
      const firstCalls = canvas.context.calls.slice();
      assert.equal(
        container.children.length,
        1,
        "a liquid type needs only one retained terrain canvas",
      );
      assert.equal(
        firstCalls.filter(([name]) => name === "save").length,
        firstCalls.filter(([name]) => name === "restore").length,
        "liquid drawing must balance canvas state",
      );
      assert.ok(
        firstCalls.some(([name]) => name === "clip"),
        "interior details must stay inside the patch",
      );

      const duplicate = new FakeElement();
      render(duplicate, [patch], options);
      assert.deepEqual(
        duplicate.firstChild.context.calls,
        firstCalls,
        "static liquid detail must be deterministic across resets",
      );

      canvas.context.calls.length = 0;
      render(container, [{ x: 350, y: 210, w: 420, h: 260 }], options);
      assert.equal(
        container.firstChild,
        canvas,
        "a shrinking puddle must reuse its terrain canvas",
      );
      assert.ok(
        canvas.context.calls.some(
          ([name, , , width, height]) =>
            name === "clearRect" &&
            width === canvas.width &&
            height === canvas.height,
        ),
        "a changed patch must clear the previous wet footprint",
      );
      for (const call of canvas.context.calls) {
        for (const value of call.slice(1)) {
          if (typeof value === "number") assert.ok(Number.isFinite(value));
        }
      }

      render(container, [], options);
      assert.equal(
        container.children.length,
        0,
        "switching to a map without that liquid must clear its layer",
      );
    }
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

testLiquidEdgesTrackPhysics();
testCachedLiquidLayers();
console.log("Liquid rendering tests passed.");

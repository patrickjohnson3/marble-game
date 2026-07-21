import assert from "node:assert/strict";
import { createSpatialIndex } from "../core/spatial-index.js";

function testSpatialIndexReturnsNearbyRects() {
  const near = { x: 20, y: 20, w: 30, h: 30 };
  const far = { x: 600, y: 600, w: 40, h: 40 };
  const index = createSpatialIndex([near, far], { cellSize: 100 });

  assert.deepEqual(index.queryCircle({ x: 35, y: 35, r: 10 }), [near]);
}

testSpatialIndexReturnsNearbyRects();

function testSpatialIndexDedupesMultiCellRects() {
  const large = { x: 90, y: 90, w: 150, h: 150 };
  const index = createSpatialIndex([large], { cellSize: 100 });

  assert.deepEqual(index.queryCircle({ x: 120, y: 120, r: 60 }), [large]);
}

testSpatialIndexDedupesMultiCellRects();

function testSpatialIndexCanReuseQueryStorage() {
  const near = { x: 20, y: 20, w: 30, h: 30 };
  const far = { x: 600, y: 600, w: 40, h: 40 };
  const index = createSpatialIndex([near, far], { cellSize: 100 });
  const matches = [far];
  const seen = new Set([1]);

  assert.equal(
    index.queryCircleInto({ x: 35, y: 35, r: 10 }, matches, seen),
    matches,
  );
  assert.deepEqual(matches, [near]);
  assert.deepEqual([...seen], [0]);
}

testSpatialIndexCanReuseQueryStorage();

console.log("Spatial index tests passed.");

import assert from "node:assert/strict";
import { normalizedObstacleRects } from "../core/map.js";

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
  assert.equal(vertical.w, 20);
}

testObstacleVisualsTrimTouchingJoinOverhangs();

console.log("Map tests passed.");

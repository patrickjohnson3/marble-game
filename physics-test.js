import assert from "node:assert/strict";
import { circleRectContact } from "./geometry.js";
import { marbleOverRect, resolveObstacleCollision } from "./physics.js";

function testCircleRectContact() {
  const circle = { x: 15, y: 15, r: 10 };
  const rect = { x: 25, y: 10, w: 20, h: 20 };

  assert.equal(circleRectContact(circle, rect).intersects, true);
  assert.equal(marbleOverRect(circle, rect), true);
  assert.equal(marbleOverRect({ x: 0, y: 0, r: 5 }, rect), false);
}

function testObstacleBounce() {
  const marble = { x: 90, y: 50, vx: 8, vy: 0, r: 12 };
  const obstacle = { x: 100, y: 30, w: 40, h: 40 };
  const impacts = [];

  resolveObstacleCollision(marble, obstacle, { bounce: 0.5 }, (impact) => impacts.push(impact));

  assert.equal(marble.x, 88);
  assert.equal(marble.y, 50);
  assert.equal(marble.vx, -4);
  assert.equal(marble.vy, 0);
  assert.deepEqual(impacts, [8]);
}

function testDeepOverlapPushesToNearestEdge() {
  const marble = { x: 120, y: 55, vx: 0, vy: 0, r: 10 };
  const obstacle = { x: 100, y: 50, w: 80, h: 80 };

  resolveObstacleCollision(marble, obstacle, { bounce: 0.5 });

  assert.equal(marble.y, 40);
  assert.equal(circleRectContact(marble, obstacle).distanceSq, marble.r * marble.r);
}

testCircleRectContact();
testObstacleBounce();
testDeepOverlapPushesToNearestEdge();

console.log("Physics tests passed.");

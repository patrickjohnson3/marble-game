import assert from "node:assert/strict";
import { circleRectContact } from "../core/geometry.js";
import {
  marbleOverRect,
  resolveObstacleCollision,
  updatePhysics,
  updatePhysicsInput,
} from "../core/physics.js";
import { createSpatialIndex } from "../core/spatial-index.js";

function assertNear(actual, expected, tolerance = 1e-9) {
  assert.equal(
    Math.abs(actual - expected) <= tolerance,
    true,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

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

  resolveObstacleCollision(marble, obstacle, { bounce: 0.5 }, (impact) =>
    impacts.push(impact),
  );

  assert.equal(marble.x, 88);
  assert.equal(marble.y, 50);
  assert.equal(marble.vx, -4);
  assert.equal(marble.vy, 0);
  assert.deepEqual(impacts, [8]);
}

function testGlancingImpactReportsScrapeFeedback() {
  const marble = { x: 90, y: 50, vx: 8, vy: 4, r: 12 };
  const obstacle = { x: 100, y: 30, w: 40, h: 40 };
  const impacts = [];

  resolveObstacleCollision(
    marble,
    obstacle,
    {
      bounce: 0.5,
      scrapeHapticScale: 0.25,
    },
    (impact) => impacts.push(impact),
  );

  assert.equal(impacts[0], 9);
}

function testDeepOverlapPushesToNearestEdge() {
  const marble = { x: 120, y: 55, vx: 0, vy: 0, r: 10 };
  const obstacle = { x: 100, y: 50, w: 80, h: 80 };

  resolveObstacleCollision(marble, obstacle, { bounce: 0.5 });

  assert.equal(marble.y, 40);
  assert.equal(
    circleRectContact(marble, obstacle).distanceSq,
    marble.r * marble.r,
  );
}

function testDeepOverlapTieBreaksTowardFirstNearestEdge() {
  const marble = { x: 50, y: 50, vx: 0, vy: 0, r: 10 };
  const obstacle = { x: 40, y: 40, w: 20, h: 20 };

  resolveObstacleCollision(marble, obstacle, { bounce: 0.5 });

  assert.equal(marble.x, 30);
  assert.equal(marble.y, 50);
}

function testRoughPatchAddsDrag() {
  const marble = { x: 50, y: 50, vx: 10, vy: 0, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      physics: {
        accel: 0,
        friction: 1,
        roughPatchFriction: 0.5,
        bounce: 0.5,
        maxSpeed: 100,
        maxStepDistance: 100,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(marble.vx, 5);
}

function testRoughPatchDragUsesSpatialIndex() {
  const marble = { x: 50, y: 50, vx: 10, vy: 0, r: 10 };
  const roughPatches = [
    { x: 500, y: 500, w: 40, h: 40 },
    { x: 40, y: 40, w: 40, h: 40 },
  ];

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 800, top: 0, bottom: 800 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches,
      roughPatchIndex: createSpatialIndex(roughPatches, { cellSize: 100 }),
      physics: {
        accel: 0,
        friction: 1,
        roughPatchFriction: 0.5,
        bounce: 0.5,
        maxSpeed: 100,
        maxStepDistance: 100,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(marble.vx, 5);
}

function testRoughPatchDragAppliesWhenEnteringPatch() {
  const marble = { x: 20, y: 50, vx: 10, vy: 0, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      physics: {
        accel: 0,
        friction: 1,
        roughPatchFriction: 0.5,
        bounce: 0.5,
        maxSpeed: 100,
        maxStepDistance: 100,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(marble.vx, 5);
}

function testLowSpeedDriftSettles() {
  const marble = { x: 50, y: 50, vx: 0.02, vy: 0.01, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0.1, smoothY: 0.1 },
      obstacles: [],
      roughPatches: [],
      physics: {
        accel: 0,
        friction: 1,
        roughPatchFriction: 0.5,
        bounce: 0.5,
        maxSpeed: 100,
        maxStepDistance: 100,
        settleSpeed: 0.04,
        settleTilt: 0.5,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(marble.vx, 0);
  assert.equal(marble.vy, 0);
}

function testTiltCurveSoftensSmallSensorInput() {
  const context = {
    tilt: {
      rawX: 5,
      rawY: 10,
      neutralX: 0,
      neutralY: 0,
      smoothX: 0,
      smoothY: 0,
    },
    keyboard: { x: 0, y: 0 },
    physics: {
      deadZone: 0,
      maxTilt: 10,
      keyboardTilt: 18,
      smoothing: 1,
      tiltCurve: 2,
    },
  };

  updatePhysicsInput(context, 1);

  assert.equal(context.tilt.smoothX, 2.5);
  assert.equal(context.tilt.smoothY, 10);
}

function testTiltSmoothingIsFrameRateIndependent() {
  const once = {
    tilt: {
      rawX: 10,
      rawY: 0,
      neutralX: 0,
      neutralY: 0,
      smoothX: 0,
      smoothY: 0,
    },
    keyboard: { x: 0, y: 0 },
    physics: {
      deadZone: 0,
      maxTilt: 10,
      keyboardTilt: 18,
      smoothing: 0.2,
      tiltCurve: 1,
    },
  };
  const split = JSON.parse(JSON.stringify(once));

  updatePhysicsInput(once, 1);
  updatePhysicsInput(split, 0.5);
  updatePhysicsInput(split, 0.5);

  assertNear(split.tilt.smoothX, once.tilt.smoothX);
}

function testVelocityDragIsFrameRateIndependent() {
  function context() {
    return {
      marble: { x: 50, y: 50, vx: 10, vy: 0, r: 10 },
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [],
      physics: {
        accel: 0,
        friction: 0.94,
        roughPatchFriction: 1,
        bounce: 0.5,
        maxSpeed: 100,
        maxStepDistance: 100,
        settleSpeed: 0,
        settleTilt: 0,
      },
    };
  }
  const once = context();
  const split = context();

  updatePhysics(once, 1, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updatePhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updatePhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });

  assertNear(split.marble.vx, once.marble.vx);
}

function testMaxSpeedEasesDown() {
  const marble = { x: 50, y: 50, vx: 20, vy: 0, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [],
      physics: {
        accel: 0,
        friction: 1,
        roughPatchFriction: 0.5,
        bounce: 0.5,
        maxSpeed: 10,
        maxSpeedEase: 0.5,
        maxStepDistance: 100,
        settleSpeed: 0,
        settleTilt: 0,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(marble.vx, 15);
}

function testWallCollisionAppliesTangentialFriction() {
  const marble = { x: 5, y: 50, vx: -4, vy: 10, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [],
      physics: {
        accel: 0,
        friction: 1,
        roughPatchFriction: 0.5,
        bounce: 0.5,
        maxSpeed: 100,
        maxSpeedEase: 0,
        maxStepDistance: 100,
        settleSpeed: 0,
        settleTilt: 0,
        wallTangentialFriction: 0.5,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(marble.x, 10);
  assert.equal(marble.vx, 2);
  assert.equal(marble.vy, 5);
}

function testWorldBoundCollisionBeforeAdjacentObstacle() {
  const marble = { x: 5, y: 50, vx: 0, vy: 0, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [{ x: 20, y: 40, w: 20, h: 20 }],
      roughPatches: [],
      physics: {
        accel: 0,
        friction: 1,
        roughPatchFriction: 1,
        bounce: 0,
        maxSpeed: 100,
        maxStepDistance: 100,
        settleSpeed: 0,
        settleTilt: 0,
        collisionResolvePasses: 1,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(marble.x, 10);
}

function testPhysicsSubstepsAreCapped() {
  const marble = { x: 50, y: 50, vx: 1000, vy: 0, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 10000, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [],
      physics: {
        accel: 0,
        friction: 1,
        roughPatchFriction: 1,
        bounce: 0,
        maxSpeed: 1000,
        maxSpeedEase: 0,
        maxStepDistance: 1,
        maxPhysicsSubsteps: 10,
        settleSpeed: 0,
        settleTilt: 0,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(marble.x, 1050);
}

testCircleRectContact();
testObstacleBounce();
testGlancingImpactReportsScrapeFeedback();
testDeepOverlapPushesToNearestEdge();
testDeepOverlapTieBreaksTowardFirstNearestEdge();
testRoughPatchAddsDrag();
testRoughPatchDragUsesSpatialIndex();
testRoughPatchDragAppliesWhenEnteringPatch();
testLowSpeedDriftSettles();
testTiltCurveSoftensSmallSensorInput();
testTiltSmoothingIsFrameRateIndependent();
testVelocityDragIsFrameRateIndependent();
testMaxSpeedEasesDown();
testWallCollisionAppliesTangentialFriction();
testWorldBoundCollisionBeforeAdjacentObstacle();
testPhysicsSubstepsAreCapped();

console.log("Physics tests passed.");

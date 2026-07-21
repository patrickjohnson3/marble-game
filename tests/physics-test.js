import assert from "node:assert/strict";
import {
  circleFrom,
  circleRectContact,
  expandedCircle,
} from "../core/geometry.js";
import {
  handleWallCollisions,
  marbleOverRect,
  resolveObstacleCollision,
} from "../core/physics-collisions.js";
import {
  SURFACE_TYPES,
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

function testCircleShapeHelpers() {
  const source = { x: 12, y: 18, r: 4, extra: true };

  assert.deepEqual(circleFrom(source), { x: 12, y: 18, r: 4 });
  assert.deepEqual(circleFrom(source, 9), { x: 12, y: 18, r: 9 });
  assert.deepEqual(expandedCircle(source, 2.5), { x: 12, y: 18, r: 10 });
}

function testCircleRectContactEdgeCases() {
  const rect = { x: 10, y: 10, w: 20, h: 20 };
  const edge = circleRectContact({ x: 5, y: 20, r: 5 }, rect);
  const corner = circleRectContact({ x: 6, y: 6, r: Math.SQRT2 * 4 }, rect);
  const inside = circleRectContact({ x: 20, y: 20, r: 5 }, rect);
  const nearMiss = circleRectContact({ x: 4.9, y: 20, r: 5 }, rect, 1.1);

  assert.deepEqual(edge, {
    intersects: true,
    dx: -5,
    dy: 0,
    distanceSq: 25,
  });
  assert.equal(corner.intersects, true);
  assertNear(corner.distanceSq, 32);
  assert.deepEqual(inside, {
    intersects: true,
    dx: 0,
    dy: 0,
    distanceSq: 0,
  });
  assert.equal(nearMiss.intersects, true);
}

function testMarbleOverRectHonorsEpsilon() {
  const marble = { x: 4.9, y: 20, r: 5 };
  const rect = { x: 10, y: 10, w: 20, h: 20 };

  assert.equal(marbleOverRect(marble, rect), false);
  assert.equal(marbleOverRect(marble, rect, 1.1), true);
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

function testObstacleCornerBounceUsesDiagonalNormal() {
  const marble = { x: 92, y: 92, vx: 6, vy: 6, r: 12 };
  const obstacle = { x: 100, y: 100, w: 40, h: 40 };
  const impacts = [];

  resolveObstacleCollision(marble, obstacle, { bounce: 0.5 }, (impact) =>
    impacts.push(impact),
  );

  assertNear(marble.x, 91.51471862576143);
  assertNear(marble.y, 91.51471862576143);
  assertNear(marble.vx, -3);
  assertNear(marble.vy, -3);
  assertNear(impacts[0], 8.48528137423857);
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
        baseDragRetention: 1,
        roughPatchDragRetention: 0.5,
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
        baseDragRetention: 1,
        roughPatchDragRetention: 0.5,
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

function testIcePatchReducesDrag() {
  const marble = { x: 50, y: 50, vx: 10, vy: 0, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      icePatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      obstacles: [],
      roughPatches: [],
      physics: {
        accel: 0,
        baseDragRetention: 0.5,
        icePatchDragRetention: 0.9,
        roughPatchDragRetention: 0.5,
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

  assert.equal(marble.vx, 9);
}

function testTerrainFeedbackReportsSurfaceTypes() {
  const marble = { x: 50, y: 50, vx: 4, vy: 0, r: 10 };
  const surfaces = [];

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      keyboard: { x: 0, y: 0 },
      obstacles: [],
      roughPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      icePatches: [{ x: 120, y: 40, w: 40, h: 40 }],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
        icePatchDragRetention: 1,
        bounce: 0,
        maxSpeed: 100,
        maxStepDistance: 100,
        settleSpeed: 0,
        settleTilt: 0,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
      onTerrain: (surfaceType) => surfaces.push(surfaceType),
    },
  );

  assert.deepEqual(surfaces, [SURFACE_TYPES.roughPatch]);
}

function testHazardPatchReportsResetFeedback() {
  const marble = { x: 50, y: 50, vx: 0, vy: 0, r: 10 };
  let hazards = 0;

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      hazardPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      roughPatches: [],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
        bounce: 0,
        maxSpeed: 100,
        maxStepDistance: 100,
        settleSpeed: 0,
        settleTilt: 0,
      },
    },
    1,
    {
      onHazard: () => {
        hazards++;
      },
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(hazards, 1);
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
        baseDragRetention: 1,
        roughPatchDragRetention: 0.5,
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
        baseDragRetention: 1,
        roughPatchDragRetention: 0.5,
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

function testLowSpeedDriftDoesNotSettleAboveSpeedThreshold() {
  const marble = { x: 50, y: 50, vx: 0.05, vy: 0, r: 10 };

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
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
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

  assert.equal(marble.vx, 0.05);
}

function testLowSpeedDriftDoesNotSettleAboveTiltThreshold() {
  const marble = { x: 50, y: 50, vx: 0.02, vy: 0.01, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0.5, smoothY: 0 },
      obstacles: [],
      roughPatches: [],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
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

  assert.equal(marble.vx, 0.02);
  assert.equal(marble.vy, 0.01);
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
        baseDragRetention: 0.94,
        roughPatchDragRetention: 1,
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

function testAccelerationIsFrameRateIndependent() {
  function context() {
    return {
      marble: { x: 50, y: 50, vx: 0, vy: 0, r: 10 },
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 4, smoothY: -2 },
      obstacles: [],
      roughPatches: [],
      physics: {
        accel: 0.5,
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
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
  assertNear(split.marble.vy, once.marble.vy);
}

function testRoughPatchDragIsFrameRateIndependent() {
  function context() {
    return {
      marble: { x: 50, y: 50, vx: 10, vy: 0, r: 10 },
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [{ x: 0, y: 0, w: 200, h: 200 }],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        roughPatchDragRetention: 0.9,
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
        baseDragRetention: 1,
        roughPatchDragRetention: 0.5,
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

function testMaxSpeedClampIsFrameRateIndependent() {
  function context() {
    return {
      marble: { x: 50, y: 50, vx: 9, vy: 0, r: 10 },
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 4, smoothY: 0 },
      obstacles: [],
      roughPatches: [],
      physics: {
        accel: 1,
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
        bounce: 0.5,
        maxSpeed: 10,
        maxSpeedEase: 0,
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

  assert.equal(once.marble.vx, 10);
  assertNear(split.marble.vx, once.marble.vx);
}

function testWallCollisionAppliesTangentialDrag() {
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
        baseDragRetention: 1,
        roughPatchDragRetention: 0.5,
        bounce: 0.5,
        maxSpeed: 100,
        maxSpeedEase: 0,
        maxStepDistance: 100,
        settleSpeed: 0,
        settleTilt: 0,
        wallTangentialDragRetention: 0.5,
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
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
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

function testMultipleCollisionPassesResolveChainedOverlaps() {
  const obstacles = [
    { x: 100, y: 40, w: 20, h: 20 },
    { x: 80, y: 40, w: 20, h: 20 },
  ];
  const marble = { x: 100, y: 50, vx: 0, vy: 0, r: 15 };

  handleWallCollisions(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      obstacles,
      physics: {
        bounce: 0,
        collisionResolvePasses: 2,
      },
    },
    () => {},
  );

  for (const obstacle of obstacles) {
    const contact = circleRectContact(marble, obstacle);

    assert.equal(contact.distanceSq >= marble.r * marble.r, true);
  }
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
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
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

function testInvalidPhysicsStepInputsDoNotPoisonState() {
  const marble = { x: 50, y: 50, vx: 10, vy: 0, r: 10 };

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
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
        bounce: 0,
        maxSpeed: 100,
        maxStepDistance: 0,
        maxPhysicsSubsteps: 0,
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

  assert.equal(Number.isFinite(marble.x), true);
  assert.equal(Number.isFinite(marble.y), true);

  const x = marble.x;
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
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
        bounce: 0,
        maxSpeed: 100,
        maxStepDistance: 100,
        settleSpeed: 0,
        settleTilt: 0,
      },
    },
    Number.NaN,
    {
      onImpact: () => {},
      onSurface: () => {},
    },
  );

  assert.equal(marble.x, x);
}

function testSubstepsPreventThinObstacleTunneling() {
  const marble = { x: 50, y: 50, vx: 40, vy: 0, r: 10 };

  updatePhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [{ x: 80, y: 40, w: 5, h: 20 }],
      roughPatches: [],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        roughPatchDragRetention: 1,
        bounce: 0,
        maxSpeed: 100,
        maxSpeedEase: 0,
        maxStepDistance: 5,
        maxPhysicsSubsteps: 20,
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

  assert.equal(marble.x <= 70, true);
  assert.equal(marble.vx, 0);
}

testCircleRectContact();
testCircleShapeHelpers();
testCircleRectContactEdgeCases();
testMarbleOverRectHonorsEpsilon();
testObstacleBounce();
testObstacleCornerBounceUsesDiagonalNormal();
testGlancingImpactReportsScrapeFeedback();
testDeepOverlapPushesToNearestEdge();
testDeepOverlapTieBreaksTowardFirstNearestEdge();
testRoughPatchAddsDrag();
testRoughPatchDragUsesSpatialIndex();
testIcePatchReducesDrag();
testTerrainFeedbackReportsSurfaceTypes();
testHazardPatchReportsResetFeedback();
testRoughPatchDragAppliesWhenEnteringPatch();
testLowSpeedDriftSettles();
testLowSpeedDriftDoesNotSettleAboveSpeedThreshold();
testLowSpeedDriftDoesNotSettleAboveTiltThreshold();
testTiltCurveSoftensSmallSensorInput();
testTiltSmoothingIsFrameRateIndependent();
testVelocityDragIsFrameRateIndependent();
testAccelerationIsFrameRateIndependent();
testRoughPatchDragIsFrameRateIndependent();
testMaxSpeedEasesDown();
testMaxSpeedClampIsFrameRateIndependent();
testWallCollisionAppliesTangentialDrag();
testWorldBoundCollisionBeforeAdjacentObstacle();
testMultipleCollisionPassesResolveChainedOverlaps();
testPhysicsSubstepsAreCapped();
testInvalidPhysicsStepInputsDoNotPoisonState();
testSubstepsPreventThinObstacleTunneling();

console.log("Physics tests passed.");

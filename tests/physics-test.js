import assert from "node:assert/strict";
import {
  circleFrom,
  circleRectContact,
  clamp,
  distance,
  expandedCircle,
  midpoint,
} from "../core/geometry.js";
import {
  circleOrientedRectContact,
  circleOrientedRoundedRectContact,
  handleWallCollisions,
  marbleOverRect,
  resolveObstacleCollision,
} from "../core/physics-collisions.js";
import {
  PRE_MOVE_SURFACE_TYPES,
  SURFACE_TYPES,
  SWEPT_SURFACE_TYPES,
  physicsSubstepCount,
  updatePhysics,
  updatePhysicsInput,
} from "../core/physics.js";
import { MAP_ELEMENT_TYPES } from "../core/map-elements.js";
import { physicsConfig } from "../core/game-config.js";

function assertNear(actual, expected, tolerance = 1e-9) {
  assert.equal(
    Math.abs(actual - expected) <= tolerance,
    true,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function terrainBucket(elements = []) {
  return { elements };
}

function updateTestPhysics(context, dt, feedback) {
  const terrainByType = context.terrainByType ?? {
    [MAP_ELEMENT_TYPES.gooPatch]: terrainBucket(context.gooPatches),
    [MAP_ELEMENT_TYPES.hazardPatch]: terrainBucket(context.hazardPatches),
    [MAP_ELEMENT_TYPES.icePatch]: terrainBucket(context.icePatches),
    [MAP_ELEMENT_TYPES.roughPatch]: terrainBucket(context.roughPatches),
    [MAP_ELEMENT_TYPES.waterPatch]: terrainBucket(context.waterPatches),
  };

  return updatePhysics(
    {
      ...context,
      mapState: {
        obstacles: context.obstacles ?? [],
        terrainByType,
      },
    },
    dt,
    feedback,
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
  assert.equal(clamp(14, 0, 10), 10);
  assert.equal(clamp(-4, 0, 10), 0);
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.deepEqual(midpoint({ x: 2, y: 4 }, { x: 6, y: 10 }), {
    x: 4,
    y: 7,
  });
}

function testCircleRectContactEdgeCases() {
  const rect = { x: 10, y: 10, w: 20, h: 20 };
  const edge = circleRectContact({ x: 5, y: 20, r: 5 }, rect);
  const corner = circleRectContact({ x: 6, y: 6, r: Math.SQRT2 * 4 }, rect);
  const inside = circleRectContact({ x: 20, y: 20, r: 5 }, rect);
  const nearMiss = circleRectContact({ x: 4.9, y: 20, r: 5 }, rect, 1.1);
  const target = {};
  const reused = circleRectContact({ x: 10, y: 20, r: 0 }, rect, 0, target);

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
  assert.equal(reused, target);
  assert.deepEqual(reused, {
    intersects: true,
    dx: 0,
    dy: 0,
    distanceSq: 0,
  });
}

function testCircleOrientedRectContactUsesRotatedNormal() {
  const angle = Math.PI / 4;
  const normal = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
  const circle = {
    x: 100 + normal.x * 18,
    y: 100 + normal.y * 18,
    r: 10,
  };
  const rect = {
    x: 50,
    y: 50,
    w: 100,
    h: 100,
    hitboxW: 100,
    hitboxH: 20,
    angle,
  };
  const contact = circleOrientedRectContact(circle, rect);

  assert.equal(contact.intersects, true);
  assertNear(contact.distanceSq, 64);
  assertNear(contact.dx, normal.x * 8);
  assertNear(contact.dy, normal.y * 8);
}

function testCircleOrientedRectContactUsesCachedCollisionFields() {
  const angle = Math.PI / 6;
  const rect = {
    x: 0,
    y: 0,
    w: 200,
    h: 60,
    hitboxW: 40,
    hitboxH: 20,
    angle: 0,
    collisionCenterX: 100,
    collisionCenterY: 100,
    collisionHalfWidth: 20,
    collisionHalfHeight: 10,
    collisionCos: Math.cos(angle),
    collisionSin: Math.sin(angle),
  };
  const circle = { x: 100, y: 100, r: 5 };
  const contact = circleOrientedRectContact(circle, rect);

  assert.equal(contact.intersects, true);
  assert.equal(contact.distanceSq, 0);
  assert.equal(Number.isFinite(contact.insideNx), true);
  assert.equal(Number.isFinite(contact.insideNy), true);
}

function testCircleOrientedRoundedRectRejectsClearCornerContact() {
  const halfWidth = 50;
  const halfHeight = 25;
  const cornerOffset = 22 / Math.SQRT2;
  const rect = {
    x: 50,
    y: 75,
    w: halfWidth * 2,
    h: halfHeight * 2,
    angle: 0,
  };
  const circle = {
    x: 100 + halfWidth + cornerOffset,
    y: 100 + halfHeight + cornerOffset,
    r: 25,
  };

  assert.equal(
    circleOrientedRectContact(circle, rect).intersects,
    true,
    "the sharp rectangle demonstrates the old transparent-corner collision",
  );
  assert.equal(
    circleOrientedRoundedRectContact(circle, rect, 15).intersects,
    false,
    "the rounded collider should leave a visibly clear corner alone",
  );
}

testCircleOrientedRoundedRectRejectsClearCornerContact();

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

function testObstacleCollisionDoesNotBounceWhenMovingAway() {
  const marble = { x: 90, y: 50, vx: -8, vy: 0, r: 12 };
  const obstacle = { x: 100, y: 30, w: 40, h: 40 };
  const impacts = [];

  resolveObstacleCollision(marble, obstacle, { bounce: 0.5 }, (impact) =>
    impacts.push(impact),
  );

  assert.equal(marble.x, 88);
  assert.equal(marble.vx, -8);
  assert.deepEqual(impacts, []);
}

function testAxisAlignedCollisionIgnoresReusedOrientedInsideNormal() {
  for (const orientedPosition of [
    { x: 0, y: 0 },
    { x: 150, y: 150 },
  ]) {
    const contact = {};
    resolveObstacleCollision(
      { ...orientedPosition, vx: 0, vy: 0, r: 10 },
      { x: 100, y: 100, w: 100, h: 100, angle: Math.PI / 2 },
      { bounce: 0.5 },
      () => {},
      contact,
    );
    const marble = { x: 105, y: 115, vx: 4, vy: 2, r: 10 };
    const impacts = [];

    resolveObstacleCollision(
      marble,
      { x: 100, y: 100, w: 50, h: 50 },
      { bounce: 0.5 },
      (impact) => impacts.push(impact),
      contact,
    );

    assert.deepEqual(
      marble,
      { x: 90, y: 115, vx: -2, vy: 2, r: 10 },
      "a previous rotated hit or miss must not change the nearest exit edge",
    );
    assert.deepEqual(impacts, [4]);
  }
}

function testObstacleCollisionHonorsBounceExtremes() {
  const stopped = { x: 90, y: 50, vx: 8, vy: 0, r: 12 };
  const reflected = { x: 90, y: 50, vx: 8, vy: 0, r: 12 };
  const obstacle = { x: 100, y: 30, w: 40, h: 40 };

  resolveObstacleCollision(stopped, obstacle, { bounce: 0 });
  resolveObstacleCollision(reflected, obstacle, { bounce: 1 });

  assert.equal(stopped.vx, 0);
  assert.equal(reflected.vx, -8);
}

function testCollisionPositionSlopCanLeaveSmallOverlap() {
  const marble = { x: 90, y: 50, vx: 8, vy: 0, r: 12 };
  const obstacle = { x: 100, y: 30, w: 40, h: 40 };

  resolveObstacleCollision(marble, obstacle, {
    bounce: 0.5,
    collisionPositionSlop: 1,
  });

  assert.equal(marble.x, 89);
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

function testOrientedObstacleCollisionResolvesAlongRotatedNormal() {
  const angle = Math.PI / 4;
  const normal = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
  const marble = {
    x: 100 + normal.x * 18,
    y: 100 + normal.y * 18,
    vx: -normal.x * 8,
    vy: -normal.y * 8,
    r: 10,
  };
  const obstacle = {
    x: 50,
    y: 50,
    w: 100,
    h: 100,
    hitboxW: 100,
    hitboxH: 20,
    angle,
  };
  const impacts = [];

  resolveObstacleCollision(marble, obstacle, { bounce: 0.5 }, (impact) =>
    impacts.push(impact),
  );

  assertNear(marble.x, 100 + normal.x * 20);
  assertNear(marble.y, 100 + normal.y * 20);
  assertNear(impacts[0], 8);
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

function testNearZeroOrientedContactCanUseInsideNormal() {
  const angle = Math.PI / 4;
  const circle = { x: 100 + 1e-8, y: 100, r: 10 };
  const rect = {
    x: 50,
    y: 50,
    w: 100,
    h: 100,
    hitboxW: 100,
    hitboxH: 20,
    angle,
  };
  const contact = circleOrientedRectContact(circle, rect, 0, {}, 1e-6);

  assert.equal(contact.intersects, true);
  assert.equal(Number.isFinite(contact.insideNx), true);
  assert.equal(Number.isFinite(contact.insideNy), true);
}

function testRoughPatchAddsDrag() {
  const marble = { x: 50, y: 50, vx: 10, vy: 0, r: 10 };

  updateTestPhysics(
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

function testRoughPatchDragChecksAllPatches() {
  const marble = { x: 50, y: 50, vx: 10, vy: 0, r: 10 };
  const roughPatches = [
    { x: 500, y: 500, w: 40, h: 40 },
    { x: 40, y: 40, w: 40, h: 40 },
  ];

  updateTestPhysics(
    {
      marble,
      bounds: { left: 0, right: 800, top: 0, bottom: 800 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches,
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

  updateTestPhysics(
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

function testIcePatchUsesPreMoveSurfaceTiming() {
  const marble = { x: 20, y: 50, vx: 10, vy: 0, r: 10 };

  updateTestPhysics(
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
        roughPatchDragRetention: 1,
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

  assert.deepEqual(PRE_MOVE_SURFACE_TYPES, [SURFACE_TYPES.icePatch]);
  assert.deepEqual(SWEPT_SURFACE_TYPES, [
    SURFACE_TYPES.gooPatch,
    SURFACE_TYPES.roughPatch,
    SURFACE_TYPES.waterPatch,
    SURFACE_TYPES.hazardPatch,
  ]);
  assert.equal(marble.vx, 5);
}

function testWaterPatchAddsModerateDragAndFeedback() {
  const marble = { x: 50, y: 50, vx: 10, vy: 0, r: 10 };
  const surfaces = [];
  const surfaceFeedback = [];

  updateTestPhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [],
      waterPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        roughPatchDragRetention: 0.5,
        waterPatchDragRetention: 0.8,
        bounce: 0.5,
        maxSpeed: 100,
        maxStepDistance: 100,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: (speed, surfaceType) => {
        surfaceFeedback.push([speed, surfaceType]);
      },
      onTerrain: (surfaceType) => surfaces.push(surfaceType),
    },
  );

  assert.equal(marble.vx, 8);
  assert.deepEqual(surfaces, [SURFACE_TYPES.waterPatch]);
  assert.deepEqual(surfaceFeedback, [[8, SURFACE_TYPES.waterPatch]]);
}

function testWaterPatchIgnoresTransparentCorner() {
  const marble = { x: 45, y: 45, vx: 1, vy: 0, r: 5 };
  const surfaces = [];
  const surfaceFeedback = [];

  updateTestPhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [],
      waterPatches: [{ x: 40, y: 40, w: 100, h: 100 }],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        roughPatchDragRetention: 0.5,
        waterPatchDragRetention: 0.5,
        bounce: 0.5,
        maxSpeed: 100,
        maxStepDistance: 100,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: (speed, surfaceType) => {
        surfaceFeedback.push([speed, surfaceType]);
      },
      onTerrain: (surfaceType) => surfaces.push(surfaceType),
    },
  );

  assert.equal(marble.vx, 1);
  assert.deepEqual(surfaces, [SURFACE_TYPES.floor]);
  assert.deepEqual(surfaceFeedback, []);
}

function testWaterPatchSweepMatchesVisibleShape() {
  const patch = { x: 80, y: 40, w: 100, h: 100 };
  const centeredMarble = { x: 20, y: 92, vx: 150, vy: 0, r: 5 };
  const cornerMarble = { x: 20, y: 45, vx: 150, vy: 0, r: 5 };
  const context = {
    bounds: { left: 0, right: 240, top: 0, bottom: 200 },
    intro: { released: true },
    tilt: { smoothX: 0, smoothY: 0 },
    obstacles: [],
    roughPatches: [],
    waterPatches: [patch],
    physics: {
      accel: 0,
      baseDragRetention: 1,
      roughPatchDragRetention: 1,
      waterPatchDragRetention: 0.5,
      bounce: 0,
      maxSpeed: 200,
      maxStepDistance: 200,
    },
  };
  const feedback = { onImpact: () => {}, onSurface: () => {} };

  updateTestPhysics({ ...context, marble: centeredMarble }, 1, feedback);
  updateTestPhysics({ ...context, marble: cornerMarble }, 1, feedback);

  assert.equal(centeredMarble.vx, 75);
  assert.equal(cornerMarble.vx, 150);
}

function testGooPatchAddsStickyDragAndFeedback() {
  const marble = { x: 50, y: 50, vx: 10, vy: 0, r: 10 };
  const surfaces = [];
  const surfaceFeedback = [];

  updateTestPhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      gooPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      roughPatches: [],
      waterPatches: [],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        gooPatchDragRetention: 0.6,
        roughPatchDragRetention: 0.8,
        waterPatchDragRetention: 0.9,
        bounce: 0.5,
        maxSpeed: 100,
        maxStepDistance: 100,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: (speed, surfaceType) => {
        surfaceFeedback.push([speed, surfaceType]);
      },
      onTerrain: (surfaceType) => surfaces.push(surfaceType),
    },
  );

  assert.equal(marble.vx, 6);
  assert.deepEqual(surfaces, [SURFACE_TYPES.gooPatch]);
  assert.deepEqual(surfaceFeedback, [[6, SURFACE_TYPES.gooPatch]]);
}

function testGooPatchIgnoresTransparentCorner() {
  const marble = { x: 45, y: 45, vx: 1, vy: 0, r: 5 };
  const surfaces = [];

  updateTestPhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      gooPatches: [{ x: 40, y: 40, w: 100, h: 100 }],
      roughPatches: [],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        gooPatchDragRetention: 0.5,
        roughPatchDragRetention: 1,
        bounce: 0,
        maxSpeed: 100,
        maxStepDistance: 100,
      },
    },
    1,
    {
      onImpact: () => {},
      onSurface: () => {},
      onTerrain: (surfaceType) => surfaces.push(surfaceType),
    },
  );

  assert.equal(marble.vx, 1);
  assert.deepEqual(surfaces, [SURFACE_TYPES.floor]);
}

function testTerrainFeedbackReportsSurfaceTypes() {
  const marble = { x: 50, y: 50, vx: 4, vy: 0, r: 10 };
  const surfaces = [];

  updateTestPhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      keyboard: { x: 0, y: 0 },
      obstacles: [],
      roughPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      icePatches: [{ x: 120, y: 40, w: 40, h: 40 }],
      waterPatches: [],
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

function testOverlappingTerrainUsesExplicitSurfacePriority() {
  const marble = { x: 50, y: 50, vx: 4, vy: 0, r: 10 };
  const surfaces = [];

  updateTestPhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      keyboard: { x: 0, y: 0 },
      obstacles: [],
      gooPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      roughPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      waterPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      physics: {
        accel: 0,
        baseDragRetention: 1,
        gooPatchDragRetention: 1,
        roughPatchDragRetention: 1,
        waterPatchDragRetention: 1,
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

  assert.deepEqual(surfaces, [SURFACE_TYPES.gooPatch]);
}

function testHazardPatchReportsResetFeedback() {
  const marble = { x: 50, y: 50, vx: 0, vy: 0, r: 10 };
  let hazards = 0;

  updateTestPhysics(
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

function testHazardResetStopsRemainingMovementAndSurfaceFeedback() {
  const marble = { x: 50, y: 50, vx: 40, vy: 0, r: 10 };
  const calls = [];

  const reset = updateTestPhysics(
    {
      marble,
      bounds: { left: 0, right: 400, top: 0, bottom: 400 },
      intro: { released: true },
      tilt: { smoothX: 10, smoothY: -5 },
      obstacles: [],
      hazardPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      roughPatches: [{ x: 40, y: 40, w: 40, h: 40 }],
      physics: {
        accel: 0.5,
        baseDragRetention: 0.94,
        roughPatchDragRetention: 0.86,
        bounce: 0.5,
        maxSpeed: 100,
        maxStepDistance: 5,
      },
    },
    2,
    {
      onHazard: () => {
        calls.push("reset");
        Object.assign(marble, { x: 300, y: 300, vx: 0, vy: 0 });
        return true;
      },
      onImpact: () => calls.push("impact"),
      onSurface: () => calls.push("surface"),
      onTerrain: () => calls.push("terrain"),
    },
  );

  assert.equal(reset, true);
  assert.deepEqual(
    marble,
    { x: 300, y: 300, vx: 0, vy: 0, r: 10 },
    "held tilt must not move the marble again during its reset frame",
  );
  assert.deepEqual(
    calls,
    ["reset"],
    "terrain from the failed move must not overwrite hazard feedback",
  );
}

function testRoughPatchDragAppliesWhenEnteringPatch() {
  const marble = { x: 20, y: 50, vx: 10, vy: 0, r: 10 };

  updateTestPhysics(
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

function testTerrainSweepPreventsThinPatchTunneling() {
  const marble = { x: 20, y: 50, vx: 80, vy: 0, r: 10 };

  updateTestPhysics(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      obstacles: [],
      roughPatches: [{ x: 90, y: 40, w: 4, h: 20 }],
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

  assert.equal(marble.vx, 40);
}

function testLowSpeedDriftSettles() {
  const marble = { x: 50, y: 50, vx: 0.02, vy: 0.01, r: 10 };

  updateTestPhysics(
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

  updateTestPhysics(
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

  updateTestPhysics(
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

function roughMotionContext({ marble = {}, tilt = {}, physics = {} } = {}) {
  return {
    marble: { x: 0, y: 0, vx: 0, vy: 0, r: 10, ...marble },
    bounds: { left: -1e6, right: 1e6, top: -1e6, bottom: 1e6 },
    intro: { released: true },
    tilt: {
      rawX: 0,
      rawY: 0,
      neutralX: 0,
      neutralY: 0,
      smoothX: 0,
      smoothY: 0,
      ...tilt,
    },
    keyboard: { x: 0, y: 0 },
    roughPatches: [{ x: -5e5, y: -5e5, w: 1e6, h: 1e6 }],
    physics: { ...physicsConfig, ...physics },
  };
}

function testRoughTerrainDistanceWithSmoothedInputAcrossFrameRates() {
  function simulate(fps) {
    const context = roughMotionContext({ tilt: { rawX: 5 } });
    const dt = 60 / fps;
    for (let frame = 0; frame < fps * 2; frame++) {
      updatePhysicsInput(context, dt);
      updateTestPhysics(context, dt, {
        onImpact() {},
        onSurface() {},
      });
    }
    return context.marble;
  }

  const reference = simulate(60);
  // Preserve the original two-second 60 Hz trajectory recorded in the
  // improvement pass, including input smoothing and post-move rough drag.
  assertNear(reference.x, 208.81733322993196);
  assertNear(reference.vx, 1.6065631780143774);
  for (const fps of [30, 120]) {
    const marble = simulate(fps);
    assert.ok(
      Math.abs(marble.x - reference.x) < reference.x * 0.01,
      `${fps} Hz rough distance ${marble.x} differs from 60 Hz ${reference.x}`,
    );
    assert.ok(
      Math.abs(marble.vx - reference.vx) < reference.vx * 0.01,
      `${fps} Hz rough speed ${marble.vx} differs from 60 Hz ${reference.vx}`,
    );
    assertNear(marble.y, 0);
    assertNear(marble.vy, 0);
  }
}

function testRoughMotionMatchesReferenceFramesAcrossPartitions() {
  const inputPhases = [
    { smoothX: 5, smoothY: -3 },
    { smoothX: 0, smoothY: 0 },
    { smoothX: -5, smoothY: 3 },
  ];
  const feedback = { onImpact() {}, onSurface() {} };

  for (const maxStepDistance of [physicsConfig.maxStepDistance, 0.4]) {
    for (const frameDeltas of [[2], [1], [0.5], [0.25, 0.75, 1.5, 0.5]]) {
      const context = roughMotionContext({
        marble: { vx: 12, vy: -4 },
        // Keep tiny coasting momentum observable instead of snapping to rest.
        physics: { maxStepDistance, settleSpeed: 0 },
      });
      const reference = { ...context.marble };
      for (const tilt of inputPhases) {
        Object.assign(context.tilt, tilt);
        // The historical whole-frame recurrence is an independent reference:
        // acceleration, floor drag, movement, then rough drag.
        for (let frame = 0; frame < 24; frame++) {
          reference.vx += tilt.smoothX * physicsConfig.accel;
          reference.vy += tilt.smoothY * physicsConfig.accel;
          reference.vx *= physicsConfig.baseDragRetention;
          reference.vy *= physicsConfig.baseDragRetention;
          reference.x += reference.vx;
          reference.y += reference.vy;
          reference.vx *= physicsConfig.roughPatchDragRetention;
          reference.vy *= physicsConfig.roughPatchDragRetention;
        }
        let elapsed = 0;
        let frame = 0;
        while (elapsed < 24) {
          const dt = Math.min(
            frameDeltas[frame % frameDeltas.length],
            24 - elapsed,
          );
          updateTestPhysics(context, dt, feedback);
          elapsed += dt;
          frame++;
        }
        for (const field of ["x", "y", "vx", "vy"]) {
          assertNear(context.marble[field], reference[field], 1e-8);
        }
      }
      assert.ok(
        context.marble.vx < 0,
        "opposite tilt must reverse horizontal momentum",
      );
      assert.ok(
        context.marble.vy > 0,
        "opposite tilt must reverse vertical momentum",
      );
    }
  }
}

function testTerrainSweepUsesCorrectedMovement() {
  for (const { dt, radius, hazardX, expectedHazards } of [
    { dt: 2, radius: 0.1, hazardX: 37.4, expectedHazards: 0 },
    { dt: 0.5, radius: 0.01, hazardX: 24.95, expectedHazards: 1 },
  ]) {
    const context = roughMotionContext({
      marble: { x: 20, y: 50, vx: 10, r: radius },
      physics: { accel: 0, maxStepDistance: 100 },
    });
    context.hazardPatches = [{ x: hazardX, y: 49, w: 0.01, h: 2 }];
    let hazards = 0;
    updateTestPhysics(context, dt, {
      onImpact() {},
      onSurface() {},
      onHazard() {
        hazards++;
      },
    });
    assert.equal(
      hazards,
      expectedHazards,
      `dt=${dt} must sweep the actual corrected path against the hazard`,
    );
  }
}

function testMotionWithAlmostNoDragRemainsAccurate() {
  for (const [baseDragRetention, roughPatchDragRetention] of [
    [1 - 1e-8, 1],
    [0.99999, 0.9999999],
  ]) {
    for (const dt of [2, 0.5, 0.25]) {
      const context = roughMotionContext({
        marble: { vx: 1, vy: 2 },
        tilt: { smoothX: 0.5, smoothY: -0.25 },
        physics: {
          baseDragRetention,
          roughPatchDragRetention,
          maxStepDistance: 100,
        },
      });
      const reference = { ...context.marble };
      for (let frame = 0; frame < 24; frame++) {
        reference.vx += context.tilt.smoothX * physicsConfig.accel;
        reference.vy += context.tilt.smoothY * physicsConfig.accel;
        reference.vx *= context.physics.baseDragRetention;
        reference.vy *= context.physics.baseDragRetention;
        reference.x += reference.vx;
        reference.y += reference.vy;
        reference.vx *= roughPatchDragRetention;
        reference.vy *= roughPatchDragRetention;
      }
      for (let elapsed = 0; elapsed < 24; elapsed += dt) {
        updateTestPhysics(context, dt, { onImpact() {}, onSurface() {} });
      }
      for (const field of ["x", "y", "vx", "vy"]) {
        assertNear(context.marble[field], reference[field], 1e-7);
      }
    }
  }
}

function testFractionalSettlingStopsPositionAndVelocity() {
  const context = roughMotionContext({
    marble: { x: 50, y: 50, vx: 0.02, vy: 0.01 },
    tilt: { smoothX: 0.1, smoothY: 0.1 },
    physics: { accel: 0 },
  });
  updateTestPhysics(context, 0.5, { onImpact() {}, onSurface() {} });
  assert.deepEqual(context.marble, {
    x: 50,
    y: 50,
    vx: 0,
    vy: 0,
    r: 10,
  });
}

function testFractionalHardCapConstrainsDisplacement() {
  for (const maxSpeed of [0, 5]) {
    const context = roughMotionContext({
      marble: { x: 50, y: 50, vx: 12, vy: -8 },
      physics: {
        accel: 0,
        roughPatchDragRetention: 1,
        maxStepDistance: 100,
        maxSpeed,
        overspeedRetention: 0,
      },
    });
    updateTestPhysics(context, 0.5, { onImpact() {}, onSurface() {} });
    const { x, y, vx, vy } = context.marble;
    assertNear(Math.hypot(vx, vy), maxSpeed);
    if (maxSpeed === 0) {
      assert.equal(x, 50);
      assert.equal(y, 50);
    } else {
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      assert.ok(x > 50 && y < 50, "capped travel must remain forward");
      assertNear(Math.hypot(x - 50, y - 50), maxSpeed * 0.5);
    }
  }
}

function testSpeedCapUsesCappedVelocityForTravel() {
  for (const overspeedRetention of [0, physicsConfig.overspeedRetention]) {
    for (const { dt, marble, tilt, maxStepDistance } of [
      {
        dt: 0.5,
        marble: { vx: 14 },
        tilt: { smoothX: 18 },
        maxStepDistance: physicsConfig.maxStepDistance,
      },
      {
        dt: 2,
        marble: { vx: 16, vy: -12 },
        tilt: {},
        maxStepDistance: 100,
      },
    ]) {
      const context = roughMotionContext({
        marble,
        tilt,
        physics: { overspeedRetention, maxStepDistance },
      });
      context.roughPatches = [];
      const uncapped = JSON.parse(JSON.stringify(context));
      uncapped.physics.maxSpeed = Infinity;
      updateTestPhysics(uncapped, dt, { onImpact() {}, onSurface() {} });
      const uncappedSpeed = Math.hypot(uncapped.marble.vx, uncapped.marble.vy);
      assert.ok(uncappedSpeed > context.physics.maxSpeed);
      const expectedSpeed =
        context.physics.maxSpeed +
        (uncappedSpeed - context.physics.maxSpeed) *
          Math.pow(overspeedRetention, dt);

      updateTestPhysics(context, dt, { onImpact() {}, onSurface() {} });

      assertNear(
        Math.hypot(context.marble.vx, context.marble.vy),
        expectedSpeed,
      );
      for (const [position, velocity] of [
        ["x", "vx"],
        ["y", "vy"],
      ]) {
        const expectedVelocity =
          (uncapped.marble[velocity] * expectedSpeed) / uncappedSpeed;
        assertNear(context.marble[velocity], expectedVelocity);
        assertNear(context.marble[position], expectedVelocity * dt);
      }
      if (overspeedRetention === 0 && dt === 0.5) {
        assert.equal(context.marble.vx, 14);
        assert.equal(context.marble.x, 7);
      }
    }
  }
}

function testStoppingTerrainRetentionKeepsMovementFinite() {
  for (const roughPatchDragRetention of [0, 1e-309]) {
    const context = roughMotionContext({
      marble: { x: 50, y: 50, vx: 10, vy: -3 },
      physics: { accel: 0, roughPatchDragRetention, maxStepDistance: 100 },
    });
    updateTestPhysics(context, 2, { onImpact() {}, onSurface() {} });
    // Instantaneous terrain stopping keeps the historical move-then-stop path;
    // extremely small retentions must not overflow the acceleration factor.
    const displacementFactor = Math.pow(physicsConfig.baseDragRetention, 2) * 2;
    assertNear(context.marble.x, 50 + 10 * displacementFactor);
    assertNear(context.marble.y, 50 - 3 * displacementFactor);
    assert.equal(context.marble.vx, 0);
    assertNear(context.marble.vy, 0);
  }
}

function testExtremeIntegrationFallsBackToFiniteReferenceStep() {
  for (const { dt, roughPatchDragRetention, overRough } of [
    { dt: 2, roughPatchDragRetention: 1e-308, overRough: true },
    {
      dt: 11410,
      roughPatchDragRetention: physicsConfig.roughPatchDragRetention,
      overRough: false,
    },
  ]) {
    const context = roughMotionContext({
      tilt: { smoothX: 26, smoothY: -13 },
      physics: { roughPatchDragRetention },
    });
    if (!overRough) context.roughPatches = [];
    // Starting at rest guarantees one substep even for the large frame delta.
    assert.equal(physicsSubstepCount(0, dt, context.physics), 1);
    const reference = { ...context.marble };
    reference.vx += context.tilt.smoothX * context.physics.accel * dt;
    reference.vy += context.tilt.smoothY * context.physics.accel * dt;
    reference.vx *= Math.pow(context.physics.baseDragRetention, dt);
    reference.vy *= Math.pow(context.physics.baseDragRetention, dt);
    assert.ok(
      Math.hypot(reference.vx, reference.vy) < context.physics.maxSpeed,
    );
    reference.x += reference.vx * dt;
    reference.y += reference.vy * dt;
    if (overRough) {
      reference.vx *= Math.pow(roughPatchDragRetention, dt);
      reference.vy *= Math.pow(roughPatchDragRetention, dt);
    }

    updateTestPhysics(context, dt, { onImpact() {}, onSurface() {} });

    for (const field of ["x", "y", "vx", "vy"]) {
      assert.ok(Number.isFinite(context.marble[field]), `${field}, dt=${dt}`);
      // Relative tolerances keep the very small large-delta result observable.
      assertNear(
        context.marble[field],
        reference[field],
        Math.abs(reference[field]) * 1e-12,
      );
    }
  }
}

function testHugeCoastingStepDoesNotMultiplyInfiniteForceSumByZero() {
  const dt = 1e160;
  const context = roughMotionContext({
    marble: { vx: 1, vy: -0.5 },
    physics: { baseDragRetention: 1, roughPatchDragRetention: 1 },
  });
  context.roughPatches = [];
  context.bounds = { left: -1e170, right: 1e170, top: -1e170, bottom: 1e170 };

  updateTestPhysics(context, dt, { onImpact() {}, onSurface() {} });

  for (const field of ["x", "y", "vx", "vy"]) {
    assert.ok(Number.isFinite(context.marble[field]), field);
  }
  assert.equal(context.marble.vx, 1);
  assert.equal(context.marble.vy, -0.5);
  assertNear(context.marble.x, dt, dt * 1e-12);
  assertNear(context.marble.y, -0.5 * dt, dt * 1e-12);
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

  updateTestPhysics(once, 1, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updateTestPhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updateTestPhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });

  assertNear(split.marble.vx, once.marble.vx);
  assertNear(split.marble.x, once.marble.x);
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

  updateTestPhysics(once, 1, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updateTestPhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updateTestPhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });

  assertNear(split.marble.vx, once.marble.vx);
  assertNear(split.marble.vy, once.marble.vy);
  assertNear(split.marble.x, once.marble.x);
  assertNear(split.marble.y, once.marble.y);
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

  updateTestPhysics(once, 1, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updateTestPhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updateTestPhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });

  assertNear(split.marble.vx, once.marble.vx);
  assertNear(split.marble.x, once.marble.x);
}

function testOverspeedRetentionEasesDown() {
  const marble = { x: 50, y: 50, vx: 20, vy: 0, r: 10 };

  updateTestPhysics(
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
        overspeedRetention: 0.5,
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

function testOverspeedClampIsFrameRateIndependent() {
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
        overspeedRetention: 0,
        maxStepDistance: 100,
        settleSpeed: 0,
        settleTilt: 0,
      },
    };
  }
  const once = context();
  const split = context();

  updateTestPhysics(once, 1, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updateTestPhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });
  updateTestPhysics(split, 0.5, {
    onImpact: () => {},
    onSurface: () => {},
  });

  assert.equal(once.marble.vx, 10);
  assertNear(split.marble.vx, once.marble.vx);
}

function testWallCollisionAppliesTangentialDrag() {
  const marble = { x: 5, y: 50, vx: -4, vy: 10, r: 10 };

  updateTestPhysics(
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
        overspeedRetention: 0,
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

function testFractionalWorldBoundsRespectEndpointVelocity() {
  for (const [position, tangent, velocity, tangentVelocity, smoothTilt] of [
    ["x", "y", "vx", "vy", "smoothX"],
    ["y", "x", "vy", "vx", "smoothY"],
  ]) {
    for (const inwardDirection of [1, -1]) {
      const edge = inwardDirection === 1 ? 10 : 190;
      for (const incoming of [false, true]) {
        const context = roughMotionContext({
          marble: {
            [position]: edge,
            [tangent]: 50,
            [velocity]: (incoming ? -1.2 : 1.2) * inwardDirection,
            [tangentVelocity]: 0.7,
          },
          tilt: { [smoothTilt]: incoming ? 0 : -18 * inwardDirection },
        });
        context.roughPatches = [];
        const unconstrained = JSON.parse(JSON.stringify(context));
        updateTestPhysics(unconstrained, 0.5, {
          onImpact() {},
          onSurface() {},
        });
        assert.ok(
          (unconstrained.marble[position] - edge) * inwardDirection < 0,
          "the fractional path must penetrate the tested boundary",
        );
        assert.ok(
          unconstrained.marble[velocity] *
            inwardDirection *
            (incoming ? -1 : 1) >
            0,
          "the unconstrained endpoint must have the tested velocity direction",
        );
        context.bounds = { left: 0, right: 200, top: 0, bottom: 200 };
        const impacts = [];

        updateTestPhysics(context, 0.5, {
          onImpact: (impact) => impacts.push(impact),
          onSurface() {},
        });

        assert.equal(context.marble[position], edge);
        assertNear(context.marble[tangent], unconstrained.marble[tangent]);
        assertNear(
          context.marble[velocity],
          unconstrained.marble[velocity] *
            (incoming ? -context.physics.bounce : 1),
        );
        assertNear(
          context.marble[tangentVelocity],
          unconstrained.marble[tangentVelocity] *
            (incoming ? context.physics.wallTangentialDragRetention : 1),
        );
        if (incoming) {
          assert.equal(impacts.length, 1);
          assertNear(
            impacts[0],
            Math.abs(unconstrained.marble[velocity]) +
              Math.abs(unconstrained.marble[tangentVelocity]) *
                context.physics.scrapeHapticScale,
          );
        } else {
          assert.deepEqual(impacts, []);
        }
      }
    }
  }
}

function testCornerWallCollisionResolvesBothAxes() {
  const marble = { x: 5, y: 5, vx: -4, vy: -6, r: 10 };

  handleWallCollisions(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: false },
      obstacles: [],
      physics: {
        bounce: 0.5,
        wallTangentialDragRetention: 1,
      },
    },
    () => {},
  );

  assert.equal(marble.x, 10);
  assert.equal(marble.y, 10);
  assert.equal(marble.vx, 2);
  assert.equal(marble.vy, 3);
}

function testWallCollisionsIgnoreObstaclesBeforeIntroRelease() {
  const marble = { x: 90, y: 50, vx: 8, vy: 0, r: 12 };

  handleWallCollisions(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: false },
      obstacles: [{ x: 100, y: 30, w: 40, h: 40 }],
      physics: {
        bounce: 0.5,
        collisionResolvePasses: 1,
      },
    },
    () => {},
  );

  assert.equal(marble.x, 90);
  assert.equal(marble.vx, 8);
}

function testStaticWallResolutionSkipsRuntimeDynamicObstacles() {
  const marble = { x: 90, y: 50, vx: 8, vy: 0, r: 12 };
  let impacts = 0;

  handleWallCollisions(
    {
      marble,
      bounds: { left: 0, right: 200, top: 0, bottom: 200 },
      intro: { released: true },
      obstacles: [
        {
          x: 100,
          y: 30,
          w: 40,
          h: 40,
          staticCollision: false,
        },
      ],
      physics: {
        bounce: 0.5,
        collisionResolvePasses: 1,
      },
    },
    () => impacts++,
  );

  assert.equal(marble.x, 90);
  assert.equal(marble.vx, 8);
  assert.equal(impacts, 0);
}

function testWorldBoundCollisionBeforeAdjacentObstacle() {
  const marble = { x: 5, y: 50, vx: 0, vy: 0, r: 10 };

  updateTestPhysics(
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

  updateTestPhysics(
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
        overspeedRetention: 0,
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

function testPhysicsSubstepCountUsesIncomingSpeed() {
  assert.equal(
    physicsSubstepCount(0, 1, {
      maxStepDistance: 5,
      maxPhysicsSubsteps: 20,
    }),
    1,
  );
  assert.equal(
    physicsSubstepCount(40, 1, {
      maxStepDistance: 5,
      maxPhysicsSubsteps: 20,
    }),
    8,
  );
  assert.equal(
    physicsSubstepCount(1000, 1, {
      maxStepDistance: 1,
      maxPhysicsSubsteps: 10,
    }),
    10,
  );
}

function testPhysicsSubstepCountFallsBackFromInvalidTuning() {
  assert.equal(
    physicsSubstepCount(12, 1, {
      maxStepDistance: 0,
      maxPhysicsSubsteps: Number.NaN,
    }),
    12,
  );
}

function testInvalidPhysicsStepInputsDoNotPoisonState() {
  const marble = { x: 50, y: 50, vx: 10, vy: 0, r: 10 };

  updateTestPhysics(
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
  updateTestPhysics(
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

  updateTestPhysics(
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
        overspeedRetention: 0,
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
testCircleOrientedRectContactUsesRotatedNormal();
testCircleOrientedRectContactUsesCachedCollisionFields();
testMarbleOverRectHonorsEpsilon();
testObstacleBounce();
testObstacleCollisionDoesNotBounceWhenMovingAway();
testAxisAlignedCollisionIgnoresReusedOrientedInsideNormal();
testObstacleCollisionHonorsBounceExtremes();
testCollisionPositionSlopCanLeaveSmallOverlap();
testObstacleCornerBounceUsesDiagonalNormal();
testOrientedObstacleCollisionResolvesAlongRotatedNormal();
testGlancingImpactReportsScrapeFeedback();
testDeepOverlapPushesToNearestEdge();
testDeepOverlapTieBreaksTowardFirstNearestEdge();
testNearZeroOrientedContactCanUseInsideNormal();
testRoughPatchAddsDrag();
testRoughPatchDragChecksAllPatches();
testIcePatchReducesDrag();
testIcePatchUsesPreMoveSurfaceTiming();
testGooPatchAddsStickyDragAndFeedback();
testGooPatchIgnoresTransparentCorner();
testWaterPatchAddsModerateDragAndFeedback();
testWaterPatchIgnoresTransparentCorner();
testWaterPatchSweepMatchesVisibleShape();
testTerrainFeedbackReportsSurfaceTypes();
testOverlappingTerrainUsesExplicitSurfacePriority();
testHazardPatchReportsResetFeedback();
testHazardResetStopsRemainingMovementAndSurfaceFeedback();
testRoughPatchDragAppliesWhenEnteringPatch();
testTerrainSweepPreventsThinPatchTunneling();
testLowSpeedDriftSettles();
testLowSpeedDriftDoesNotSettleAboveSpeedThreshold();
testLowSpeedDriftDoesNotSettleAboveTiltThreshold();
testTiltCurveSoftensSmallSensorInput();
testTiltSmoothingIsFrameRateIndependent();
testRoughTerrainDistanceWithSmoothedInputAcrossFrameRates();
testRoughMotionMatchesReferenceFramesAcrossPartitions();
testTerrainSweepUsesCorrectedMovement();
testMotionWithAlmostNoDragRemainsAccurate();
testFractionalSettlingStopsPositionAndVelocity();
testFractionalHardCapConstrainsDisplacement();
testSpeedCapUsesCappedVelocityForTravel();
testStoppingTerrainRetentionKeepsMovementFinite();
testExtremeIntegrationFallsBackToFiniteReferenceStep();
testHugeCoastingStepDoesNotMultiplyInfiniteForceSumByZero();
testVelocityDragIsFrameRateIndependent();
testAccelerationIsFrameRateIndependent();
testRoughPatchDragIsFrameRateIndependent();
testOverspeedRetentionEasesDown();
testOverspeedClampIsFrameRateIndependent();
testWallCollisionAppliesTangentialDrag();
testFractionalWorldBoundsRespectEndpointVelocity();
testCornerWallCollisionResolvesBothAxes();
testWallCollisionsIgnoreObstaclesBeforeIntroRelease();
testStaticWallResolutionSkipsRuntimeDynamicObstacles();
testWorldBoundCollisionBeforeAdjacentObstacle();
testMultipleCollisionPassesResolveChainedOverlaps();
testPhysicsSubstepsAreCapped();
testPhysicsSubstepCountUsesIncomingSpeed();
testPhysicsSubstepCountFallsBackFromInvalidTuning();
testInvalidPhysicsStepInputsDoNotPoisonState();
testSubstepsPreventThinObstacleTunneling();

console.log("Physics tests passed.");

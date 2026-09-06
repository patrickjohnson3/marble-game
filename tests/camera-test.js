import assert from "node:assert/strict";
import { createCameraController } from "../input/camera-controller.js";

function createController({
  marble = { x: 100, y: 100, vx: 5, vy: -2 },
  viewport = { width: () => 300, height: () => 300 },
  world = { width: 1000, height: 1000 },
  intro = { released: true },
} = {}) {
  const camera = {
    x: 0,
    y: 0,
    scale: 1,
    followLag: 0.5,
    gestureCooldown: 0,
    minScale: 0.35,
    maxScale: 3,
  };
  const cameraEl = { style: {} };
  const mapState = { activeMap: { world } };
  const controller = createCameraController({
    camera,
    cameraEl,
    game: { paused: false },
    intro,
    marble,
    tuning: { gestureCooldownFrames: 10 },
    viewport,
    mapState,
  });

  return { camera, controller, mapState };
}

function testFollowPreservesSmoothFollow() {
  const { camera, controller } = createController({
    marble: { x: 300, y: 300, vx: 5, vy: -2 },
  });

  controller.updateFollow(1);

  assert.equal(camera.x, -75);
  assert.equal(camera.y, -75);
}

function testFollowWaitsForGestureCooldown() {
  const { camera, controller } = createController();
  camera.x = -300;
  camera.y = -300;
  camera.gestureCooldown = 10;

  controller.updateFollow(1);

  assert.equal(camera.x, -300);
  assert.equal(camera.y, -300);
  assert.equal(camera.gestureCooldown, 9);
}

function testGesturePansCameraAndStartsCooldown() {
  const { camera, controller } = createController();
  camera.x = -100;
  camera.y = -100;

  controller.onPointerDown({ pointerId: 1, clientX: 100, clientY: 100 });
  controller.onPointerDown({ pointerId: 2, clientX: 200, clientY: 100 });
  controller.onPointerMove({ pointerId: 1, clientX: 120, clientY: 130 });
  controller.onPointerMove({ pointerId: 2, clientX: 220, clientY: 130 });

  assert.equal(camera.x, -80);
  assert.equal(camera.y, -70);
  assert.equal(camera.scale, 1);

  controller.onPointerEnd({ pointerId: 1 });
  assert.equal(camera.gestureCooldown, 10);
}

function testPinchKeepsMapPointAtMovingMidpoint() {
  for (const [endDistance, expectedScale] of [
    [50, 0.5],
    [200, 2],
    [10, 0.35],
    [600, 3],
  ]) {
    const { camera, controller } = createController({
      world: { width: 4400, height: 4400 },
    });
    camera.x = -1500;
    camera.y = -2200;
    const worldPoint = { x: 1650, y: 2350 };

    controller.onPointerDown({ pointerId: 1, clientX: 100, clientY: 150 });
    controller.onPointerDown({ pointerId: 2, clientX: 200, clientY: 150 });
    controller.onPointerMove({
      pointerId: 1,
      clientX: 170 - endDistance / 2,
      clientY: 180,
    });
    controller.onPointerMove({
      pointerId: 2,
      clientX: 170 + endDistance / 2,
      clientY: 180,
    });

    assert.equal(camera.scale, expectedScale);
    assert.ok(Math.abs(camera.x + worldPoint.x * camera.scale - 170) < 1e-9);
    assert.ok(Math.abs(camera.y + worldPoint.y * camera.scale - 180) < 1e-9);
  }
}

function testStationaryGesturePausesFollowUntilReleaseCooldownExpires() {
  const { camera, controller } = createController();
  camera.x = -300;
  camera.y = -300;
  controller.onPointerDown({ pointerId: 1, clientX: 100, clientY: 100 });
  controller.onPointerDown({ pointerId: 2, clientX: 200, clientY: 100 });

  for (let frame = 0; frame < 30; frame++) controller.updateFollow(1);
  assert.equal(camera.x, -300);
  assert.equal(camera.y, -300);

  controller.onPointerEnd({ pointerId: 2 });
  for (let frame = 0; frame < 9; frame++) controller.updateFollow(1);
  assert.equal(camera.x, -300);
  assert.equal(camera.y, -300);
  controller.updateFollow(1);
  assert.ok(camera.x > -300);
  assert.ok(camera.y > -300);
}

function testPointerReplacementAndCancellationRebaseGesture() {
  const { camera, controller } = createController();
  camera.x = -400;
  camera.y = -400;
  controller.onPointerDown({ pointerId: 1, clientX: 100, clientY: 100 });
  controller.onPointerDown({ pointerId: 2, clientX: 200, clientY: 100 });
  controller.onPointerDown({ pointerId: 3, clientX: 300, clientY: 100 });
  controller.onPointerEnd({ pointerId: 1 });
  controller.onPointerMove({ pointerId: 3, clientX: 340, clientY: 100 });

  assert.equal(camera.scale, 1.4);
  assert.equal(camera.x + 650 * camera.scale, 270);
  assert.equal(camera.y + 500 * camera.scale, 100);

  const position = { x: camera.x, y: camera.y };
  controller.onPointerEnd({ pointerId: 99 });
  controller.updateFollow(30);
  assert.equal(camera.x, position.x);
  assert.equal(camera.y, position.y);

  controller.resetGesture();
  controller.onPointerMove({ pointerId: 3, clientX: 360, clientY: 100 });
  assert.equal(camera.x, position.x, "cancelled pointers must stay cleared");
  controller.updateFollow(1);
  assert.ok(camera.x > position.x, "reset must release camera following");
}

function testIntroPinchKeepsMarbleCenteredThenAllowsMapExploration() {
  const intro = { released: false };
  const { camera, controller } = createController({
    intro,
    marble: { x: 500, y: 500 },
  });
  controller.centerOnMarble();
  controller.onPointerDown({ pointerId: 1, clientX: 100, clientY: 100 });
  controller.onPointerDown({ pointerId: 2, clientX: 200, clientY: 100 });
  controller.onPointerMove({ pointerId: 2, clientX: 300, clientY: 100 });

  assert.equal(camera.scale, 2);
  assert.equal(camera.x + 500 * camera.scale, 150);
  assert.equal(camera.y + 500 * camera.scale, 150);

  intro.released = true;
  controller.onPointerMove({ pointerId: 2, clientX: 300, clientY: 100 });
  assert.equal(
    camera.x + 500 * camera.scale,
    150,
    "opening the map during a pinch must not jump the camera",
  );
  assert.equal(camera.y + 500 * camera.scale, 150);

  controller.onPointerEnd({ pointerId: 1 });
  controller.onPointerEnd({ pointerId: 2 });
  controller.onPointerDown({ pointerId: 1, clientX: 100, clientY: 100 });
  controller.onPointerDown({ pointerId: 2, clientX: 200, clientY: 100 });
  controller.onPointerMove({ pointerId: 1, clientX: 120, clientY: 100 });
  controller.onPointerMove({ pointerId: 2, clientX: 220, clientY: 100 });

  assert.equal(camera.x + 500 * camera.scale, 170);
  assert.equal(camera.y + 500 * camera.scale, 150);
}

function testCenterClampsToWorldEdges() {
  const { camera, controller } = createController({
    marble: { x: 20, y: 20, vx: 0, vy: 0 },
    world: { width: 1000, height: 1000 },
  });

  controller.centerOnMarble();

  assert.equal(camera.x, 0);
  assert.equal(camera.y, 0);
}

function testFollowClampsToFarWorldEdges() {
  const { camera, controller } = createController({
    marble: { x: 980, y: 980, vx: 0, vy: 0 },
    world: { width: 1000, height: 1000 },
  });

  controller.updateFollow(10);

  assert.equal(camera.x >= -700, true);
  assert.equal(camera.y >= -700, true);
}

function testSmallScaledWorldCentersInViewport() {
  const { camera, controller } = createController({
    marble: { x: 500, y: 500, vx: 0, vy: 0 },
    world: { width: 1000, height: 1000 },
  });
  camera.scale = 0.2;

  controller.centerOnMarble();

  assert.equal(camera.x, 50);
  assert.equal(camera.y, 50);
}

function testWorldSizeCanChange() {
  const { camera, controller, mapState } = createController({
    marble: { x: 980, y: 980, vx: 0, vy: 0 },
  });

  mapState.activeMap.world = { width: 2000, height: 1600 };
  controller.invalidateWorldBounds();
  controller.centerOnMarble();

  assert.equal(camera.x, -830);
  assert.equal(camera.y, -830);
}

testFollowPreservesSmoothFollow();
testFollowWaitsForGestureCooldown();
testGesturePansCameraAndStartsCooldown();
testPinchKeepsMapPointAtMovingMidpoint();
testStationaryGesturePausesFollowUntilReleaseCooldownExpires();
testPointerReplacementAndCancellationRebaseGesture();
testIntroPinchKeepsMarbleCenteredThenAllowsMapExploration();
testCenterClampsToWorldEdges();
testFollowClampsToFarWorldEdges();
testSmallScaledWorldCentersInViewport();
testWorldSizeCanChange();

console.log("Camera tests passed.");

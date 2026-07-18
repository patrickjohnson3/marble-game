import assert from "node:assert/strict";
import { createCameraController } from "../core/camera.js";
import { angle, clamp, distance, midpoint } from "../core/geometry.js";

function createController(mode) {
  const camera = {
    x: 0,
    y: 0,
    scale: 1,
    mode,
    followLag: 0.5,
    predictiveLookAheadFrames: 10,
    gestureCooldown: 0,
    minScale: 0.35,
    maxScale: 3
  };
  const marble = { x: 100, y: 100, vx: 5, vy: -2 };
  const cameraEl = { style: {} };
  const controller = createCameraController({
    camera,
    cameraEl,
    game: { paused: false },
    intro: { released: true },
    marble,
    tuning: { gestureCooldownFrames: 10 },
    clamp,
    distance,
    angle,
    midpoint,
    viewport: {
      width: () => 300,
      height: () => 300
    }
  });

  return { camera, controller };
}

function testFollowModePreservesSmoothFollow() {
  const { camera, controller } = createController("follow");

  controller.updateFollow(1);

  assert.equal(camera.x, 25);
  assert.equal(camera.y, 25);
}

function testLockedCenterSnapsToMarble() {
  const { camera, controller } = createController("lockedCenter");

  controller.updateFollow(1);

  assert.equal(camera.x, 50);
  assert.equal(camera.y, 50);
}

function testLockedCenterIgnoresGestureCooldown() {
  const { camera, controller } = createController("lockedCenter");
  camera.x = -300;
  camera.y = -300;
  camera.gestureCooldown = 10;

  controller.updateFollow(1);

  assert.equal(camera.x, 50);
  assert.equal(camera.y, 50);
}

function testLockedCenterGestureKeepsMarbleCentered() {
  const { camera, controller } = createController("lockedCenter");

  controller.onPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
  controller.onPointerDown({ pointerId: 2, clientX: 100, clientY: 0 });
  controller.onPointerMove({ pointerId: 1, clientX: 20, clientY: 0 });

  assert.equal(camera.x, 70);
  assert.equal(camera.y, 70);
  assert.equal(camera.gestureCooldown, 0);
}

function testApplyModeCentersLockedCameraImmediately() {
  const { camera, controller } = createController("follow");
  camera.x = -200;
  camera.y = -150;
  camera.gestureCooldown = 10;
  camera.mode = "lockedCenter";

  controller.applyMode();

  assert.equal(camera.x, 50);
  assert.equal(camera.y, 50);
  assert.equal(camera.gestureCooldown, 0);
}

function testPredictiveLookAheadTargetsVelocityOffset() {
  const { camera, controller } = createController("predictiveLookAhead");

  controller.updateFollow(1);

  assert.equal(camera.x, 0);
  assert.equal(camera.y, 35);
}

testFollowModePreservesSmoothFollow();
testLockedCenterSnapsToMarble();
testLockedCenterIgnoresGestureCooldown();
testLockedCenterGestureKeepsMarbleCentered();
testApplyModeCentersLockedCameraImmediately();
testPredictiveLookAheadTargetsVelocityOffset();

console.log("Camera tests passed.");

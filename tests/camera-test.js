import assert from "node:assert/strict";
import { createCameraController } from "../core/camera.js";
import { clamp, distance, midpoint } from "../core/geometry.js";

function createController() {
  const camera = {
    x: 0,
    y: 0,
    scale: 1,
    followLag: 0.5,
    gestureCooldown: 0,
    minScale: 0.35,
    maxScale: 3,
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
    midpoint,
    viewport: {
      width: () => 300,
      height: () => 300,
    },
  });

  return { camera, controller };
}

function testFollowPreservesSmoothFollow() {
  const { camera, controller } = createController();

  controller.updateFollow(1);

  assert.equal(camera.x, 25);
  assert.equal(camera.y, 25);
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

  controller.onPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
  controller.onPointerDown({ pointerId: 2, clientX: 100, clientY: 0 });
  controller.onPointerMove({ pointerId: 1, clientX: 20, clientY: 0 });

  assert.equal(camera.x, 10);
  assert.equal(camera.y, 0);
  assert.equal(camera.gestureCooldown, 10);
}

testFollowPreservesSmoothFollow();
testFollowWaitsForGestureCooldown();
testGesturePansCameraAndStartsCooldown();

console.log("Camera tests passed.");

import assert from "node:assert/strict";
import { createCameraController } from "../input/camera-controller.js";

function createController({
  marble = { x: 100, y: 100, vx: 5, vy: -2 },
  viewport = { width: () => 300, height: () => 300 },
  world = { width: 1000, height: 1000 },
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
  const controller = createCameraController({
    camera,
    cameraEl,
    game: { paused: false },
    intro: { released: true },
    marble,
    tuning: { gestureCooldownFrames: 10 },
    viewport,
    world,
  });

  return { camera, controller };
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

  controller.onPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
  controller.onPointerDown({ pointerId: 2, clientX: 100, clientY: 0 });
  controller.onPointerMove({ pointerId: 1, clientX: 20, clientY: 0 });

  assert.equal(camera.x, -90);
  assert.equal(camera.y, 0);
  assert.equal(camera.gestureCooldown, 10);
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
  const { camera, controller } = createController({
    marble: { x: 980, y: 980, vx: 0, vy: 0 },
  });

  controller.setWorld({ width: 2000, height: 1600 });
  controller.centerOnMarble();

  assert.equal(camera.x, -830);
  assert.equal(camera.y, -830);
}

testFollowPreservesSmoothFollow();
testFollowWaitsForGestureCooldown();
testGesturePansCameraAndStartsCooldown();
testCenterClampsToWorldEdges();
testFollowClampsToFarWorldEdges();
testSmallScaledWorldCentersInViewport();
testWorldSizeCanChange();

console.log("Camera tests passed.");

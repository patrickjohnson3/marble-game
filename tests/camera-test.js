import assert from "node:assert/strict";
import { createCameraController } from "../input/camera-controller.js";
import { resolvedMapConfig } from "../core/map-config.js";
import { tuning } from "../core/game-config.js";

function createController({
  marble = { x: 100, y: 100, vx: 5, vy: -2 },
  viewport = { width: () => 300, height: () => 300 },
  world = { width: 1000, height: 1000 },
  intro = { released: true },
  game = { paused: false },
  camera: cameraOverrides = {},
  tuning: cameraTuning = { gestureCooldownFrames: 10 },
} = {}) {
  marble = { r: 29, ...marble };
  const camera = {
    x: 0,
    y: 0,
    scale: 1,
    followLag: 0.5,
    gestureCooldown: 0,
    minScale: 0.35,
    maxScale: 3,
    ...cameraOverrides,
  };
  const cameraEl = { style: {} };
  const mapState = { activeMap: { world } };
  const controller = createCameraController({
    camera,
    cameraEl,
    game,
    intro,
    marble,
    tuning: cameraTuning,
    viewport,
    mapState,
  });

  return { camera, controller, mapState, marble, game };
}

function testFollowPreservesSmoothFollow() {
  const { camera, controller } = createController({
    marble: { x: 300, y: 300, vx: 5, vy: -2 },
  });

  controller.updateFollow(1);

  assert.equal(camera.x, -75);
  assert.equal(camera.y, -75);
}

function testFollowWaitsForGestureCooldownWhileMarbleIsVisible() {
  const { camera, controller } = createController({
    marble: { x: 400, y: 400 },
  });
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

function testStationaryGesturePausesFollowThenRestoresVisibility() {
  const { camera, controller, marble } = createController();
  camera.x = -300;
  camera.y = -300;
  controller.onPointerDown({ pointerId: 1, clientX: 100, clientY: 100 });
  controller.onPointerDown({ pointerId: 2, clientX: 200, clientY: 100 });

  for (let frame = 0; frame < 30; frame++) controller.updateFollow(1);
  assert.equal(camera.x, -300);
  assert.equal(camera.y, -300);

  controller.onPointerEnd({ pointerId: 2 });
  controller.updateFollow(1);
  assertMarbleVisible(camera, marble, 300, 300);
  assert.ok(
    camera.gestureCooldown > 0,
    "visibility does not cancel the pan cooldown",
  );
  const position = { x: camera.x, y: camera.y };
  for (let frame = 0; frame < 8; frame++) controller.updateFollow(1);
  assert.equal(camera.x, position.x);
  assert.equal(camera.y, position.y);
  controller.updateFollow(1);
  assert.ok(camera.x > position.x, "smooth centering resumes after cooldown");
  assert.ok(camera.y > position.y);
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

function assertMarbleVisible(camera, marble, width, height) {
  const x = camera.x + marble.x * camera.scale;
  const y = camera.y + marble.y * camera.scale;
  const radius = marble.r * camera.scale;
  assert.ok(
    x - radius >= -1e-7 &&
      x + radius <= width + 1e-7 &&
      y - radius >= -1e-7 &&
      y + radius <= height + 1e-7,
    `marble (${x}, ${y}) radius ${radius} must fit in ${width}x${height}`,
  );
}

function testMovingMarbleStaysVisibleAfterZoomAtEveryCadence() {
  for (const [width, height] of [
    [390, 844],
    [844, 390],
  ]) {
    for (const [startScale, endScale] of [
      [1, 2.5],
      [2.5, 1],
      [1, 0.12],
    ]) {
      for (const [vx, vy] of [
        [14, 0],
        [-14, 0],
        [0, 14],
        [0, -14],
      ]) {
        for (const dt of [0.5, 1, 2]) {
          const { camera, controller, marble } = createController({
            marble: { x: 2200, y: 2200, vx, vy },
            viewport: { width: () => width, height: () => height },
            world: { width: 4400, height: 4400 },
            camera: { ...resolvedMapConfig.camera, scale: startScale },
            tuning,
          });
          controller.centerOnMarble();
          controller.onPointerDown({
            pointerId: 1,
            clientX: width / 2 - 50,
            clientY: height / 2,
          });
          controller.onPointerDown({
            pointerId: 2,
            clientX: width / 2 + 50,
            clientY: height / 2,
          });
          const halfDistance = (50 * endScale) / startScale;
          controller.onPointerMove({
            pointerId: 1,
            clientX: width / 2 - halfDistance,
            clientY: height / 2,
          });
          controller.onPointerMove({
            pointerId: 2,
            clientX: width / 2 + halfDistance,
            clientY: height / 2,
          });
          controller.onPointerEnd({ pointerId: 1 });
          controller.onPointerEnd({ pointerId: 2 });
          assert.ok(Math.abs(camera.scale - endScale) < 1e-9);
          for (let frame = 0; frame < 140; frame += dt) {
            marble.x += vx * dt;
            marble.y += vy * dt;
            controller.updateFollow(dt);
            assertMarbleVisible(camera, marble, width, height);
            assert.ok(
              camera.x >= Math.min(0, width - 4400 * camera.scale) - 1e-7,
            );
            assert.ok(
              camera.y >= Math.min(0, height - 4400 * camera.scale) - 1e-7,
            );
          }
          assert.equal(
            camera.gestureCooldown,
            0,
            "coverage continues past cooldown into ordinary following",
          );
        }
      }
    }
  }
}

function testVisibilityAndWorldEdgesAgree() {
  for (const x of [29, 4400 - 29]) {
    for (const y of [29, 4400 - 29]) {
      const { camera, controller, marble } = createController({
        marble: { x, y },
        viewport: { width: () => 390, height: () => 844 },
        world: { width: 4400, height: 4400 },
        camera: {
          ...resolvedMapConfig.camera,
          scale: 2.5,
          gestureCooldown: 90,
          x: -4000,
          y: -4000,
        },
      });
      controller.updateFollow(1);
      assertMarbleVisible(camera, marble, 390, 844);
      assert.ok(camera.x <= 0 && camera.x >= 390 - 4400 * camera.scale);
      assert.ok(camera.y <= 0 && camera.y >= 844 - 4400 * camera.scale);
    }
  }
}

function testSinglePointerCameraActions() {
  const { camera, controller, marble, game } = createController({
    marble: { x: 500, y: 500 },
    world: { width: 4400, height: 4400 },
  });
  controller.centerOnMarble();
  const marbleBefore = { ...marble };
  controller.panBy(25, -30);
  assert.equal(camera.x + marble.x * camera.scale, 175);
  assert.equal(camera.y + marble.y * camera.scale, 120);
  const screenPoint = {
    x: camera.x + marble.x * camera.scale,
    y: camera.y + marble.y * camera.scale,
  };
  controller.zoomBy(1.5);
  assert.equal(camera.scale, 1.5);
  assert.equal(camera.x + marble.x * camera.scale, screenPoint.x);
  assert.equal(camera.y + marble.y * camera.scale, screenPoint.y);
  const position = { x: camera.x, y: camera.y };
  controller.updateFollow(1);
  assert.equal(
    camera.x,
    position.x,
    "button adjustments retain the follow delay",
  );
  assert.equal(camera.y, position.y);

  for (const factor of [100, 0.001]) {
    controller.zoomBy(factor);
    assert.equal(camera.scale, factor > 1 ? camera.maxScale : camera.minScale);
    assertMarbleVisible(camera, marble, 300, 300);
  }
  for (const [dx, dy] of [
    [10000, 0],
    [-10000, 0],
    [0, 10000],
    [0, -10000],
  ]) {
    controller.panBy(dx, dy);
    assertMarbleVisible(camera, marble, 300, 300);
    assert.ok(camera.x <= 0 && camera.x >= 300 - 4400 * camera.scale);
    assert.ok(camera.y <= 0 && camera.y >= 300 - 4400 * camera.scale);
  }
  controller.recenter();
  assert.equal(camera.x + marble.x * camera.scale, 150);
  assert.equal(camera.y + marble.y * camera.scale, 150);
  assert.equal(camera.gestureCooldown, 0);
  assert.deepEqual(
    marble,
    marbleBefore,
    "camera commands never move the marble",
  );

  game.paused = true;
  const pausedCamera = { ...camera };
  controller.panBy(30, 30);
  controller.zoomBy(2);
  controller.recenter();
  assert.deepEqual(camera, pausedCamera);
}

function testCameraButtonsReleaseGesturesAndRespectIntro() {
  const intro = { released: false };
  const { camera, controller, marble } = createController({
    intro,
    marble: { x: 500, y: 500 },
  });
  controller.zoomBy(2);
  controller.panBy(100, 100);
  assert.equal(camera.x + marble.x * camera.scale, 150);
  assert.equal(camera.y + marble.y * camera.scale, 150);
  intro.released = true;
  controller.onPointerDown({ pointerId: 1, clientX: 100, clientY: 100 });
  controller.onPointerDown({ pointerId: 2, clientX: 200, clientY: 100 });
  controller.panBy(20, 0);
  const position = { x: camera.x, y: camera.y, scale: camera.scale };
  controller.onPointerMove({ pointerId: 2, clientX: 280, clientY: 100 });
  assert.deepEqual(
    { x: camera.x, y: camera.y, scale: camera.scale },
    position,
    "discrete controls cancel stale touch gestures",
  );
  controller.updateFollow(30);
  assert.ok(camera.x < position.x, "follow resumes after the button delay");
}

testSinglePointerCameraActions();
testCameraButtonsReleaseGesturesAndRespectIntro();

testFollowPreservesSmoothFollow();
testFollowWaitsForGestureCooldownWhileMarbleIsVisible();
testGesturePansCameraAndStartsCooldown();
testPinchKeepsMapPointAtMovingMidpoint();
testStationaryGesturePausesFollowThenRestoresVisibility();
testPointerReplacementAndCancellationRebaseGesture();
testIntroPinchKeepsMarbleCenteredThenAllowsMapExploration();
testCenterClampsToWorldEdges();
testFollowClampsToFarWorldEdges();
testSmallScaledWorldCentersInViewport();
testWorldSizeCanChange();
testMovingMarbleStaysVisibleAfterZoomAtEveryCadence();
testVisibilityAndWorldEdgesAgree();

console.log("Camera tests passed.");

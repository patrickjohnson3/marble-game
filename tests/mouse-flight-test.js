import assert from "node:assert/strict";
import { mouseConfig } from "../core/game-config.js";
import {
  createMouse,
  resolveMouseContact,
  updateMouse,
} from "../core/mouse.js";

const openMap = {
  mouse: { x: 2000, y: 2000, roamRegion: "mouse-run" },
  regions: [{ id: "mouse-run", x: 0, y: 0, w: 4000, h: 4000 }],
};
const boundedMap = {
  mouse: { x: 600, y: 600, roamRegion: "mouse-run" },
  regions: [{ id: "mouse-run", x: 0, y: 0, w: 1200, h: 1200 }],
};
const farMarble = { x: -1000, y: -1000, vx: 0, vy: 0, r: 29 };

function near(actual, expected, tolerance = 1e-7) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`,
  );
}

function freshMouse(map = openMap) {
  const mouse = createMouse(map);
  Object.assign(mouse, { angle: 0, previousAngle: 0, targetAngle: 0 });
  return mouse;
}

function hit(mouse, speed) {
  const cos = Math.cos(mouse.angle);
  const sin = Math.sin(mouse.angle);
  const radius = mouse.r + 29;
  mouse.previousX = mouse.x;
  mouse.previousY = mouse.y;
  mouse.previousAngle = mouse.angle;
  const previous = {
    x: mouse.x - cos * (radius + 12),
    y: mouse.y - sin * (radius + 12),
  };
  const marble = {
    x: mouse.x - cos * (radius - 8),
    y: mouse.y - sin * (radius - 8),
    r: 29,
    vx: cos * speed,
    vy: sin * speed,
  };
  const damage = resolveMouseContact(mouse, marble, previous);
  return { marble, damage };
}

function advance(mouse, duration, partitions = [1]) {
  for (let elapsed = 0, index = 0; elapsed < duration; index++) {
    const dt = Math.min(
      partitions[index % partitions.length],
      duration - elapsed,
    );
    updateMouse(mouse, farMarble, dt);
    elapsed += dt;
    const region = mouse.roamRegion;
    assert.ok(mouse.x >= region.x + mouse.r - 1e-7);
    assert.ok(mouse.x <= region.x + region.w - mouse.r + 1e-7);
    assert.ok(mouse.y >= region.y + mouse.r - 1e-7);
    assert.ok(mouse.y <= region.y + region.h - mouse.r + 1e-7);
  }
}

function testAnyIncomingImpactStartsFlightWithoutRequiringDamage() {
  for (const speed of [1, mouseConfig.fullDamageSpeed]) {
    const mouse = freshMouse();
    assert.equal(mouse.fleeFrames, 0);
    const { damage } = hit(mouse, speed);
    assert.equal(mouse.fleeFrames, mouseConfig.fleeDuration);
    assert.equal(damage > 0, speed > mouseConfig.minDamageSpeed);
    const x = mouse.x;
    advance(mouse, 30);
    assert.ok(
      mouse.x - x > mouseConfig.walkSpeed * 30,
      "flight outpaces normal walking even after the marble stops threatening it",
    );
    near(mouse.fleeFrames, mouseConfig.fleeDuration - 30);
  }
}

function testMouseContactWithAStationaryOrOutgoingMarbleDoesNotStartFlight() {
  for (const speed of [0, -3]) {
    const mouse = freshMouse();
    hit(mouse, speed);
    assert.equal(mouse.fleeFrames, 0);
    assert.equal(mouse.health, mouse.maxHealth);
  }
  const mouse = freshMouse();
  mouse.previousX = mouse.x + 10;
  const marble = {
    x: mouse.x - mouse.r - 29 + 8,
    y: mouse.y,
    vx: 0,
    vy: 0,
    r: 29,
  };
  resolveMouseContact(mouse, marble, { x: marble.x, y: marble.y });
  assert.equal(
    mouse.contactLatched,
    true,
    "the moving mouse actually touches the marble",
  );
  assert.equal(
    mouse.fleeFrames,
    0,
    "the mouse cannot scare itself by walking into a stationary marble",
  );
}

function testSustainedContactDoesNotRefreshFlightButANewHitDoes() {
  const mouse = freshMouse();
  const { marble } = hit(mouse, 1);
  const offsetX = marble.x - mouse.x;
  const offsetY = marble.y - mouse.y;
  for (let frame = 0; frame < 30; frame++) {
    const previous = { x: marble.x, y: marble.y };
    updateMouse(mouse, farMarble, 1);
    Object.assign(marble, {
      x: mouse.x + offsetX,
      y: mouse.y + offsetY,
      vx: mouseConfig.fullDamageSpeed,
      vy: 0,
    });
    resolveMouseContact(mouse, marble, previous);
  }
  near(mouse.fleeFrames, mouseConfig.fleeDuration - 30);
  assert.equal(
    mouse.health,
    mouse.maxHealth,
    "held contact cannot become a second attack",
  );
  hit(mouse, mouseConfig.fullDamageSpeed);
  assert.equal(mouse.fleeFrames, mouseConfig.fleeDuration);
  assert.equal(mouse.health, mouse.maxHealth - mouseConfig.maxDamage);
}

function testFlightExpiresByElapsedTimeAndReturnsToNormalSpeed() {
  const mouse = freshMouse();
  hit(mouse, 1);
  advance(mouse, mouseConfig.fleeDuration - 0.25, [0.3, 1.7, 0.8, 2, 3.5]);
  near(mouse.fleeFrames, 0.25);
  updateMouse(mouse, farMarble, 0.25);
  assert.equal(mouse.fleeFrames, 0);
  const gait = mouse.gait;
  advance(mouse, 120);
  assert.ok(
    mouse.gait > gait,
    "normal behavior resumes instead of leaving the mouse frozen",
  );
  assert.ok(
    mouse.gait - gait <= mouseConfig.walkSpeed * 120 + 1e-7,
    "an expired escape cannot leave the mouse running at flee/scurry speed",
  );
}

function testFlightTimerIncludesTurningAndBoundaryReplanning() {
  const mouse = freshMouse(boundedMap);
  const edge = mouse.r + mouseConfig.roamMargin + 2;
  mouse.x = 1200 - edge;
  hit(mouse, 1);
  assert.ok(
    mouse.pauseFrames > 0,
    "a hit toward the nearby edge requires a pivot",
  );
  const pause = Math.min(mouse.pauseFrames, 1);
  updateMouse(mouse, farMarble, pause);
  near(mouse.fleeFrames, mouseConfig.fleeDuration - pause);
  advance(mouse, mouseConfig.fleeDuration - pause, [0.3, 1.7, 0.8, 2, 3.5]);
  near(mouse.fleeFrames, 0);
  assert.ok(mouse.gait > 100, "a cornered mouse finds another escape run");
  const gait = mouse.gait;
  advance(mouse, 120);
  assert.ok(
    mouse.gait > gait,
    "normal roaming continues after a bounded escape",
  );
  assert.ok(mouse.gait - gait <= mouseConfig.walkSpeed * 120 + 1e-7);
}

function testFlightAndRecoveryAgreeAcrossRegularAndIrregularPartitions() {
  for (const map of [openMap, boundedMap]) {
    for (const speed of [1, mouseConfig.fullDamageSpeed]) {
      const reference = freshMouse(map);
      hit(reference, speed);
      advance(reference, mouseConfig.fleeDuration + 200);
      for (const partitions of [
        [0.25],
        [0.5],
        [2],
        [7],
        [0.3, 1.7, 0.8, 2, 3.5],
      ]) {
        const mouse = freshMouse(map);
        hit(mouse, speed);
        advance(mouse, mouseConfig.fleeDuration + 200, partitions);
        for (const key of [
          "x",
          "y",
          "vx",
          "vy",
          "angle",
          "gait",
          "fleeFrames",
          "pauseFrames",
          "turnIn",
        ]) {
          // Gait sums path chords while residual knockback crosses a turn;
          // permit only an invisible 0.0001-pixel difference in leg phase.
          // Physical state and behavior timers retain the tighter tolerance.
          near(mouse[key], reference[key], key === "gait" ? 1e-4 : 1e-7);
        }
      }
    }
  }
}

function testGoodHitsTurnBeforeReachingTheRoamingBoundary() {
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const mouse = freshMouse(boundedMap);
    mouse.angle = mouse.previousAngle = mouse.targetAngle = angle;
    hit(mouse, mouseConfig.fullDamageSpeed);
    for (let elapsed = 0; elapsed < mouseConfig.fleeDuration; elapsed++) {
      const previousAngle = mouse.angle;
      updateMouse(mouse, farMarble, 1);
      const turn = Math.atan2(
        Math.sin(mouse.angle - previousAngle),
        Math.cos(mouse.angle - previousAngle),
      );
      assert.ok(
        Math.abs(turn) <= mouseConfig.scurryTurnRate + 1e-7,
        "a normal hit must plan around knockback rather than snap at an invisible boundary",
      );
    }
    assert.equal(mouse.fleeFrames, 0);
    assert.ok(mouse.gait > 300);
  }
}

function testDefeatAndRetryClearFlight() {
  const mouse = freshMouse();
  hit(mouse, mouseConfig.fullDamageSpeed);
  assert.ok(mouse.fleeFrames > 0);
  for (let hitIndex = 0; hitIndex < 3; hitIndex++)
    hit(mouse, mouseConfig.fullDamageSpeed);
  assert.equal(mouse.health, 0);
  assert.equal(mouse.fleeFrames, 0);
  const defeated = globalThis.structuredClone(mouse);
  updateMouse(mouse, farMarble, mouseConfig.fleeDuration * 2);
  hit(mouse, mouseConfig.fullDamageSpeed);
  assert.deepEqual(mouse, defeated);
  const retry = createMouse(openMap);
  assert.equal(retry.fleeFrames, 0);
  assert.equal(retry.health, retry.maxHealth);
  assert.equal(retry.contactLatched, false);
}

testAnyIncomingImpactStartsFlightWithoutRequiringDamage();
testMouseContactWithAStationaryOrOutgoingMarbleDoesNotStartFlight();
testSustainedContactDoesNotRefreshFlightButANewHitDoes();
testFlightExpiresByElapsedTimeAndReturnsToNormalSpeed();
testFlightTimerIncludesTurningAndBoundaryReplanning();
testFlightAndRecoveryAgreeAcrossRegularAndIrregularPartitions();
testGoodHitsTurnBeforeReachingTheRoamingBoundary();
testDefeatAndRetryClearFlight();
console.log("Mouse flight tests passed.");

import assert from "node:assert/strict";
import { mouseConfig, physicsConfig } from "../core/game-config.js";
import {
  createMouse,
  mouseImpactDamage,
  resolveMouseContact,
  updateMouse,
} from "../core/mouse.js";
import { updatePhysics, SURFACE_TYPES } from "../core/physics.js";

const map = {
  mouse: { x: 600, y: 600, roamRegion: "mouse-run" },
  regions: [{ id: "mouse-run", x: 0, y: 0, w: 1200, h: 1200 }],
};
const farMarble = { x: -1000, y: -1000, vx: 0, vy: 0, r: 29 };

function near(actual, expected, tolerance = 1e-8) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`,
  );
}

function hit(mouse, speed, onImpact = () => {}) {
  const radius = mouse.r + 29;
  const previous = { x: mouse.x - radius - 12, y: mouse.y };
  const marble = {
    x: mouse.x - radius + 2,
    y: mouse.y,
    r: 29,
    vx: speed,
    vy: 0,
  };
  const damage = resolveMouseContact(mouse, marble, previous, onImpact);
  return { marble, damage };
}

function testDamageTracksIncomingSpeedAndIsBounded() {
  assert.equal(mouseImpactDamage(-14), 0);
  assert.equal(mouseImpactDamage(0), 0);
  assert.equal(mouseImpactDamage(mouseConfig.minDamageSpeed), 0);
  assert.ok(mouseImpactDamage(6) > 0);
  assert.ok(mouseImpactDamage(12) > mouseImpactDamage(6));
  assert.equal(mouseImpactDamage(Number.MAX_VALUE), mouseConfig.maxDamage);
  const mouse = createMouse(map);
  const { marble, damage } = hit(mouse, 14);
  assert.equal(damage, mouseConfig.maxDamage);
  assert.equal(mouse.health, mouse.maxHealth - damage);
  assert.ok(marble.vx < 0, "a direct hit rebounds the marble");
  assert.ok(mouse.vx > 0, "a direct hit knocks the mouse away");
}

function testGlancingHitDoesLessDamageAndSweepFindsFirstContact() {
  const direct = createMouse(map);
  const glancing = createMouse(map);
  const radius = direct.r + 29;
  const directMarble = {
    x: direct.x + radius + 20,
    y: direct.y,
    r: 29,
    vx: 14,
    vy: 0,
  };
  const directDamage = resolveMouseContact(direct, directMarble, {
    x: direct.x - radius - 20,
    y: direct.y,
  });
  const glancingMarble = {
    x: glancing.x + radius + 20,
    y: glancing.y - radius * 0.8,
    r: 29,
    vx: 14,
    vy: 0,
  };
  const glancingDamage = resolveMouseContact(glancing, glancingMarble, {
    x: glancing.x - radius - 20,
    y: glancingMarble.y,
  });
  assert.equal(directDamage, mouseConfig.maxDamage);
  assert.ok(glancingDamage > 0 && glancingDamage < directDamage);
  assert.ok(directMarble.x < direct.x, "fast sweep stops at the entry side");
}

function testSustainedContactRequiresSeparationEvenAfterHarmlessBump() {
  for (const firstSpeed of [1, 14]) {
    const mouse = createMouse(map);
    hit(mouse, firstSpeed);
    const healthAfterFirstContact = mouse.health;
    for (let i = 0; i < 120; i++) {
      const marble = {
        x: mouse.x - mouse.r - 28,
        y: mouse.y,
        r: 29,
        vx: 14,
        vy: 0,
      };
      resolveMouseContact(mouse, marble, { x: marble.x, y: marble.y });
    }
    assert.equal(mouse.health, healthAfterFirstContact);
    const { damage } = hit(mouse, 14);
    assert.ok(
      damage > 0,
      "a new impact after genuine separation can damage again",
    );
  }
}

function testMouseCannotDamageItselfOrReflectOutgoingVelocity() {
  const mouse = createMouse(map);
  mouse.previousX = mouse.x - 5;
  const stillMarble = {
    x: mouse.x + mouse.r + 27,
    y: mouse.y,
    vx: 0,
    vy: 0,
    r: 29,
  };
  const previous = { x: stillMarble.x, y: stillMarble.y };
  let impacts = 0;
  resolveMouseContact(mouse, stillMarble, previous, () => impacts++);
  assert.equal(mouse.health, mouse.maxHealth);
  assert.equal(impacts, 0);
  near(
    Math.hypot(stillMarble.x - mouse.x, stillMarble.y - mouse.y),
    mouse.r + stillMarble.r,
  );

  const reversingMouse = createMouse(map);
  const outgoing = {
    x: reversingMouse.x - reversingMouse.r - 28,
    y: reversingMouse.y,
    r: 29,
    vx: -2,
    vy: 0,
  };
  resolveMouseContact(
    reversingMouse,
    outgoing,
    { x: outgoing.x - 2, y: outgoing.y },
    () => impacts++,
  );
  assert.equal(reversingMouse.health, reversingMouse.maxHealth);
  assert.equal(
    outgoing.vx,
    -2,
    "fractional reversal must not bounce outgoing velocity inward",
  );
  assert.equal(impacts, 0);
}

function testCoincidentCentersStayFinite() {
  const mouse = createMouse(map);
  const marble = { x: mouse.x, y: mouse.y, vx: 0, vy: 0, r: 29 };
  resolveMouseContact(mouse, marble, marble);
  assert.ok(Number.isFinite(marble.x) && Number.isFinite(marble.y));
  assert.equal(mouse.health, mouse.maxHealth);
  near(Math.hypot(marble.x - mouse.x, marble.y - mouse.y), mouse.r + marble.r);
}

function testDefeatStopsFurtherHitsAndMovementAndRetryIsFresh() {
  const mouse = createMouse(map);
  let impacts = 0;
  for (let i = 0; i < 4; i++) hit(mouse, 14, () => impacts++);
  assert.equal(mouse.health, 0);
  assert.equal(impacts, 4);
  assert.equal(mouse.vx, 0);
  assert.equal(mouse.vy, 0);
  const defeated = globalThis.structuredClone(mouse);
  hit(mouse, 14, () => impacts++);
  updateMouse(mouse, farMarble, 100);
  assert.deepEqual(mouse, defeated);
  assert.equal(impacts, 4);
  const fresh = createMouse(map);
  assert.equal(fresh.health, mouseConfig.maxHealth);
  assert.equal(fresh.contactLatched, false);
  assert.equal(fresh.hitFlash, 0);
  assert.equal(fresh.x, map.mouse.x);
  assert.equal(fresh.y, map.mouse.y);
  assert.notEqual(fresh.roamRegion, map.regions[0]);
  assert.equal(createMouse({}), null);
  assert.throws(() => createMouse({ mouse: map.mouse }), /roam region/);
  assert.throws(
    () => createMouse({ ...map, regions: [{ ...map.regions[0], w: 0 }] }),
    /body radius/,
  );
}

function simulateMouse(dt, duration, setup = () => {}) {
  const mouse = createMouse(map);
  setup(mouse);
  for (let t = 0; t < duration; t += dt)
    updateMouse(mouse, farMarble, Math.min(dt, duration - t));
  return mouse;
}

function testMovementPausesAndKnockbackUseElapsedTime() {
  const reference = simulateMouse(1, 270);
  for (const dt of [0.25, 0.5, 2, 7]) {
    const mouse = simulateMouse(dt, 270);
    near(mouse.x, reference.x);
    near(mouse.y, reference.y);
    near(mouse.gait, reference.gait);
  }
  const boundarySetup = (mouse) => {
    mouse.x = 70;
    mouse.y = 80;
    mouse.angle = -Math.PI / 3;
  };
  const boundaryReference = simulateMouse(1, 270, boundarySetup);
  for (const dt of [0.25, 0.5, 2, 7]) {
    const mouse = simulateMouse(dt, 270, boundarySetup);
    near(mouse.x, boundaryReference.x);
    near(mouse.y, boundaryReference.y);
    near(mouse.gait, boundaryReference.gait);
  }
  const boundaryKnockback = (mouse) => {
    boundarySetup(mouse);
    mouse.vx = -5;
    mouse.vy = -5;
  };
  const boundaryKnockbackReference = simulateMouse(1, 270, boundaryKnockback);
  for (const dt of [0.25, 0.5, 2, 7]) {
    const mouse = simulateMouse(dt, 270, boundaryKnockback);
    near(mouse.x, boundaryKnockbackReference.x);
    near(mouse.y, boundaryKnockbackReference.y);
    near(mouse.vx, boundaryKnockbackReference.vx);
    near(mouse.vy, boundaryKnockbackReference.vy);
  }
  const setup = (mouse) => {
    mouse.pauseFrames = 200;
    mouse.vx = 5;
    mouse.vy = -2;
  };
  const knockbackReference = simulateMouse(1, 60, setup);
  for (const dt of [0.25, 0.5, 2, 7]) {
    const mouse = simulateMouse(dt, 60, setup);
    near(mouse.x, knockbackReference.x);
    near(mouse.y, knockbackReference.y);
    near(mouse.vx, knockbackReference.vx);
  }
}

function testLongRoamRemainsBoundedDeterministicAndKeepsMoving() {
  for (const dt of [0.25, 1, 2, 13]) {
    const mouse = createMouse(map);
    let traveled = 0;
    for (let t = 0; t < 5000; t += dt) {
      const x = mouse.x;
      const y = mouse.y;
      updateMouse(mouse, farMarble, dt);
      assert.ok(mouse.x >= mouse.r && mouse.x <= 1200 - mouse.r);
      assert.ok(mouse.y >= mouse.r && mouse.y <= 1200 - mouse.r);
      traveled += Math.hypot(mouse.x - x, mouse.y - y);
    }
    assert.ok(traveled > 3000, "the mouse must not remain stuck at its bounds");
  }
  assert.deepEqual(simulateMouse(1, 500), simulateMouse(1, 500));
  const mouse = createMouse(map);
  const initialX = mouse.x;
  updateMouse(mouse, { x: mouse.x - 100, y: mouse.y, vx: 10, vy: 0 }, 1);
  assert.ok(
    mouse.x > initialX + mouseConfig.walkSpeed,
    "an approaching marble provokes a scurry",
  );
}

function physicsContext(mouse) {
  return {
    marble: { x: 505, y: 600, vx: 14, vy: 0, r: 29 },
    tilt: { smoothX: 0, smoothY: 0 },
    intro: { released: true },
    bounds: { left: 0, right: 1200, top: 0, bottom: 1200 },
    physics: { ...physicsConfig, baseDragRetention: 1 },
    mapState: { mouse, obstacles: [], terrainByType: {} },
  };
}

function testPhysicsSubstepsContactWithoutRepetition() {
  const mouse = createMouse(map);
  mouse.pauseFrames = 100;
  // Exercise real movement: the approaching marble can interrupt this pause.
  mouse.scurryFrames = 0;
  const context = physicsContext(mouse);
  let impacts = 0;
  updatePhysics(context, 2, { onImpact: () => impacts++, onSurface() {} });
  assert.ok(mouse.health < mouse.maxHealth);
  assert.equal(impacts, 1);
  assert.ok(context.marble.vx < 0);
  const locked = physicsContext(createMouse(map));
  locked.intro.released = false;
  const before = globalThis.structuredClone(locked.mapState.mouse);
  updatePhysics(locked, 2, { onImpact() {}, onSurface() {} });
  assert.deepEqual(locked.mapState.mouse, before);
}

function testPhysicsImpactIsConsistentAcrossCadences() {
  for (const dt of [0.5, 1, 2]) {
    const mouse = createMouse(map);
    const context = physicsContext(mouse);
    let impacts = 0;
    for (let t = 0; t < 8 && mouse.health === mouse.maxHealth; t += dt) {
      updatePhysics(context, dt, { onImpact: () => impacts++, onSurface() {} });
    }
    assert.equal(impacts, 1, `dt=${dt} should produce one physical hit`);
    near(mouse.health, mouse.maxHealth - mouseConfig.maxDamage);
    near(context.marble.vx, -14 * mouseConfig.bounce);
  }
}

function testHazardResetSkipsMouseMovementAndContact() {
  const mouse = createMouse(map);
  const before = globalThis.structuredClone(mouse);
  const context = physicsContext(mouse);
  context.mapState.terrainByType[SURFACE_TYPES.hazardPatch] = {
    elements: [{ x: 495, y: 590, w: 30, h: 30 }],
  };
  let impacts = 0;
  const reset = updatePhysics(context, 2, {
    onHazard() {
      Object.assign(context.marble, { x: 800, y: 600, vx: 0, vy: 0 });
      return true;
    },
    onImpact: () => impacts++,
    onSurface() {},
  });
  assert.equal(reset, true);
  assert.equal(impacts, 0);
  assert.deepEqual(mouse, before);
  assert.equal(context.marble.x, 800);
}

testDamageTracksIncomingSpeedAndIsBounded();
testGlancingHitDoesLessDamageAndSweepFindsFirstContact();
testSustainedContactRequiresSeparationEvenAfterHarmlessBump();
testMouseCannotDamageItselfOrReflectOutgoingVelocity();
testCoincidentCentersStayFinite();
testDefeatStopsFurtherHitsAndMovementAndRetryIsFresh();
testMovementPausesAndKnockbackUseElapsedTime();
testLongRoamRemainsBoundedDeterministicAndKeepsMoving();
testPhysicsSubstepsContactWithoutRepetition();
testPhysicsImpactIsConsistentAcrossCadences();
testHazardResetSkipsMouseMovementAndContact();
console.log("Mouse tests passed.");

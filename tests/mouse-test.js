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

function contactMouse() {
  const mouse = createMouse(map);
  mouse.angle = mouse.previousAngle = mouse.targetAngle = 0;
  return mouse;
}

function assertOutsideBody(mouse, marble) {
  for (const part of mouseConfig.bodyParts) {
    const x = mouse.x + Math.cos(mouse.angle) * part.x * mouse.r;
    const y = mouse.y + Math.sin(mouse.angle) * part.x * mouse.r;
    assert.ok(
      Math.hypot(marble.x - x, marble.y - y) >=
        part.r * mouse.r + marble.r - 1e-8,
      "contact correction clears every overlapping body part",
    );
  }
}

function hit(mouse, speed, onImpact = () => {}) {
  const rump = mouseConfig.bodyParts[0];
  const radius = (rump.r - rump.x) * mouse.r + 29;
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
  const mouse = contactMouse();
  const { marble, damage } = hit(mouse, 14);
  assert.equal(damage, mouseConfig.maxDamage);
  assert.equal(mouse.health, mouse.maxHealth - damage);
  assert.ok(marble.vx < 0, "a direct hit rebounds the marble");
  assert.ok(mouse.vx > 0, "a direct hit knocks the mouse away");
}

function testContactTracksTheTaperedBodyAndHeading() {
  const rump = mouseConfig.bodyParts[0];
  const head = mouseConfig.bodyParts[2];
  for (const angle of [0, Math.PI / 2, 0.65]) {
    for (const [part, nx, ny] of [
      [rump, -1, 0],
      [rump, 0, 1],
      [rump, 0, -1],
      [head, 1, 0],
    ]) {
      const mouse = contactMouse();
      mouse.angle = mouse.previousAngle = angle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const worldNx = cos * nx - sin * ny;
      const worldNy = sin * nx + cos * ny;
      const radius = part.r * mouse.r + 29;
      const marble = {
        x: mouse.x + cos * part.x * mouse.r + worldNx * (radius + 0.1),
        y: mouse.y + sin * part.x * mouse.r + worldNy * (radius + 0.1),
        vx: -worldNx * 14,
        vy: -worldNy * 14,
        r: 29,
      };
      const previous = { x: marble.x, y: marble.y };
      assert.equal(resolveMouseContact(mouse, marble, previous), 0);
      assert.equal(mouse.contactLatched, false);
      marble.x -= worldNx * 0.2;
      marble.y -= worldNy * 0.2;
      near(resolveMouseContact(mouse, marble, previous), mouseConfig.maxDamage);
      assertOutsideBody(mouse, marble);
      assert.ok(marble.vx * worldNx + marble.vy * worldNy > 0);
    }
  }
  const mouse = contactMouse();
  const besideBody = {
    x: mouse.x,
    y: mouse.y + mouse.r * 0.75 + 29,
    r: 29,
    vx: 0,
    vy: -14,
  };
  assert.equal(resolveMouseContact(mouse, besideBody, besideBody), 0);
  assert.equal(
    mouse.contactLatched,
    false,
    "the old circular side margin is clear",
  );
}

function testBodySeamsKeepOneContactAndClearAllParts() {
  const mouse = contactMouse();
  let impacts = 0;
  for (const x of [-24, 0, 20, 42]) {
    const marble = { x: mouse.x + x, y: mouse.y + 55, vx: 0, vy: -14, r: 29 };
    resolveMouseContact(mouse, marble, marble, () => impacts++);
    assertOutsideBody(mouse, marble);
  }
  assert.equal(
    impacts,
    1,
    "moving among overlapping parts is one sustained contact",
  );
  const health = mouse.health;
  const tailContact = {
    x: mouse.x - 110,
    y: mouse.y,
    vx: 14,
    vy: 0,
    r: 29,
  };
  resolveMouseContact(mouse, tailContact, tailContact, () => impacts++);
  assert.equal(
    mouse.health,
    health,
    "separation from the head alone cannot rearm damage",
  );
  hit(mouse, 14, () => impacts++);
  assert.equal(impacts, 2, "leaving the entire body rearms the next impact");
}

function testTurningContactUsesPreviousHeadingWithoutSelfDamage() {
  const mouse = contactMouse();
  mouse.angle = 0.8;
  const marble = { x: mouse.x + 85, y: mouse.y + 52, r: 29, vx: 0, vy: 0 };
  let impacts = 0;
  resolveMouseContact(mouse, marble, marble, () => impacts++);
  assert.equal(
    mouse.contactLatched,
    true,
    "turning moves the head into contact",
  );
  assertOutsideBody(mouse, marble);
  assert.equal(mouse.health, mouse.maxHealth);
  assert.equal(impacts, 0);
  assert.equal(marble.vx, 0);
  assert.equal(marble.vy, 0);
}

function testGlancingHitDoesLessDamageAndSweepFindsFirstContact() {
  const direct = contactMouse();
  const glancing = contactMouse();
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
    y: glancing.y - (mouseConfig.bodyParts[0].r * glancing.r + 29) * 0.8,
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
  const reverseMouse = contactMouse();
  const reverseMarble = {
    x: reverseMouse.x - radius - 20,
    y: reverseMouse.y,
    r: 29,
    vx: -14,
    vy: 0,
  };
  assert.equal(
    resolveMouseContact(reverseMouse, reverseMarble, {
      x: reverseMouse.x + radius + 20,
      y: reverseMouse.y,
    }),
    mouseConfig.maxDamage,
  );
  const head = mouseConfig.bodyParts[2];
  near(
    reverseMarble.x,
    reverseMouse.x + (head.x + head.r) * reverseMouse.r + 29,
  );
  assert.ok(
    reverseMarble.vx > 0,
    "the head is first even though its part is last",
  );
}

function testSustainedContactRequiresSeparationEvenAfterHarmlessBump() {
  for (const firstSpeed of [1, 14]) {
    const mouse = contactMouse();
    hit(mouse, firstSpeed);
    const healthAfterFirstContact = mouse.health;
    for (let i = 0; i < 120; i++) {
      const marble = {
        x:
          mouse.x -
          (mouseConfig.bodyParts[0].r - mouseConfig.bodyParts[0].x) * mouse.r -
          28,
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
  const mouse = contactMouse();
  mouse.previousX = mouse.x - 5;
  const stillMarble = {
    x:
      mouse.x +
      (mouseConfig.bodyParts[2].r + mouseConfig.bodyParts[2].x) * mouse.r +
      27,
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
  assertOutsideBody(mouse, stillMarble);

  const reversingMouse = contactMouse();
  const outgoing = {
    x:
      reversingMouse.x -
      (mouseConfig.bodyParts[0].r - mouseConfig.bodyParts[0].x) *
        reversingMouse.r -
      28,
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
  const mouse = contactMouse();
  const marble = { x: mouse.x, y: mouse.y, vx: 0, vy: 0, r: 29 };
  resolveMouseContact(mouse, marble, marble);
  assert.ok(Number.isFinite(marble.x) && Number.isFinite(marble.y));
  assert.equal(mouse.health, mouse.maxHealth);
  assertOutsideBody(mouse, marble);
}

function testDefeatStopsFurtherHitsAndMovementAndRetryIsFresh() {
  const mouse = contactMouse();
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
  const fresh = contactMouse();
  assert.equal(fresh.health, mouseConfig.maxHealth);
  assert.equal(fresh.r, mouseConfig.radius);
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
  const reference = simulateMouse(1, 6000);
  for (const dt of [0.25, 0.5, 2, 7, 13]) {
    const mouse = simulateMouse(dt, 6000);
    near(mouse.x, reference.x);
    near(mouse.y, reference.y);
    near(mouse.gait, reference.gait);
  }
  const irregular = createMouse(map);
  const partitions = [0.3, 1.7, 0.8, 2, 3.5];
  for (let elapsed = 0, i = 0; elapsed < 6000; i++) {
    const step = Math.min(partitions[i % partitions.length], 6000 - elapsed);
    updateMouse(irregular, farMarble, step);
    elapsed += step;
  }
  near(irregular.x, reference.x);
  near(irregular.y, reference.y);
  near(irregular.gait, reference.gait);
  const startledSetup = (mouse) =>
    updateMouse(
      mouse,
      { x: mouse.x - mouse.r - farMarble.r - 27, y: mouse.y, vx: 10, vy: 0 },
      0.25,
    );
  const startledReference = simulateMouse(1, 150, startledSetup);
  for (const dt of [0.25, 0.5, 2, 7]) {
    const mouse = simulateMouse(dt, 150, startledSetup);
    near(mouse.x, startledReference.x);
    near(mouse.y, startledReference.y);
    near(mouse.angle, startledReference.angle);
    near(mouse.gait, startledReference.gait);
  }
  const boundarySetup = (mouse) => {
    mouse.x = mouse.r + 26;
    mouse.y = mouse.r + 36;
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
  const threat = {
    x: mouse.x - mouse.r - farMarble.r - 27,
    y: mouse.y,
    vx: 10,
    vy: 0,
  };
  const initialAngle = mouse.angle;
  const initialX = mouse.x;
  updateMouse(mouse, threat, 0.25);
  assert.ok(mouse.scurryFrames > 0, "an approaching marble provokes an escape");
  assert.ok(
    Math.abs(mouse.angle - initialAngle) <=
      mouseConfig.scurryTurnRate * 0.25 + 1e-10,
    "the startled mouse pivots rather than snapping instantly around",
  );
  assert.equal(mouse.x, initialX, "a short startle pause precedes the dart");
  while (mouse.pauseFrames > 0) updateMouse(mouse, threat, 0.25);
  const runX = mouse.x;
  updateMouse(mouse, threat, 1);
  near(mouse.x - runX, mouseConfig.scurrySpeed);
}

function testCalmRunsVaryAndTurnDuringPausesWithoutBouncing() {
  const mouse = createMouse(map);
  const runs = [];
  const pauses = [];
  let framesMoving = 0;
  for (let elapsed = 0; elapsed < 6000; elapsed += 0.25) {
    const previousAngle = mouse.angle;
    const previousTurn = mouse.turnIndex;
    const previousPauseFrames = mouse.pauseFrames;
    const previousX = mouse.x;
    const previousY = mouse.y;
    updateMouse(mouse, farMarble, 0.25);
    if (previousTurn !== mouse.turnIndex) {
      runs.push(mouse.turnIn);
      pauses.push(mouse.pauseFrames);
    }
    assert.ok(
      Math.abs(mouse.angle - previousAngle) <=
        mouseConfig.turnRate * 0.25 + 1e-10,
      "roaming never reflects/snap-turns the mouse at an invisible edge",
    );
    const moved = Math.hypot(mouse.x - previousX, mouse.y - previousY);
    if (moved > 0) framesMoving++;
    if (previousPauseFrames >= 0.25) near(moved, 0);
    assert.ok(mouse.x >= mouse.r + mouseConfig.roamMargin - 1e-8);
    assert.ok(mouse.x <= 1200 - mouse.r - mouseConfig.roamMargin + 1e-8);
    assert.ok(mouse.y >= mouse.r + mouseConfig.roamMargin - 1e-8);
    assert.ok(mouse.y <= 1200 - mouse.r - mouseConfig.roamMargin + 1e-8);
  }
  assert.ok(runs.length > 20, "the mouse continues choosing new runs");
  assert.ok(framesMoving > 12000, "sniffing does not replace roaming");
  assert.ok(new Set(runs.map((duration) => Math.round(duration))).size > 5);
  assert.ok(new Set(pauses.map((duration) => Math.round(duration))).size > 5);
}

function testEdgeThreatChoosesAnEscapeRunInsteadOfBouncing() {
  const edge = mouseConfig.radius + mouseConfig.roamMargin + 1;
  for (const [x, y, angle] of [
    [edge, 600, Math.PI],
    [1200 - edge, 600, 0],
    [600, edge, -Math.PI / 2],
    [600, 1200 - edge, Math.PI / 2],
  ]) {
    const mouse = createMouse(map);
    Object.assign(mouse, { x, y, angle, targetAngle: angle });
    const threat = {
      x: x - Math.cos(angle) * 150,
      y: y - Math.sin(angle) * 150,
      vx: Math.cos(angle) * 10,
      vy: Math.sin(angle) * 10,
    };
    updateMouse(mouse, threat, 0.25);
    while (mouse.pauseFrames > 0) updateMouse(mouse, farMarble, 0.25);
    for (let i = 0; i < 30; i++) {
      const heading = mouse.angle;
      updateMouse(mouse, farMarble, 1);
      near(mouse.angle, heading);
      assert.ok(mouse.x >= edge - 1 - 1e-8 && mouse.x <= 1201 - edge + 1e-8);
      assert.ok(mouse.y >= edge - 1 - 1e-8 && mouse.y <= 1201 - edge + 1e-8);
    }
    const towardMarble =
      (mouse.x - x) * -Math.cos(angle) + (mouse.y - y) * -Math.sin(angle);
    assert.ok(
      Math.hypot(mouse.x - x, mouse.y - y) > 60,
      "escape follows the roomy edge",
    );
    assert.ok(
      Math.abs(towardMarble) < 1,
      "the mouse does not flee straight back into the approaching marble",
    );
  }
}

function physicsContext(mouse) {
  return {
    marble: {
      x: mouse.x - mouse.r - 29 - 22,
      y: mouse.y,
      vx: 14,
      vy: 0,
      r: 29,
    },
    tilt: { smoothX: 0, smoothY: 0 },
    intro: { released: true },
    bounds: { left: 0, right: 1200, top: 0, bottom: 1200 },
    physics: { ...physicsConfig, baseDragRetention: 1 },
    mapState: { mouse, obstacles: [], terrainByType: {} },
  };
}

function testPhysicsSubstepsContactWithoutRepetition() {
  const mouse = contactMouse();
  mouse.pauseFrames = 100;
  // Exercise real movement: the approaching marble can interrupt this pause.
  mouse.scurryFrames = 0;
  const context = physicsContext(mouse);
  let impacts = 0;
  updatePhysics(context, 2, { onImpact: () => impacts++, onSurface() {} });
  assert.ok(mouse.health < mouse.maxHealth);
  assert.equal(impacts, 1);
  assert.ok(context.marble.vx < 0);
  const locked = physicsContext(contactMouse());
  locked.intro.released = false;
  const before = globalThis.structuredClone(locked.mapState.mouse);
  updatePhysics(locked, 2, { onImpact() {}, onSurface() {} });
  assert.deepEqual(locked.mapState.mouse, before);
}

function testPhysicsImpactIsConsistentAcrossCadences() {
  for (const dt of [0.5, 1, 2]) {
    const mouse = contactMouse();
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
  const mouse = contactMouse();
  const before = globalThis.structuredClone(mouse);
  const context = physicsContext(mouse);
  context.mapState.terrainByType[SURFACE_TYPES.hazardPatch] = {
    elements: [
      { x: context.marble.x - 10, y: context.marble.y - 10, w: 30, h: 30 },
    ],
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
testContactTracksTheTaperedBodyAndHeading();
testBodySeamsKeepOneContactAndClearAllParts();
testTurningContactUsesPreviousHeadingWithoutSelfDamage();
testGlancingHitDoesLessDamageAndSweepFindsFirstContact();
testSustainedContactRequiresSeparationEvenAfterHarmlessBump();
testMouseCannotDamageItselfOrReflectOutgoingVelocity();
testCoincidentCentersStayFinite();
testDefeatStopsFurtherHitsAndMovementAndRetryIsFresh();
testMovementPausesAndKnockbackUseElapsedTime();
testLongRoamRemainsBoundedDeterministicAndKeepsMoving();
testCalmRunsVaryAndTurnDuringPausesWithoutBouncing();
testEdgeThreatChoosesAnEscapeRunInsteadOfBouncing();
testPhysicsSubstepsContactWithoutRepetition();
testPhysicsImpactIsConsistentAcrossCadences();
testHazardResetSkipsMouseMovementAndContact();
console.log("Mouse tests passed.");

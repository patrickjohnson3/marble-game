import assert from "node:assert/strict";
import {
  createCockroach,
  resolveCockroachContact,
  updateCockroach,
} from "../core/cockroach.js";
import { cockroachConfig, physicsConfig } from "../core/game-config.js";
import { updatePhysics } from "../core/physics.js";

const map = {
  theme: "kitchenFloor",
  world: { width: 4000, height: 4000 },
  cockroach: { x: 1000, y: 1000 },
};

function fixture() {
  const cockroach = createCockroach(map);
  Object.assign(cockroach, {
    mode: "harass",
    modeFrames: cockroachConfig.harassmentDuration,
    angle: Math.PI,
    vx: -cockroachConfig.harassSpeed,
  });
  return {
    cockroach,
    mapState: {
      activeMap: map,
      obstacles: [],
      terrainByType: {},
      goalCompleted: false,
      cockroach,
    },
  };
}

function incomingMarble(cockroach, speed = 0) {
  const radius = cockroach.r + 29;
  return {
    previous: { x: cockroach.x - radius - 20, y: cockroach.y },
    marble: {
      x: cockroach.x - radius + 1,
      y: cockroach.y,
      vx: speed,
      vy: 0,
      r: 29,
    },
  };
}

function attack(subject, speed = 0) {
  const { cockroach, mapState } = subject;
  const { previous, marble } = incomingMarble(cockroach, speed);
  cockroach.previousX = cockroach.x;
  cockroach.previousY = cockroach.y;
  assert.equal(
    resolveCockroachContact(cockroach, marble, previous, mapState),
    "attack",
  );
  return marble;
}

function advance(subject, marble, duration, parts = [1], onStep = () => {}) {
  let elapsed = 0;
  let index = 0;
  while (elapsed < duration - 1e-8) {
    const dt = Math.min(parts[index++ % parts.length], duration - elapsed);
    updateCockroach(subject.cockroach, marble, dt, subject.mapState);
    onStep();
    elapsed += dt;
  }
}

function testShoveReversesEveryWeakIncomingHit() {
  for (const speed of [0, 4, cockroachConfig.repelSpeed - 0.001]) {
    const subject = fixture();
    const { marble, previous } = incomingMarble(subject.cockroach, speed);
    const position = { x: marble.x, y: marble.y };
    assert.equal(
      resolveCockroachContact(
        subject.cockroach,
        marble,
        previous,
        subject.mapState,
      ),
      "attack",
    );
    assert.ok(
      marble.vx <= -cockroachConfig.contactImpulse * 0.9,
      "a weak incoming marble is pushed outward, not merely slowed down",
    );
    assert.ok(
      Math.hypot(marble.vx, marble.vy) <= cockroachConfig.maxDisruptedSpeed,
    );
    assert.deepEqual({ x: marble.x, y: marble.y }, position);
    assert.equal(subject.cockroach.mode, "harass");
  }
}

function testCloseEngagementPersistsWithoutPassingThroughTheMarble() {
  const subject = fixture();
  const marble = attack(subject);
  const { cockroach, mapState } = subject;
  const position = { x: cockroach.x, y: cockroach.y };
  const velocity = marble.vx;
  advance(
    subject,
    marble,
    cockroachConfig.harassmentDuration * 2,
    [0.5, 1, 2],
    () => {
      assert.equal(
        resolveCockroachContact(cockroach, marble, marble, mapState),
        null,
      );
      assert.equal(
        marble.vx,
        velocity,
        "held contact never stacks attack impulses",
      );
      assert.equal(
        cockroach.mode,
        "harass",
        "nearby engagement has no chase timeout",
      );
      assert.deepEqual(
        { x: cockroach.x, y: cockroach.y },
        position,
        "a latched cockroach yields instead of walking through the marble",
      );
    },
  );
}

function testSeparationAndRecoveryAreBothRequiredForAnotherAttack() {
  const subject = fixture();
  attack(subject);
  const { cockroach, mapState } = subject;
  const separated = {
    x: cockroach.x - cockroach.r - 29 - cockroachConfig.separationMargin - 30,
    y: cockroach.y,
    r: 29,
    vx: 0,
    vy: 0,
  };
  updateCockroach(cockroach, separated, 0.5, mapState);
  resolveCockroachContact(cockroach, separated, separated, mapState);
  assert.equal(cockroach.contactLatched, false);
  const early = incomingMarble(cockroach, cockroachConfig.repelSpeed / 2);
  assert.equal(
    resolveCockroachContact(cockroach, early.marble, early.previous, mapState),
    null,
    "an immediate separated recontact cannot bypass attack recovery",
  );
  advance(subject, separated, cockroachConfig.attackRecoveryDuration + 1);
  resolveCockroachContact(cockroach, separated, separated, mapState);
  cockroach.vx = -cockroachConfig.harassSpeed;
  const next = attack(subject);
  assert.ok(next.vx < 0, "a fresh encounter shoves again after recovery");
  assert.equal(cockroach.mode, "harass");
}

function testStrongCounterHitStillWorksDuringRecovery() {
  const subject = fixture();
  attack(subject);
  const { cockroach, mapState } = subject;
  const { previous, marble } = incomingMarble(
    cockroach,
    cockroachConfig.repelSpeed + 2,
  );
  assert.equal(
    resolveCockroachContact(cockroach, marble, previous, mapState),
    "repel",
    "a fresh strong impact retains priority during attack recovery",
  );
  assert.equal(cockroach.mode, "stunned");
  assert.equal(cockroach.engaged, false);
  assert.ok(cockroach.knockbackX > 0);
}

function testEscapeReturnsToFoodAndProvidesRespite() {
  const subject = fixture();
  attack(subject);
  const { cockroach, mapState } = subject;
  const escaped = {
    x: cockroach.x + cockroachConfig.escapeDistance + 100,
    y: cockroach.y,
    vx: 0,
    vy: 0,
    r: 29,
  };
  updateCockroach(cockroach, escaped, 0.5, mapState);
  resolveCockroachContact(cockroach, escaped, escaped, mapState);
  assert.equal(cockroach.mode, "scurry");
  assert.equal(cockroach.engaged, false);
  assert.ok(cockroach.harassmentIn > cockroachConfig.postContactCooldown / 2);
  advance(
    subject,
    escaped,
    cockroachConfig.postContactCooldown / 2,
    [1],
    () => {
      assert.equal(
        cockroach.mode,
        "scurry",
        "escaping grants a quiet foraging interval",
      );
    },
  );
  const fresh = createCockroach(map);
  assert.equal(fresh.engaged, false);
  assert.equal(fresh.attackRecoveryFrames, 0);
}

function testRecoveryAdvancesBySimulationTime() {
  let reference;
  for (const parts of [[0.5], [1], [2], [0.13, 0.8, 1.17, 2.2]]) {
    const subject = fixture();
    const marble = attack(subject);
    advance(subject, marble, cockroachConfig.attackRecoveryDuration / 2, parts);
    const { cockroach } = subject;
    assert.ok(cockroach.attackRecoveryFrames > 0);
    const values = [cockroach.x, cockroach.y, cockroach.attackRecoveryFrames];
    if (reference) {
      values.forEach((value, index) =>
        assert.ok(Math.abs(value - reference[index]) < 1e-8),
      );
    } else reference = values;
    advance(subject, marble, cockroachConfig.attackRecoveryDuration, parts);
    assert.equal(cockroach.attackRecoveryFrames, 0);
  }
}

function testWallContactCannotStackShovesOrPreventLateralEscape() {
  const subject = fixture();
  const { cockroach, mapState } = subject;
  Object.assign(cockroach, { x: 81, previousX: 81 });
  const marble = attack(subject);
  const context = {
    marble,
    bounds: { left: 0, top: 0, right: 4000, bottom: 4000 },
    intro: { released: true },
    tilt: { smoothX: 0, smoothY: 0 },
    keyboard: { x: 0, y: 0 },
    physics: { ...physicsConfig },
    mapState,
  };
  let impacts = 0;
  const feedback = { onImpact: () => impacts++, onSurface() {} };
  for (let frame = 0; frame < 120; frame++) updatePhysics(context, 1, feedback);
  assert.ok(
    impacts <= 1,
    "one boundary bounce does not become repeated roach shoves",
  );
  assert.ok(
    marble.x >= marble.r,
    "the roach never projects the marble through the wall",
  );
  const y = marble.y;
  context.tilt.smoothY = -physicsConfig.keyboardTilt;
  for (let frame = 0; frame < 120; frame++) updatePhysics(context, 1, feedback);
  assert.ok(
    marble.y < y - 500,
    "ordinary steering can leave contact along the wall",
  );
}

testShoveReversesEveryWeakIncomingHit();
testCloseEngagementPersistsWithoutPassingThroughTheMarble();
testSeparationAndRecoveryAreBothRequiredForAnotherAttack();
testStrongCounterHitStillWorksDuringRecovery();
testEscapeReturnsToFoodAndProvidesRespite();
testRecoveryAdvancesBySimulationTime();
testWallContactCannotStackShovesOrPreventLateralEscape();
console.log("Cockroach pressure tests passed.");

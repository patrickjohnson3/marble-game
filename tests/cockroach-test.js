import assert from "node:assert/strict";
import { cockroachConfig } from "../core/game-config.js";
import { resolvedMapConfig } from "../core/map-config.js";
import { createResolvedMapState } from "../core/map-runtime.js";
import {
  createCockroach,
  updateCockroach,
  resolveCockroachContact,
} from "../core/cockroach.js";
import { circleObstacleContact } from "../core/physics-collisions.js";

const map = {
  theme: "kitchenFloor",
  world: { width: 2200, height: 2200 },
  cockroach: { x: 1000, y: 1000 },
};
const farMarble = { x: 10000, y: 10000, vx: 0, vy: 0, r: 29 };
function fixture(obstacles = []) {
  return {
    cockroach: createCockroach(map),
    mapState: { activeMap: map, obstacles, goalCompleted: false },
  };
}
function near(actual, expected, tolerance = 1e-7) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );
}
function hit(cockroach, mapState, speed, mode = cockroach.mode) {
  cockroach.previousX = cockroach.x;
  cockroach.previousY = cockroach.y;
  cockroach.mode = mode;
  const radius = cockroach.r + 29;
  const previous = { x: cockroach.x - radius - 10, y: cockroach.y };
  const marble = {
    x: cockroach.x - radius + 1,
    y: cockroach.y,
    r: 29,
    vx: speed,
    vy: 0,
  };
  let impacts = 0;
  const result = resolveCockroachContact(
    cockroach,
    marble,
    previous,
    mapState,
    () => impacts++,
  );
  return { result, marble, impacts };
}
function advance(
  cockroach,
  mapState,
  duration,
  parts = [1],
  marble = farMarble,
) {
  let elapsed = 0;
  let index = 0;
  while (elapsed < duration - 1e-8) {
    const dt = Math.min(parts[index++ % parts.length], duration - elapsed);
    updateCockroach(cockroach, marble, dt, mapState);
    elapsed += dt;
  }
}

function testOnlyKitchenCreatesAnInvulnerableActor() {
  assert.equal(createCockroach({}), null);
  assert.equal(createCockroach({ ...map, theme: "livingRoom" }), null);
  assert.throws(
    () => createCockroach({ ...map, cockroach: { x: NaN, y: 0 } }),
    /finite/,
  );
  const { cockroach, mapState } = fixture();
  for (let i = 0; i < 20; i++) {
    const { result } = hit(cockroach, mapState, 1000);
    assert.equal(result, "repel");
    assert.ok(
      Math.hypot(cockroach.knockbackX, cockroach.knockbackY) <=
        cockroachConfig.maxKnockbackSpeed,
    );
    advance(cockroach, mapState, cockroachConfig.postContactCooldown + 1);
  }
  for (const field of ["health", "maxHealth", "dead", "alive"])
    assert.equal(field in cockroach, false);
  assert.ok(
    cockroach.gait > 0,
    "repeated hits never disable the actor permanently",
  );
}

function testHarassmentDisruptsOnceThenDisengages() {
  const { cockroach, mapState } = fixture();
  cockroach.vx = -cockroachConfig.harassSpeed;
  const { marble, result, impacts } = hit(cockroach, mapState, 0, "harass");
  assert.equal(result, "attack");
  assert.equal(impacts, 1);
  assert.ok(
    marble.vx < -4,
    "the incoming insect visibly redirects a stationary marble",
  );
  assert.equal(cockroach.mode, "retreat");
  assert.ok(cockroach.harassmentIn >= cockroachConfig.retreatDuration);
  const velocity = marble.vx;
  for (let i = 0; i < 500; i++) {
    assert.equal(
      resolveCockroachContact(cockroach, marble, marble, mapState),
      null,
    );
    assert.equal(
      marble.vx,
      velocity,
      "held contact must not add another impulse",
    );
  }
  advance(cockroach, mapState, cockroachConfig.retreatDuration + 1);
  assert.equal(cockroach.mode, "scurry");
  assert.ok(
    cockroach.harassmentIn > 0,
    "a calm interval remains after retreat",
  );
}

function testOnlyIncomingStrongMarbleContactRepels() {
  for (const speed of [-14, 0, 2, cockroachConfig.repelSpeed - 0.01]) {
    const { cockroach, mapState } = fixture();
    const { result } = hit(cockroach, mapState, speed);
    assert.equal(result, null);
    assert.equal(cockroach.mode, "scurry");
    assert.equal(cockroach.knockbackX, 0);
  }
  const { cockroach, mapState } = fixture();
  const { result, marble } = hit(cockroach, mapState, 14, "harass");
  assert.equal(
    result,
    "repel",
    "a strong marble strike takes priority over harassment",
  );
  assert.equal(
    marble.vx,
    14,
    "counterplay does not apply the cockroach attack impulse",
  );
  assert.equal(cockroach.mode, "stunned");
  assert.ok(cockroach.knockbackX > 0);
  const x = cockroach.x;
  advance(cockroach, mapState, cockroachConfig.stunDuration / 2);
  assert.equal(cockroach.mode, "stunned");
  assert.ok(cockroach.x > x, "the physical kick carries the stunned body away");
  advance(cockroach, mapState, cockroachConfig.stunDuration);
  assert.equal(cockroach.mode, "retreat");
}

function testGlancingAndSeparatingContactsDoNotRepel() {
  const { cockroach, mapState } = fixture();
  const marble = {
    x: cockroach.x - cockroach.r - 28,
    y: cockroach.y,
    r: 29,
    vx: 2,
    vy: 14,
  };
  assert.equal(
    resolveCockroachContact(cockroach, marble, marble, mapState),
    null,
  );
  assert.equal(
    cockroach.mode,
    "scurry",
    "tangential speed is not a strong direct strike",
  );
  const previous = { x: cockroach.x - 100, y: cockroach.y };
  marble.x = cockroach.x - cockroach.r - 28;
  marble.vx = 14;
  marble.vy = 0;
  assert.equal(
    resolveCockroachContact(cockroach, marble, previous, mapState),
    "repel",
    "real separation rearms counterplay",
  );
}

function testSweepAndWallOcclusion() {
  const { cockroach, mapState } = fixture();
  const marble = { x: cockroach.x + 100, y: cockroach.y, r: 29, vx: 14, vy: 0 };
  const previous = { x: cockroach.x - 100, y: cockroach.y };
  assert.equal(
    resolveCockroachContact(cockroach, marble, previous, mapState),
    "repel",
    "a complete pass-through still hits",
  );
  const blocked = fixture([{ x: 975, y: 900, w: 1, h: 200 }]);
  const result = hit(blocked.cockroach, blocked.mapState, 14, "harass");
  assert.equal(
    result.result,
    null,
    "a thin obstacle between centers blocks contact effects",
  );
  assert.equal(blocked.cockroach.contactLatched, false);
}

function testAttackIsBoundedAndDoesNotProjectTheMarble() {
  const { cockroach, mapState } = fixture();
  cockroach.vx = -cockroachConfig.harassSpeed;
  cockroach.mode = "harass";
  const marble = {
    x: cockroach.x - cockroach.r - 28,
    y: cockroach.y,
    r: 29,
    vx: 0,
    vy: 14,
  };
  const x = marble.x;
  const y = marble.y;
  assert.equal(
    resolveCockroachContact(cockroach, marble, marble, mapState),
    "attack",
  );
  assert.ok(
    Math.hypot(marble.vx, marble.vy) <=
      cockroachConfig.maxDisruptedSpeed + 1e-8,
  );
  assert.equal(marble.x, x);
  assert.equal(marble.y, y);
  const timer = cockroach.harassmentIn;
  cockroach.mode = "harass";
  assert.equal(
    resolveCockroachContact(cockroach, marble, marble, mapState),
    null,
  );
  assert.equal(
    cockroach.harassmentIn,
    timer,
    "even a state change cannot rearm a held contact",
  );
}

function testHarassmentReacquiresAfterRespiteAndStillTimesOut() {
  const { cockroach, mapState } = fixture();
  const marble = { x: 100, y: 100, vx: 0, vy: 0, r: 29 };
  advance(
    cockroach,
    mapState,
    cockroachConfig.harassmentInterval - 1,
    [1],
    marble,
  );
  assert.equal(
    cockroach.mode,
    "scurry",
    "the opening quiet period is preserved",
  );
  assert.ok(Math.hypot(marble.x - cockroach.x, marble.y - cockroach.y) > 900);
  updateCockroach(cockroach, marble, 1, mapState);
  assert.equal(
    cockroach.mode,
    "harass",
    "distance cannot strand a ready attack",
  );
  assert.ok(
    cockroach.vx * (marble.x - cockroach.x) +
      cockroach.vy * (marble.y - cockroach.y) >
      0,
    "the pursuit closes toward the distant marble",
  );
  advance(
    cockroach,
    mapState,
    cockroachConfig.harassmentDuration + 1,
    [1],
    marble,
  );
  assert.equal(
    cockroach.mode,
    "retreat",
    "an unsuccessful chase ends without contact",
  );
  assert.ok(cockroach.harassmentIn > 0);
  // Keep resolving contact so real separation can rearm the next encounter.
  while (cockroach.harassmentIn > 1) {
    updateCockroach(cockroach, marble, 1, mapState);
    resolveCockroachContact(cockroach, marble, marble, mapState);
    assert.notEqual(
      cockroach.mode,
      "harass",
      "cooldown always provides respite",
    );
  }
  updateCockroach(cockroach, marble, 1, mapState);
  assert.equal(
    cockroach.mode,
    "harass",
    "another bounded attempt follows cooldown",
  );
}

function testKitchenRoamingDoesNotLoseThePlayer() {
  for (const target of [resolvedMapConfig.spawn, { x: 3350, y: 1100 }]) {
    for (const dt of [0.5, 2]) {
      const mapState = createResolvedMapState(resolvedMapConfig);
      const cockroach = mapState.cockroach;
      const marble = { x: target.x, y: target.y, r: 29, vx: 0, vy: 0 };
      const hits = [];
      // Hold a clear target still to isolate encounter frequency from player
      // steering and marble drift. Use the real kitchen's obstacle geometry.
      for (let frame = dt; frame <= 60 * 60; frame += dt) {
        marble.vx = 0;
        marble.vy = 0;
        updateCockroach(cockroach, marble, dt, mapState);
        if (
          resolveCockroachContact(cockroach, marble, marble, mapState) ===
          "attack"
        )
          hits.push(frame);
      }
      assert.ok(
        hits.length >= 3,
        "the insect must return repeatedly, not wander away for a minute",
      );
      assert.ok(
        hits[0] <= 30 * 60,
        "even a distant target is reacquired promptly",
      );
      for (let i = 1; i < hits.length; i++) {
        assert.ok(hits[i] - hits[i - 1] >= cockroachConfig.postContactCooldown);
      }
    }
  }
}

function testObstaclesBoundsAndCadence() {
  const obstacles = [
    {
      x: 100,
      y: 100,
      w: 1300,
      h: 30,
      angle: 0.4,
      hitboxW: 1300,
      hitboxH: 30,
      cornerRadius: 15,
    },
    { x: 1050, y: 700, w: 40, h: 600 },
    { x: 700, y: 700, w: 390, h: 40 },
  ];
  let reference;
  for (const parts of [[0.5], [1], [2], [0.13, 0.8, 1.17, 2.2]]) {
    const { cockroach, mapState } = fixture(obstacles);
    // Isolate ordinary roaming; pursuit cadence is covered separately.
    cockroach.harassmentIn = 3000;
    for (let i = 0; i < 20; i++) {
      advance(cockroach, mapState, 100, parts);
      assert.ok(
        cockroach.x >= cockroach.r &&
          cockroach.x <= map.world.width - cockroach.r,
      );
      assert.ok(
        cockroach.y >= cockroach.r &&
          cockroach.y <= map.world.height - cockroach.r,
      );
      for (const obstacle of obstacles)
        assert.equal(
          circleObstacleContact(cockroach, obstacle).intersects,
          false,
        );
    }
    for (const value of Object.values(cockroach)) {
      if (typeof value === "number") assert.ok(Number.isFinite(value));
    }
    assert.ok(
      cockroach.gait > 4000,
      "corners and bounded paths do not permanently trap the insect",
    );
    const values = [
      cockroach.x,
      cockroach.y,
      cockroach.angle,
      cockroach.gait,
      cockroach.harassmentIn,
      cockroach.modeFrames,
    ];
    if (reference)
      values.forEach((value, index) => near(value, reference[index]));
    else reference = values;
  }
}

function testMovingTargetInterpolationAndFreshState() {
  let reference;
  for (const parts of [[0.5], [1], [2], [0.13, 0.8, 1.17, 2.2]]) {
    const { cockroach, mapState } = fixture();
    cockroach.mode = "harass";
    cockroach.modeFrames = 120;
    let elapsed = 0;
    let index = 0;
    while (elapsed < 100 - 1e-8) {
      const dt = Math.min(parts[index++ % parts.length], 100 - elapsed);
      const previous = { x: 1400 + elapsed * 2, y: 1100 };
      elapsed += dt;
      const marble = { x: 1400 + elapsed * 2, y: 1100, vx: 2, vy: 0 };
      updateCockroach(cockroach, marble, dt, mapState, previous);
    }
    const values = [
      cockroach.x,
      cockroach.y,
      cockroach.angle,
      cockroach.modeFrames,
    ];
    if (reference) values.forEach((value, i) => near(value, reference[i]));
    else reference = values;
    mapState.goalCompleted = true;
    const before = globalThis.structuredClone(cockroach);
    updateCockroach(cockroach, farMarble, 100, mapState);
    assert.deepEqual(
      cockroach,
      before,
      "completed maps stop obsolete behavior",
    );
    assert.equal(
      resolveCockroachContact(cockroach, farMarble, farMarble, mapState),
      null,
    );
    const fresh = createCockroach(map);
    assert.equal(fresh.mode, "scurry");
    assert.equal(fresh.contactLatched, false);
    assert.equal(fresh.pendingFrames, 0);
    assert.equal(fresh.knockbackX, 0);
    assert.equal(fresh.harassmentIn, cockroachConfig.harassmentInterval);
  }
}

function testRoamingIsIndependentAndSeparatingContactIsHarmless() {
  const first = fixture();
  const second = fixture();
  advance(
    first.cockroach,
    first.mapState,
    cockroachConfig.harassmentInterval / 2,
    [1],
    farMarble,
  );
  advance(
    second.cockroach,
    second.mapState,
    cockroachConfig.harassmentInterval / 2,
    [1],
    {
      ...farMarble,
      x: -10000,
      y: -10000,
    },
  );
  near(first.cockroach.x, second.cockroach.x);
  near(first.cockroach.y, second.cockroach.y);
  const { cockroach, mapState } = fixture();
  cockroach.mode = "harass";
  cockroach.vx = -cockroachConfig.harassSpeed;
  const previous = { x: cockroach.x - cockroach.r - 28, y: cockroach.y };
  const marble = { ...previous, x: previous.x - 20, r: 29, vx: -14, vy: 0 };
  assert.equal(
    resolveCockroachContact(cockroach, marble, previous, mapState),
    null,
  );
  assert.equal(
    marble.vx,
    -14,
    "an already separating marble receives no false hit",
  );
  assert.equal(cockroach.mode, "harass");
}

function testMovingObstacleRecovery() {
  const { cockroach, mapState } = fixture();
  const obstacle = { x: 990, y: 980, w: 100, h: 100, angle: 0.2 };
  mapState.obstacles.push(obstacle);
  updateCockroach(cockroach, farMarble, 2, mapState);
  assert.equal(circleObstacleContact(cockroach, obstacle).intersects, false);
  const x = cockroach.x;
  const y = cockroach.y;
  advance(cockroach, mapState, 100);
  assert.ok(Math.hypot(cockroach.x - x, cockroach.y - y) > 30);
}

testOnlyKitchenCreatesAnInvulnerableActor();
testHarassmentDisruptsOnceThenDisengages();
testOnlyIncomingStrongMarbleContactRepels();
testGlancingAndSeparatingContactsDoNotRepel();
testSweepAndWallOcclusion();
testAttackIsBoundedAndDoesNotProjectTheMarble();
testHarassmentReacquiresAfterRespiteAndStillTimesOut();
testKitchenRoamingDoesNotLoseThePlayer();
testObstaclesBoundsAndCadence();
testMovingTargetInterpolationAndFreshState();
testRoamingIsIndependentAndSeparatingContactIsHarmless();
testMovingObstacleRecovery();
console.log("Cockroach tests passed.");

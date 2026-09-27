import assert from "node:assert/strict";
import { createCockroach, updateCockroach } from "../core/cockroach.js";
import { cockroachConfig } from "../core/game-config.js";
import { pointInEllipsePatch } from "../core/geometry.js";
import { ELLIPTICAL_SURFACE_SHAPES } from "../core/map-elements.js";

const map = {
  theme: "kitchenFloor",
  world: { width: 4000, height: 4000 },
  cockroach: { x: 1000, y: 1000 },
};
const marble = { x: 3000, y: 3000, vx: 0, vy: 0, r: 29 };

function cereal(x, y, properties = {}) {
  return {
    kind: "cheerio",
    active: true,
    x,
    y,
    radius: 23,
    ...properties,
  };
}

function fixture(cheerios = [], goo = []) {
  const cockroach = createCockroach(map);
  // Isolate its habitat choices from the separate timed attack behavior.
  cockroach.harassmentIn = 100000;
  return {
    cockroach,
    mapState: {
      activeMap: map,
      obstacles: [],
      goalCompleted: false,
      terrainByType: { gooPatch: { elements: goo } },
    },
    kitchenState: { cheerios },
  };
}

function advance(subject, duration, parts = [1]) {
  let elapsed = 0;
  let index = 0;
  while (elapsed < duration - 1e-8) {
    const dt = Math.min(parts[index++ % parts.length], duration - elapsed);
    updateCockroach(
      subject.cockroach,
      marble,
      dt,
      subject.mapState,
      marble,
      subject.kitchenState,
    );
    elapsed += dt;
  }
}

function distanceToFood(cockroach, food) {
  return Math.hypot(cockroach.x - food.x, cockroach.y - food.y);
}

function testScurryApproachesAndStaysNearNearestFood() {
  const nearest = cereal(1400, 1000);
  const subject = fixture([cereal(2200, 1000), nearest]);
  const unchanged = globalThis.structuredClone(subject.kitchenState);
  advance(subject, 200);
  assert.ok(
    distanceToFood(subject.cockroach, nearest) < 180,
    "roaming should close toward the nearest active Cheerio",
  );
  const gait = subject.cockroach.gait;
  for (let i = 0; i < 10; i++) {
    advance(subject, 60);
    assert.ok(
      distanceToFood(subject.cockroach, nearest) < 220,
      "ordinary scurrying stays in the food cluster instead of wandering away",
    );
  }
  assert.ok(
    subject.cockroach.gait > gait,
    "foraging still has visible movement",
  );
  assert.deepEqual(
    subject.kitchenState,
    unchanged,
    "the cockroach must not consume or mutate the ants' food",
  );
}

function testFoodUsesLivePositionsAndActiveState() {
  const food = cereal(1400, 1000);
  const subject = fixture([food]);
  advance(subject, 200);
  food.x += 600;
  food.y += 100;
  advance(subject, 300);
  assert.ok(
    distanceToFood(subject.cockroach, food) < 180,
    "pushed food is followed at its current position, not its authored origin",
  );
  food.active = false;
  const remaining = cereal(2200, 1700);
  subject.kitchenState.cheerios.push(remaining);
  advance(subject, 300);
  assert.ok(
    distanceToFood(subject.cockroach, remaining) < 180,
    "a consumed Cheerio no longer anchors the cockroach",
  );
}

function testCrumbsAndInactiveCerealAreIgnored() {
  const food = cereal(1400, 1000);
  const subject = fixture([
    cereal(900, 1000, { active: false }),
    cereal(900, 1050, { kind: "crumb" }),
    food,
  ]);
  advance(subject, 220);
  assert.ok(
    distanceToFood(subject.cockroach, food) < 180,
    "crumbs and eaten food must not win the habitat selection",
  );
}

function testGooAttractsToItsActualEdgeWithoutMutation() {
  const goo = { type: "gooPatch", x: 1300, y: 800, w: 600, h: 400 };
  const subject = fixture([], [goo]);
  const unchanged = globalThis.structuredClone(goo);
  const shape = ELLIPTICAL_SURFACE_SHAPES.gooPatch;
  advance(subject, 240);
  for (let i = 0; i < 8; i++) {
    assert.ok(
      pointInEllipsePatch(
        subject.cockroach.x,
        subject.cockroach.y,
        goo,
        shape,
        180,
      ),
      "roaming stays near the actual rotated spill rather than an unrelated point",
    );
    assert.equal(
      pointInEllipsePatch(subject.cockroach.x, subject.cockroach.y, goo, shape),
      false,
      "the target is beside the sticky spill, not in its center",
    );
    advance(subject, 60);
  }
  assert.deepEqual(
    goo,
    unchanged,
    "habitat lookup must not resize or move goo",
  );
}

function testFoodDoesNotOverrideAttackingOrRecovering() {
  for (const mode of ["harass", "retreat", "stunned"]) {
    const withFood = fixture([cereal(1000, 600)]);
    const withoutFood = fixture();
    for (const subject of [withFood, withoutFood]) {
      subject.cockroach.mode = mode;
      subject.cockroach.modeFrames = 100;
      subject.cockroach.knockbackX = mode === "stunned" ? 4 : 0;
      advance(subject, 60);
    }
    assert.deepEqual(
      withFood.cockroach,
      withoutFood.cockroach,
      `${mode} behavior must remain independent of food attraction`,
    );
  }
}

function testNoResourceWanderingAndFreshState() {
  const empty = fixture();
  advance(empty, 240);
  assert.ok(
    empty.cockroach.gait > 500,
    "without resources it continues roaming",
  );
  const food = cereal(1400, 1000);
  const used = fixture([food]);
  advance(used, 240);
  used.cockroach = createCockroach(map);
  assert.deepEqual(used.cockroach, createCockroach(map));
  assert.equal(used.cockroach.harassmentIn, cockroachConfig.harassmentInterval);
  used.cockroach.harassmentIn = 100000;
  const newFood = cereal(1000, 1500);
  used.kitchenState.cheerios = [newFood];
  advance(used, 260);
  assert.ok(
    distanceToFood(used.cockroach, newFood) < 180,
    "fresh state acquires the current run's food instead of a stale target",
  );
}

function testForagingDoesNotDependOnFramePartitions() {
  for (const resource of ["food", "goo"]) {
    let reference;
    for (const parts of [[2], [1], [0.5], [0.13, 0.8, 1.17, 2.2]]) {
      const subject = fixture(
        resource === "food" ? [cereal(1400, 1000)] : [],
        resource === "goo" ? [{ x: 1300, y: 800, w: 600, h: 400 }] : [],
      );
      advance(subject, 720, parts);
      const values = [
        subject.cockroach.x,
        subject.cockroach.y,
        subject.cockroach.gait,
        subject.cockroach.angle,
        subject.cockroach.harassmentIn,
      ];
      if (reference) {
        values.forEach((value, index) => {
          assert.ok(
            Math.abs(value - reference[index]) < 1e-7,
            `${resource} foraging differs with frame partitions: ${value} vs ${reference[index]}`,
          );
        });
      } else reference = values;
    }
  }
}

testScurryApproachesAndStaysNearNearestFood();
testFoodUsesLivePositionsAndActiveState();
testCrumbsAndInactiveCerealAreIgnored();
testGooAttractsToItsActualEdgeWithoutMutation();
testFoodDoesNotOverrideAttackingOrRecovering();
testNoResourceWanderingAndFreshState();
testForagingDoesNotDependOnFramePartitions();
console.log("Cockroach foraging tests passed.");

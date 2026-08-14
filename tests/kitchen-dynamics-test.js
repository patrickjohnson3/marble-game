import assert from "node:assert/strict";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";

const world = { width: 1000, height: 1000 };
const waterPatch = { type: "waterPatch", x: 100, y: 420, w: 300, h: 180 };

function kitchenMap(id = "kitchen-floor", elements = [waterPatch]) {
  return { variantId: id, theme: "kitchenFloor", elements };
}

function marbleAt(cheerio, overrides = {}) {
  return {
    x: cheerio.originX + cheerio.pushX,
    y: cheerio.originY + cheerio.pushY,
    vx: 3,
    vy: 0,
    r: 29,
    ...overrides,
  };
}

function update(dynamics, mapConfig, marble, frameDelta = 1) {
  return dynamics.update({
    mapConfig,
    marble,
    previousMarble: marble,
    frameDelta,
  });
}

function testCheerioOnlySoaksAfterPlayerDisturbsIt() {
  const dynamics = createKitchenDynamics();
  const mapConfig = kitchenMap();
  dynamics.reset({ mapConfig, world });
  const cheerio = dynamics.state.cheerios[0];
  const distantMarble = { x: 900, y: 900, vx: 0, vy: 0, r: 29 };

  update(dynamics, mapConfig, distantMarble, 120);
  assert.equal(
    cheerio.waterSoak,
    0,
    "water must not change cereal before the player interacts with it",
  );

  update(dynamics, mapConfig, marbleAt(cheerio));
  assert.equal(
    cheerio.playerDisturbed,
    true,
    "marble contact should activate the authored water interaction",
  );

  update(dynamics, mapConfig, distantMarble, 30);
  assert.equal(
    cheerio.waterSoak > 0,
    true,
    "a player-disturbed Cheerio should soak while resting in water",
  );
  assert.equal(Number.isFinite(cheerio.waterStainX), true);
  assert.equal(Number.isFinite(cheerio.waterStainY), true);
}

testCheerioOnlySoaksAfterPlayerDisturbsIt();

function testWaterSoakPersistsAndClamps() {
  const dynamics = createKitchenDynamics();
  const mapConfig = kitchenMap();
  dynamics.reset({ mapConfig, world });
  const cheerio = dynamics.state.cheerios[0];

  update(dynamics, mapConfig, marbleAt(cheerio));
  update(dynamics, mapConfig, { x: 900, y: 900, vx: 0, vy: 0, r: 29 }, 500);
  assert.equal(
    cheerio.waterSoak,
    1,
    "water soaking should clamp when complete",
  );

  update(
    dynamics,
    kitchenMap("kitchen-floor", []),
    { x: 900, y: 900, vx: 0, vy: 0, r: 29 },
    60,
  );
  assert.equal(
    cheerio.waterSoak,
    1,
    "a waterlogged Cheerio should remain visibly changed outside the puddle",
  );
}

testWaterSoakPersistsAndClamps();

function testWaterSoakIsAuthoredForKitchenFloorOnly() {
  const dynamics = createKitchenDynamics();
  const mapConfig = kitchenMap("kitchen-breakfast-spill");
  dynamics.reset({ mapConfig, world });
  const cheerio = dynamics.state.cheerios[0];

  update(dynamics, mapConfig, marbleAt(cheerio));
  update(dynamics, mapConfig, { x: 900, y: 900, vx: 0, vy: 0, r: 29 }, 120);
  assert.equal(
    cheerio.waterSoak,
    0,
    "the experiment should not silently add behavior to other maps",
  );
}

testWaterSoakIsAuthoredForKitchenFloorOnly();

function testPlayerCanPushSpongeIntoWaterToShrinkPuddle() {
  const authoredWater = {
    type: "waterPatch",
    x: 300,
    y: 400,
    w: 300,
    h: 200,
  };
  const runtimeWaterPatches = [authoredWater];
  const sponge = {
    type: "obstacle",
    fixture: "sponge",
    x: 160,
    y: 430,
    w: 160,
    h: 80,
    hitboxW: 140,
    hitboxH: 70,
    angle: 0,
    collisionCenterX: 240,
    collisionCenterY: 470,
    collisionCos: 1,
    collisionSin: 0,
    collisionHalfWidth: 70,
    collisionHalfHeight: 35,
  };
  const mapConfig = kitchenMap("kitchen-floor", [authoredWater, sponge]);
  const dynamics = createKitchenDynamics();
  dynamics.reset({
    mapConfig,
    obstacles: [sponge],
    waterPatches: runtimeWaterPatches,
    world,
  });
  const runtimeWater = runtimeWaterPatches[0];

  const events = update(
    dynamics,
    mapConfig,
    { x: 141, y: 470, vx: 4, vy: 0, r: 29 },
    1,
  );

  assert.equal(sponge.x > 160, true, "the marble should shove the sponge");
  assert.equal(
    runtimeWater.w < authoredWater.w,
    true,
    "water should contract when the disturbed sponge overlaps it",
  );
  assert.equal(
    Math.abs(
      runtimeWater.x + runtimeWater.w - (authoredWater.x + authoredWater.w),
    ) < 1e-9,
    true,
    "absorption from the left should pull back the contacted edge",
  );
  assert.equal(
    authoredWater.w,
    300,
    "the authored map definition must remain unchanged",
  );
  assert.equal(sponge.saturation > 0, true, "the sponge should become wet");
  assert.equal(events.spongeChanges, 1);
  assert.equal(events.spongeSoaks, 1);
  assert.equal(events.waterChanges, 1);

  const nextEvents = update(
    dynamics,
    mapConfig,
    { x: 900, y: 900, vx: 0, vy: 0, r: 29 },
    1,
  );
  assert.equal(
    nextEvents.spongeSoaks,
    0,
    "absorption feedback should only fire when soaking begins",
  );

  update(dynamics, mapConfig, { x: 900, y: 900, vx: 0, vy: 0, r: 29 }, 200);
  const fullySoakedWater = { ...runtimeWater };
  update(dynamics, mapConfig, { x: 900, y: 900, vx: 0, vy: 0, r: 29 }, 60);
  assert.deepEqual(
    runtimeWater,
    fullySoakedWater,
    "a fully soaked sponge should leave the puddle stable",
  );
}

testPlayerCanPushSpongeIntoWaterToShrinkPuddle();

function spongeImpactAngle(hitY) {
  const authoredWater = {
    type: "waterPatch",
    x: 800,
    y: 800,
    w: 100,
    h: 100,
  };
  const sponge = {
    type: "obstacle",
    fixture: "sponge",
    x: 300,
    y: 400,
    w: 200,
    h: 80,
    hitboxW: 180,
    hitboxH: 70,
    angle: 0,
    collisionCenterX: 400,
    collisionCenterY: 440,
    collisionCos: 1,
    collisionSin: 0,
    collisionHalfWidth: 90,
    collisionHalfHeight: 35,
  };
  const mapConfig = kitchenMap("kitchen-floor", [authoredWater, sponge]);
  const dynamics = createKitchenDynamics();
  dynamics.reset({
    mapConfig,
    obstacles: [sponge],
    waterPatches: [authoredWater],
    world,
  });
  const marble = { x: 283, y: hitY, vx: 5, vy: 0, r: 29 };

  const events = update(dynamics, mapConfig, marble);
  return { angle: sponge.angle, events, marble, sponge };
}

function testOffCenterSpongeImpactCreatesMoreRotation() {
  const centered = spongeImpactAngle(440);
  const offCenter = spongeImpactAngle(410);

  assert.equal(centered.sponge.x > 300, true);
  assert.equal(offCenter.sponge.x > 300, true);
  assert.equal(
    Math.abs(offCenter.angle) > Math.abs(centered.angle),
    true,
    "an end hit should rotate the sponge more than a centered hit",
  );
  assert.equal(
    offCenter.events.spongeImpact > 0,
    true,
    "the coupled collision should report impact feedback",
  );
  assert.equal(
    offCenter.marble.x < offCenter.sponge.collisionCenterX,
    true,
    "collision separation should leave the marble outside the sponge",
  );
}

testOffCenterSpongeImpactCreatesMoreRotation();

function testSpongeRoundedCornerDoesNotCreateFalseImpact() {
  const authoredWater = {
    type: "waterPatch",
    x: 800,
    y: 800,
    w: 100,
    h: 100,
  };
  const sponge = {
    type: "obstacle",
    fixture: "sponge",
    x: 300,
    y: 400,
    w: 200,
    h: 80,
    hitboxW: 180,
    hitboxH: 70,
    angle: 0,
    collisionCenterX: 400,
    collisionCenterY: 440,
    collisionCos: 1,
    collisionSin: 0,
    collisionHalfWidth: 90,
    collisionHalfHeight: 35,
  };
  const mapConfig = kitchenMap("kitchen-floor", [authoredWater, sponge]);
  const dynamics = createKitchenDynamics();
  dynamics.reset({
    mapConfig,
    obstacles: [sponge],
    waterPatches: [authoredWater],
    world,
  });
  const cornerOffset = 25 / Math.SQRT2;
  const marble = {
    x: 400 - 90 - cornerOffset,
    y: 440 - 35 - cornerOffset,
    vx: 4,
    vy: 4,
    r: 29,
  };
  const initialMarble = { x: marble.x, y: marble.y };

  const events = update(dynamics, mapConfig, marble);

  assert.equal(events.spongeImpact, 0);
  assert.equal(sponge.x, 300, "a clear corner pass must not move the sponge");
  assert.equal(marble.x, initialMarble.x);
  assert.equal(marble.y, initialMarble.y);
}

testSpongeRoundedCornerDoesNotCreateFalseImpact();

console.log("Kitchen dynamics tests passed.");

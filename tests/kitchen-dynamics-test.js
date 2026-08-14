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

function testShortEndSpongePushMaintainsContact() {
  const centered = spongeImpactAngle(440);

  assert.equal(centered.sponge.vx > 0, true);
  assert.equal(
    centered.marble.vx >= centered.sponge.vx,
    true,
    "an end-on push should not make the sponge outrun the marble",
  );
}

testShortEndSpongePushMaintainsContact();

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

function cerealAt(x, y, overrides = {}) {
  return {
    originX: x,
    originY: y,
    pushX: 0,
    pushY: 0,
    radius: 20,
    eaten: 0,
    active: true,
    sweptClosestX: 0,
    sweptClosestY: 0,
    sweptDistance: 0,
    waterSoak: 0,
    revision: 0,
    ...overrides,
  };
}

function antAt(x, y, targetIndex = -1) {
  return {
    x,
    y,
    angle: 0,
    alive: true,
    squished: false,
    targetIndex,
    waterAvoidanceFrames: 0,
    wobble: 0,
    revision: 0,
  };
}

function waterAvoidanceDynamics({ ant, cheerios }) {
  const authoredWater = {
    type: "waterPatch",
    x: 300,
    y: 400,
    w: 300,
    h: 200,
  };
  const mapConfig = kitchenMap("kitchen-floor", [authoredWater]);
  const dynamics = createKitchenDynamics();
  dynamics.reset({
    mapConfig,
    obstacles: [],
    waterPatches: [authoredWater],
    world,
  });
  dynamics.state.ants = [ant];
  dynamics.state.cheerios = cheerios;
  return { dynamics, mapConfig };
}

function testAntRecoilsFromWetTargetAndSelectsDryFood() {
  const wet = cerealAt(330, 500, { waterSoak: 1 });
  const dry = cerealAt(100, 500);
  const ant = antAt(308, 500, 0);
  const { dynamics, mapConfig } = waterAvoidanceDynamics({
    ant,
    cheerios: [wet, dry],
  });
  const marble = { x: 900, y: 900, vx: 0, vy: 0, r: 29 };

  update(dynamics, mapConfig, marble);

  assert.equal(ant.x < 308, true, "the ant should recoil from the puddle");
  assert.equal(ant.targetIndex, -1);
  assert.equal(ant.waterAvoidanceFrames > 0, true);
  assert.equal(wet.eaten, 0, "an ant should not eat waterlogged cereal");

  update(dynamics, mapConfig, marble, 20);
  update(dynamics, mapConfig, marble);
  assert.equal(ant.targetIndex, 1, "the ant should select nearby dry food");
}

testAntRecoilsFromWetTargetAndSelectsDryFood();

function testAntSteersAroundWaterTowardDryFood() {
  const dry = cerealAt(800, 500);
  const ant = antAt(308, 500);
  const { dynamics, mapConfig } = waterAvoidanceDynamics({
    ant,
    cheerios: [dry],
  });

  update(dynamics, mapConfig, { x: 900, y: 900, vx: 0, vy: 0, r: 29 });

  assert.equal(ant.targetIndex, 0, "dry food should remain the target");
  assert.equal(ant.x < 308, true, "avoidance should bias away from the water");
  assert.notEqual(ant.y, 500, "avoidance should turn along the puddle edge");

  let enteredPuddleCore = false;
  for (let frame = 0; frame < 1000; frame++) {
    update(dynamics, mapConfig, { x: 900, y: 900, vx: 0, vy: 0, r: 29 });
    const puddleX = (ant.x - 450) / 132;
    const puddleY = (ant.y - 504) / 70;
    enteredPuddleCore ||= puddleX * puddleX + puddleY * puddleY <= 1;
  }
  assert.equal(enteredPuddleCore, false, "the ant must not cross the puddle");
  assert.equal(dry.eaten > 0, true, "the ant should route around to dry food");
}

testAntSteersAroundWaterTowardDryFood();

console.log("Kitchen dynamics tests passed.");

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
}

testPlayerCanPushSpongeIntoWaterToShrinkPuddle();

console.log("Kitchen dynamics tests passed.");

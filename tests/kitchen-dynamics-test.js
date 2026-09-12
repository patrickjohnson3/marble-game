import { resolvedMapConfig } from "../core/map-config.js";
import assert from "node:assert/strict";
import { antConfig } from "../core/game-config.js";
import { pointInEllipsePatch } from "../core/geometry.js";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
import { ELLIPTICAL_SURFACE_SHAPES } from "../core/map-elements.js";
import { circleOrientedRectContact } from "../core/physics-collisions.js";

const world = { width: 1000, height: 1000 };
const waterPatch = { type: "waterPatch", x: 100, y: 420, w: 300, h: 180 };

function kitchenMap(id = "kitchen-floor", elements = [waterPatch]) {
  return {
    variantId: id,
    theme: "kitchenFloor",
    clusters: resolvedMapConfig.clusters,
    elements,
  };
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
  return dynamics.update(mapConfig, marble, marble, frameDelta);
}

function testCheerioOnlySoaksAfterPlayerDisturbsIt() {
  const dynamics = createKitchenDynamics();
  const mapConfig = kitchenMap();
  dynamics.reset({ mapConfig, world });
  const cheerio = dynamics.state.cheerios[0];
  cheerio.originX = 250;
  cheerio.originY = 510;
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
  cheerio.originX = 250;
  cheerio.originY = 510;

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
  cheerio.originX = 250;
  cheerio.originY = 510;

  update(dynamics, mapConfig, marbleAt(cheerio));
  update(dynamics, mapConfig, { x: 900, y: 900, vx: 0, vy: 0, r: 29 }, 120);
  assert.equal(
    cheerio.waterSoak,
    0,
    "the experiment should not silently add behavior to other maps",
  );
}

testWaterSoakIsAuthoredForKitchenFloorOnly();

function testCerealWaitsForVisibleMarbleContact() {
  for (const kind of ["cheerio", "crumb"]) {
    const dynamics = createKitchenDynamics();
    const mapConfig = kitchenMap("kitchen-floor", []);
    dynamics.reset({ mapConfig, world });
    const cereal = dynamics.state.cheerios.find(
      (candidate) => candidate.kind === kind,
    );
    const marbleRadius = 29;

    update(dynamics, mapConfig, {
      x: cereal.originX - cereal.radius - marbleRadius - 5,
      y: cereal.originY,
      vx: 8,
      vy: 0,
      r: marbleRadius,
    });

    assert.equal(cereal.pushX, 0, `${kind} should not move before contact`);
  }
}

testCerealWaitsForVisibleMarbleContact();

function testCerealCarriesMomentumAfterMarbleContact() {
  for (const kind of ["cheerio", "crumb"]) {
    const dynamics = createKitchenDynamics();
    const mapConfig = kitchenMap("kitchen-floor", []);
    dynamics.reset({ mapConfig, world });
    const cereal = dynamics.state.cheerios.find(
      (candidate) => candidate.kind === kind,
    );

    update(dynamics, mapConfig, marbleAt(cereal, { vx: 8 }));
    const pushAfterContact = cereal.pushX;
    update(dynamics, mapConfig, {
      x: 900,
      y: 900,
      vx: 0,
      vy: 0,
      r: 29,
    });

    assert.equal(
      cereal.pushX > pushAfterContact,
      true,
      `${kind} should keep moving after the marble leaves contact`,
    );
  }
}

testCerealCarriesMomentumAfterMarbleContact();

function testPlayerCanPushSpongeIntoWaterToShrinkPuddle() {
  const authoredWater = {
    type: "waterPatch",
    x: 300,
    y: 400,
    w: 300,
    h: 200,
  };
  const runtimeWater = { ...authoredWater };
  const runtimeWaterPatches = [runtimeWater];
  const sponge = {
    type: "obstacle",
    fixture: "sponge",
    x: 225,
    y: 430,
    w: 160,
    h: 80,
    hitboxW: 140,
    hitboxH: 70,
    angle: 0,
    collisionCenterX: 305,
    collisionCenterY: 470,
    collisionCos: 1,
    collisionSin: 0,
    collisionHalfWidth: 70,
    collisionHalfHeight: 35,
  };
  const mapConfig = kitchenMap("kitchen-floor", [runtimeWater, sponge]);
  const dynamics = createKitchenDynamics();
  dynamics.reset({
    mapConfig,
    obstacles: [sponge],
    waterPatches: runtimeWaterPatches,
    world,
  });
  assert.equal(
    dynamics.state.waterPatch,
    runtimeWater,
    "kitchen behavior should mutate the authoritative runtime water patch",
  );

  const events = update(
    dynamics,
    mapConfig,
    { x: 206, y: 470, vx: 4, vy: 0, r: 29 },
    1,
  );

  assert.equal(sponge.x > 225, true, "the marble should shove the sponge");
  assert.equal(
    runtimeWater.w < authoredWater.w,
    true,
    "water should contract when the disturbed sponge overlaps it",
  );
  assert.equal(
    Math.abs(
      runtimeWater.x + runtimeWater.w - (authoredWater.x + authoredWater.w),
    ) < 0.1,
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

function testSpongeDoesNotSoakInTransparentPuddleCorner() {
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

  const events = update(dynamics, mapConfig, {
    x: 141,
    y: 470,
    vx: 4,
    vy: 0,
    r: 29,
  });

  assert.equal(sponge.x > 160, true, "the marble should shove the sponge");
  assert.equal(sponge.saturation, 0);
  assert.equal(events.spongeSoaks, 0);
  assert.equal(runtimeWaterPatches[0].w, authoredWater.w);
  assert.equal(runtimeWaterPatches[0].h, authoredWater.h);
}

testSpongeDoesNotSoakInTransparentPuddleCorner();

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

function testSpongeContinuesMovingAwayFromItsStartingPoint() {
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
  sponge.x += 319;
  sponge.collisionCenterX += 319;
  sponge.vx = 3.5;
  const distantMarble = { x: 50, y: 50, vx: 0, vy: 0, r: 29 };

  update(dynamics, mapConfig, distantMarble);
  const firstX = sponge.x;
  update(dynamics, mapConfig, distantMarble);

  assert.equal(
    sponge.x > firstX,
    true,
    "the sponge should keep moving instead of stopping at an invisible tether",
  );
}

testSpongeContinuesMovingAwayFromItsStartingPoint();

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

const farFromAnts = { x: -1000, y: -1000, vx: 0, vy: 0, r: 29 };

function antScene({ elements = [], cheerios = [cerealAt(800, 500)] } = {}) {
  const mapConfig = kitchenMap("kitchen-breakfast-spill", elements);
  const dynamics = createKitchenDynamics();
  dynamics.reset({ mapConfig, world });
  const ant = dynamics.state.ants[0];
  Object.assign(ant, { x: 300, y: 500, angle: 0, probeInFrames: 150 });
  dynamics.state.ants = [ant];
  dynamics.state.cheerios = cheerios;
  return { dynamics, mapConfig, ant };
}

function testAntsProbeWithoutSlidingTheirFeetAndResumeSearching() {
  const { dynamics, mapConfig, ant } = antScene({ cheerios: [] });
  ant.probeInFrames = 1;
  const gaitBefore = ant.gaitPhase;
  const antennaBefore = ant.antennaPhase;
  update(dynamics, mapConfig, farFromAnts);
  assert.equal(ant.mode, "probe");
  assert.equal(ant.x, 300);
  assert.equal(ant.y, 500);
  assert.equal(ant.gaitPhase, gaitBefore);
  assert.notEqual(ant.antennaPhase, antennaBefore);

  update(dynamics, mapConfig, farFromAnts, 30);
  assert.equal(ant.mode, "forage");
  assert.equal(ant.x > 300, true, "an ant without food keeps exploring");
  assert.notEqual(ant.gaitPhase, gaitBefore);
  const beforeZeroTime = { ...ant };
  update(dynamics, mapConfig, farFromAnts, 0);
  assert.deepEqual(ant, beforeZeroTime, "zero time must not animate an ant");
}

testAntsProbeWithoutSlidingTheirFeetAndResumeSearching();

function testAntHesitatesThenEscapesButCanBeCaught() {
  const { dynamics, mapConfig, ant } = antScene();
  const marble = { x: 220, y: 500, vx: 4, vy: 0, r: 29 };
  update(dynamics, mapConfig, marble);
  assert.equal(ant.mode, "probe", "the ant needs time to sense the approach");
  assert.equal(ant.x, 300, "threat sensing should read as a brief hesitation");
  update(dynamics, mapConfig, marble, Math.ceil(ant.reactionFrames));
  assert.equal(ant.mode, "flee");
  assert.equal(ant.x > 300, true);

  let squishes = 0;
  for (let frame = 0; frame < 60; frame++) {
    const previousMarble = { ...marble };
    marble.x += marble.vx;
    squishes += dynamics.update(mapConfig, marble, previousMarble).squishedAnts;
  }
  assert.equal(ant.squished, true, "a committed pursuit must catch the ant");
  assert.equal(squishes, 1, "pursuit must produce only one fresh crush");
}

testAntHesitatesThenEscapesButCanBeCaught();

function testAntRemembersNearMissThenReturnsToForaging() {
  const { dynamics, mapConfig, ant } = antScene();
  ant.x = 500;
  const marble = { x: 650, y: 460, vx: 14, vy: 0, r: 29 };
  const events = dynamics.update(mapConfig, marble, { x: 350, y: 460 });
  assert.equal(events.squishedAnts, 0, "a clear near miss is not a kill");
  assert.equal(ant.mode, "probe");
  update(dynamics, mapConfig, farFromAnts, Math.ceil(ant.reactionFrames));
  assert.equal(ant.mode, "flee", "the delayed reaction survives a fast pass");
  update(dynamics, mapConfig, farFromAnts, antConfig.fleeDurationFrames + 30);
  assert.equal(ant.fleeFrames, 0, "escape has a finite duration");
  assert.equal(ant.mode, "forage", "a missed ant resumes its food search");
  assert.equal(ant.alive, true);
}

testAntRemembersNearMissThenReturnsToForaging();

function testSweptAntCrushSettlesOnceAndPersistsUntilReset() {
  const { dynamics, mapConfig, ant } = antScene({ cheerios: [] });
  const events = dynamics.update(
    mapConfig,
    { x: 400, y: 500, vx: 12, vy: 0, r: 29 },
    { x: 200, y: 500 },
  );
  const crushList = events.antCrushes;
  assert.equal(events.squishedAnts, 1);
  assert.deepEqual(crushList, [ant]);
  assert.equal(ant.mode, "squished");
  assert.equal(ant.squishAge, 0);
  assert.equal(ant.squishAngle, 0);
  assert.equal(ant.squishStrength, 1);
  update(dynamics, mapConfig, farFromAnts, antConfig.squishDurationFrames);
  assert.equal(events.antCrushes, crushList, "the small event list is reused");
  assert.equal(crushList.length, 0, "crush events must not replay next frame");
  assert.equal(ant.squishAge, antConfig.squishDurationFrames);
  const settled = { ...ant };
  update(dynamics, mapConfig, farFromAnts, 120);
  assert.deepEqual(ant, settled, "settled remains neither move nor animate");

  dynamics.state.frameIndex = 100;
  update(dynamics, mapConfig, { x: ant.x, y: ant.y, vx: 1, vy: 0, r: 29 });
  assert.equal(events.splatHits, 1);
  assert.equal(events.squishedAnts, 0);
  assert.equal(events.antCrushes.length, 0);
  dynamics.reset({ mapConfig, world });
  assert.equal(
    dynamics.state.ants.every((next) => next.alive && !next.squished),
    true,
  );
  assert.equal(events.antCrushes.length, 0);
}

testSweptAntCrushSettlesOnceAndPersistsUntilReset();

function testAntCrushUsesTravelBeforeTheMarbleStops() {
  const { dynamics, mapConfig, ant } = antScene({ cheerios: [] });
  const marble = { x: 308, y: 500, vx: -0.2, vy: 0, r: 29 };
  const events = dynamics.update(mapConfig, marble, { x: 292, y: 500 });
  assert.equal(
    events.squishedAnts,
    1,
    "a later wall impact cannot undo rolling over an ant",
  );
  assert.equal(
    ant.squishAngle,
    0,
    "the imprint follows the contact travel, not the rebound",
  );

  const slowScene = antScene({ cheerios: [] });
  update(slowScene.dynamics, slowScene.mapConfig, marble);
  assert.equal(
    slowScene.ant.alive,
    true,
    "mere stationary overlap is not a crush",
  );
}

testAntCrushUsesTravelBeforeTheMarbleStops();

function testAntRoutesAroundRotatedUtensilWithoutCrossingIt() {
  const obstacle = {
    type: "obstacle",
    x: 420,
    y: 420,
    w: 80,
    h: 160,
    angle: 0.45,
  };
  const food = cerealAt(800, 500);
  const { dynamics, mapConfig, ant } = antScene({
    elements: [obstacle],
    cheerios: [food],
  });
  for (let frame = 0; frame < 1100; frame++) {
    update(dynamics, mapConfig, farFromAnts);
    const contact = circleOrientedRectContact(
      { x: ant.x, y: ant.y, r: antConfig.radius },
      obstacle,
    );
    assert.equal(
      contact.intersects,
      false,
      "the ant must stay outside the utensil hitbox",
    );
  }
  assert.equal(
    food.eaten > 0,
    true,
    "obstacle avoidance must still reach the food",
  );
}

testAntRoutesAroundRotatedUtensilWithoutCrossingIt();

function testAntAvoidsEveryKitchenLiquidAndFindsDryFood() {
  for (const type of ["waterPatch", "gooPatch"]) {
    const patch = { type, x: 350, y: 400, w: 240, h: 200 };
    const food = cerealAt(800, 500);
    const inaccessible = cerealAt(470, 500);
    const { dynamics, mapConfig, ant } = antScene({
      elements: [patch],
      cheerios: [inaccessible, food],
    });
    for (let frame = 0; frame < 1100; frame++) {
      update(dynamics, mapConfig, farFromAnts);
      assert.equal(
        pointInEllipsePatch(
          ant.x,
          ant.y,
          patch,
          ELLIPTICAL_SURFACE_SHAPES[type],
        ),
        false,
        `an ant must not walk through ${type} on the second kitchen map`,
      );
    }
    assert.equal(inaccessible.eaten, 0);
    assert.equal(
      food.eaten > 0,
      true,
      "dry food must remain reachable around the spill",
    );
  }
}

testAntAvoidsEveryKitchenLiquidAndFindsDryFood();

function testAntCaughtInsideSpillSlowsAndCanEscape() {
  const distances = {};
  for (const type of [null, "waterPatch", "gooPatch"]) {
    const patch = { type, x: 350, y: 400, w: 240, h: 200 };
    const { dynamics, mapConfig, ant } = antScene({
      elements: type ? [patch] : [],
    });
    ant.x = 470;
    update(dynamics, mapConfig, farFromAnts);
    distances[type ?? "floor"] = Math.hypot(ant.x - 470, ant.y - 500);
    for (let frame = 0; frame < 1400; frame++)
      update(dynamics, mapConfig, farFromAnts);
    if (type) {
      assert.equal(
        pointInEllipsePatch(
          ant.x,
          ant.y,
          patch,
          ELLIPTICAL_SURFACE_SHAPES[type],
        ),
        false,
        "an ant stranded inside a spill must be able to walk out",
      );
    }
    assert.equal(ant.alive, true, "a spill itself does not count as a crush");
  }
  assert.equal(distances.gooPatch > 0, true);
  assert.equal(distances.gooPatch < distances.waterPatch, true);
  assert.equal(distances.waterPatch < distances.floor, true);
}

testAntCaughtInsideSpillSlowsAndCanEscape();

function testNearbyAntsShareFoodWithoutMarchingInLockstep() {
  const { dynamics, mapConfig, ant } = antScene();
  ant.y = 492;
  const other = {
    ...ant,
    y: 508,
    speedScale: 1.01,
    turnBias: -1,
    wobble: 1.7,
    antennaPhase: 1.3,
    probeInFrames: 190,
  };
  dynamics.state.ants.push(other);
  let differentActivities = false;
  let sharedMeal = false;
  for (let frame = 0; frame < 900; frame++) {
    update(dynamics, mapConfig, farFromAnts);
    differentActivities ||= ant.mode !== other.mode;
    sharedMeal ||= ant.mode === "eat" && other.mode === "eat";
    assert.equal(
      Math.hypot(ant.x - other.x, ant.y - other.y) > antConfig.radius,
      true,
      "neighboring foragers should not collapse onto the same point",
    );
  }
  assert.equal(
    differentActivities,
    true,
    "nearby ants keep individual rhythms",
  );
  assert.equal(
    sharedMeal,
    true,
    "separation should still let both ants reach food",
  );
}

testNearbyAntsShareFoodWithoutMarchingInLockstep();

function testAntColonyIsDeterministicIndividualAndContained() {
  const mapConfig = kitchenMap("kitchen-floor", []);
  const first = createKitchenDynamics();
  const second = createKitchenDynamics();
  for (const dynamics of [first, second]) {
    dynamics.reset({ mapConfig, world });
    dynamics.state.cheerios = [];
  }
  const initialAnts = first.state.ants.map((ant) => ({ ...ant }));
  const pausedAnts = new Set();
  for (let frame = 0; frame < 420; frame++) {
    for (const dynamics of [first, second])
      update(dynamics, mapConfig, farFromAnts);
    first.state.ants.forEach((ant, index) => {
      if (ant.mode === "probe") pausedAnts.add(index);
      assert.equal(
        ant.x >= antConfig.radius && ant.x <= world.width - antConfig.radius,
        true,
      );
      assert.equal(
        ant.y >= antConfig.radius && ant.y <= world.height - antConfig.radius,
        true,
      );
    });
  }
  assert.deepEqual(first.state.ants, second.state.ants);
  assert.equal(pausedAnts.size, initialAnts.length);
  assert.equal(
    new Set(initialAnts.map((ant) => ant.probeInFrames)).size,
    initialAnts.length,
  );
  assert.equal(
    new Set(initialAnts.map((ant) => ant.speedScale)).size,
    initialAnts.length,
  );
  assert.equal(
    first.state.ants.every(
      (ant, index) =>
        Math.hypot(ant.x - initialAnts[index].x, ant.y - initialAnts[index].y) >
        10,
    ),
    true,
  );
  first.reset({ mapConfig, world });
  assert.deepEqual(
    first.state.ants,
    initialAnts,
    "retry restores the same colony and phases",
  );
}

testAntColonyIsDeterministicIndividualAndContained();

console.log("Kitchen dynamics tests passed.");

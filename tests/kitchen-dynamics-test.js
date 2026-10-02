import { resolvedMapConfig } from "../core/map-config.js";
import assert from "node:assert/strict";
import {
  antConfig,
  physicsConfig,
  hapticTuning,
  tuning,
} from "../core/game-config.js";
import { createHapticsController } from "../core/haptics.js";
import { updatePhysics } from "../core/physics.js";
import { pointInEllipsePatch } from "../core/geometry.js";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
import { ELLIPTICAL_SURFACE_SHAPES } from "../core/map-elements.js";
import { createResolvedMapState } from "../core/map-runtime.js";
import { validateMapConfig } from "../core/map-validation.js";
import {
  circleOrientedRectContact,
  handleWallCollisions,
} from "../core/physics-collisions.js";

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

function reset(dynamics, mapConfig) {
  dynamics.reset({
    mapConfig,
    world,
    obstacles: createResolvedMapState({ ...mapConfig, world }).obstacles,
  });
}

function marbleAt(cheerio, overrides = {}) {
  return {
    x: cheerio.x,
    y: cheerio.y,
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
  reset(dynamics, mapConfig);
  const cheerio = dynamics.state.cheerios[0];
  cheerio.x = 250;
  cheerio.y = 510;
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
  reset(dynamics, mapConfig);
  const cheerio = dynamics.state.cheerios[0];
  cheerio.x = 250;
  cheerio.y = 510;

  update(dynamics, mapConfig, marbleAt(cheerio));
  update(dynamics, mapConfig, { x: 900, y: 900, vx: 0, vy: 0, r: 29 }, 500);
  assert.equal(
    cheerio.waterSoak,
    1,
    "water soaking should clamp when complete",
  );

  cheerio.x = 800;
  cheerio.y = 800;
  update(dynamics, mapConfig, { x: 900, y: 900, vx: 0, vy: 0, r: 29 }, 60);
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
  reset(dynamics, mapConfig);
  const cheerio = dynamics.state.cheerios[0];
  cheerio.x = 250;
  cheerio.y = 510;

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
    reset(dynamics, mapConfig);
    const cereal = dynamics.state.cheerios.find(
      (candidate) => candidate.kind === kind,
    );
    const marbleRadius = 29;
    const initialX = cereal.x;

    update(dynamics, mapConfig, {
      x: cereal.x - cereal.radius - marbleRadius - 5,
      y: cereal.y,
      vx: 8,
      vy: 0,
      r: marbleRadius,
    });

    assert.equal(cereal.x, initialX, `${kind} should not move before contact`);
  }
}

testCerealWaitsForVisibleMarbleContact();

function testCerealCarriesMomentumAfterMarbleContact() {
  for (const kind of ["cheerio", "crumb"]) {
    const dynamics = createKitchenDynamics();
    const mapConfig = kitchenMap("kitchen-floor", []);
    reset(dynamics, mapConfig);
    const cereal = dynamics.state.cheerios.find(
      (candidate) => candidate.kind === kind,
    );

    update(dynamics, mapConfig, marbleAt(cereal, { vx: 8 }));
    const xAfterContact = cereal.x;
    update(dynamics, mapConfig, {
      x: 900,
      y: 900,
      vx: 0,
      vy: 0,
      r: 29,
    });

    assert.equal(
      cereal.x > xAfterContact,
      true,
      `${kind} should keep moving after the marble leaves contact`,
    );
  }
}

testCerealCarriesMomentumAfterMarbleContact();

function testGrazingCerealSweepTransfersFirstContactMomentum() {
  for (const [alongX, alongY] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    for (const side of [-1, 1]) {
      const sideX = -alongY * side;
      const sideY = alongX * side;
      for (const dt of [0.5, 1, 2]) {
        const dynamics = createKitchenDynamics();
        const mapConfig = { ...kitchenMap("kitchen-floor", []), clusters: [] };
        reset(dynamics, mapConfig);
        const cereal = cerealAt(500, 500, {
          kind: "cheerio",
          radius: 21,
          vx: 0,
          vy: 0,
          lastHitFeedbackFrame: Number.NEGATIVE_INFINITY,
        });
        dynamics.state.cheerios = [cereal];
        const previous = {
          x: 500 - alongX * 16 - sideX * 48,
          y: 500 - alongY * 16 - sideY * 48,
        };
        dynamics.update(
          mapConfig,
          {
            x: previous.x + alongX * 16 * dt,
            y: previous.y + alongY * 16 * dt,
            vx: alongX * 16,
            vy: alongY * 16,
            r: 29,
          },
          previous,
          dt,
        );
        // The combined radius is 50; the first contact is a 14-48-50
        // triangle, giving normal (0.28, 0.96) in travel/side coordinates.
        // Project 16 onto it, then apply the existing 42% floor transfer.
        assert.ok(
          Math.abs(cereal.vx * alongX + cereal.vy * alongY - 0.526848) < 1e-10,
        );
        assert.ok(
          Math.abs(cereal.vx * sideX + cereal.vy * sideY - 1.806336) < 1e-10,
        );
        if (dt === 2) {
          assert.equal(cereal.x, 500 + sideX * 2.5);
          assert.equal(cereal.y, 500 + sideY * 2.5);
        }
      }
    }
  }
}

function testCerealTangencyAndSeparatingOverlapDoNotGainMomentum() {
  for (const [startX, endX, y, vx] of [
    [484, 516, 450, 16],
    [480, 478, 500, -2],
  ]) {
    const dynamics = createKitchenDynamics();
    const mapConfig = { ...kitchenMap("kitchen-floor", []), clusters: [] };
    reset(dynamics, mapConfig);
    const cereal = cerealAt(500, 500, {
      kind: "cheerio",
      radius: 21,
      vx: 0,
      vy: 0,
    });
    dynamics.state.cheerios = [cereal];
    dynamics.update(
      mapConfig,
      { x: endX, y, vx, vy: 0, r: 29 },
      { x: startX, y },
      2,
    );
    assert.equal(cereal.vx, 0);
    assert.equal(cereal.vy, 0);
    if (y === 450) {
      assert.equal(cereal.x, 500);
      assert.equal(cereal.y, 500);
    }
  }
}

testGrazingCerealSweepTransfersFirstContactMomentum();
testCerealTangencyAndSeparatingOverlapDoNotGainMomentum();

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

function testSpongeRemainsSolidAndPushableWithoutWater() {
  const config = {
    ...resolvedMapConfig,
    elements: resolvedMapConfig.elements.filter(
      (element) => element.type !== "waterPatch",
    ),
  };
  assert.deepEqual(
    validateMapConfig(config),
    [],
    "a dry kitchen is a valid authored map",
  );
  const runtime = createResolvedMapState(config);
  const dynamics = createKitchenDynamics();
  dynamics.reset({
    mapConfig: runtime.activeMap,
    obstacles: runtime.obstacles,
    waterPatches: runtime.terrainByType.waterPatch.elements,
    world: runtime.activeMap.world,
  });
  const sponge = dynamics.state.sponge;
  const initialPosition = { x: sponge.x, y: sponge.y };
  const cos = Math.cos(sponge.angle);
  const sin = Math.sin(sponge.angle);
  // Overlap the middle of the left face by five world units.
  const offset = sponge.hitboxW / 2 + 29 - 5;
  const marble = {
    x: sponge.collisionCenterX - cos * offset,
    y: sponge.collisionCenterY - sin * offset,
    r: 29,
    vx: 10 * cos,
    vy: 10 * sin,
  };
  const previous = { ...marble };
  const resolveWalls = () =>
    handleWallCollisions(
      {
        marble,
        obstacles: runtime.obstacles,
        bounds: {
          left: 0,
          top: 0,
          right: config.world.width,
          bottom: config.world.height,
        },
        intro: { released: true },
        physics: physicsConfig,
      },
      () => {},
    );
  resolveWalls();
  const events = dynamics.update(
    runtime.activeMap,
    marble,
    previous,
    1,
    null,
    resolveWalls,
  );

  assert.ok(
    events.spongeImpact > 0,
    "the dry sponge still receives the marble impact",
  );
  assert.equal(circleOrientedRectContact(marble, sponge).intersects, false);
  assert.ok(
    Math.hypot(sponge.x - initialPosition.x, sponge.y - initialPosition.y) > 0,
  );
  assert.equal(events.spongeChanges, 1);
  assert.equal(sponge.saturation, 0);
  assert.equal(events.spongeSoaks, 0);
  assert.equal(events.waterChanges, 0);

  const pushedPosition = { x: sponge.x, y: sponge.y };
  update(dynamics, runtime.activeMap, { x: 29, y: 29, r: 29, vx: 0, vy: 0 });
  assert.ok(
    Math.hypot(sponge.x - pushedPosition.x, sponge.y - pushedPosition.y) > 0,
    "the dry sponge retains momentum after contact ends",
  );
}

testSpongeRemainsSolidAndPushableWithoutWater();

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
    x,
    y,
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
  reset(dynamics, mapConfig);
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

function testFreshCrushScaresNearbySurvivorsRegardlessOfArrayOrder() {
  for (const victimFirst of [true, false]) {
    const food = cerealAt(380, 500);
    const { dynamics, mapConfig, ant: victim } = antScene({ cheerios: [food] });
    Object.assign(victim, { x: 500, y: 500 });
    const probing = {
      ...victim,
      y: 620,
      angle: Math.PI / 2,
      probeFrames: 100,
      recoverFrames: 45,
    };
    const eating = { ...victim, x: 380, angle: Math.PI, targetIndex: 0 };
    const distant = { ...probing, y: 900 };
    const remains = {
      ...victim,
      y: 660,
      alive: false,
      squished: true,
      mode: "squished",
      squishAge: antConfig.squishDurationFrames,
    };
    const settledRemains = { ...remains };
    const survivors = [probing, eating, distant, remains];
    dynamics.state.ants = victimFirst
      ? [victim, ...survivors]
      : [...survivors, victim];

    const events = dynamics.update(
      mapConfig,
      { x: 650, y: 500, vx: 12, vy: 0, r: 29 },
      { x: 450, y: 500 },
    );

    assert.equal(events.squishedAnts, 1);
    assert.deepEqual(events.antCrushes, [victim]);
    for (const survivor of [probing, eating]) {
      assert.equal(survivor.alive, true, "the alarm must not kill a survivor");
      assert.equal(survivor.mode, "flee", "nearby ants must flee immediately");
      assert.ok(survivor.fleeFrames > 0);
      assert.ok(
        Math.hypot(survivor.x - 500, survivor.y - 500) > 120,
        "escape must move away from the crush, even after the marble passes",
      );
    }
    assert.equal(food.eaten, 0, "alarm interrupts feeding in the crush frame");
    assert.notEqual(distant.mode, "flee", "distant ants must remain unaware");
    assert.equal(distant.fleeFrames, 0);
    assert.deepEqual(remains, settledRemains, "dead ants cannot react");
  }
}

testFreshCrushScaresNearbySurvivorsRegardlessOfArrayOrder();

function testCrushEscapeRemembersTheLocationAfterTheMarblePasses() {
  const { dynamics, mapConfig, ant: victim } = antScene({ cheerios: [] });
  const survivor = { ...victim, x: 400, y: 580, angle: 0 };
  dynamics.state.ants.push(survivor);
  const marble = { x: 600, y: 500, vx: 12, vy: 0, r: 29 };
  dynamics.update(mapConfig, marble, { x: 280, y: 500 });
  update(dynamics, mapConfig, marble, 12);

  assert.equal(survivor.mode, "flee");
  assert.ok(
    Math.cos(survivor.angle) > 0 && survivor.x > 400,
    "escape must continue rightward from the crush, not turn back from the marble",
  );
}

testCrushEscapeRemembersTheLocationAfterTheMarblePasses();

function testCrushAlarmExpiresDoesNotReplayAndResets() {
  const { dynamics, mapConfig, ant: victim } = antScene({ cheerios: [] });
  const survivor = { ...victim, y: 620, angle: Math.PI / 2 };
  dynamics.state.ants.push(survivor);
  update(dynamics, mapConfig, { x: 300, y: 500, vx: 3, vy: 0, r: 29 });
  const initialEscape = survivor.fleeFrames;
  assert.ok(initialEscape > 0);

  const events = update(dynamics, mapConfig, farFromAnts, 5);
  assert.equal(events.antCrushes.length, 0, "a crush event must not replay");
  assert.equal(survivor.fleeFrames, initialEscape - 5);
  update(dynamics, mapConfig, farFromAnts, initialEscape + 30);
  assert.equal(survivor.fleeFrames, 0);
  assert.equal(survivor.mode, "forage", "survivors resume normal behavior");

  // Trigger another real alarm, then Retry while the survivor is still fleeing.
  const nextVictim = { ...victim, alive: true, squished: false };
  Object.assign(survivor, { x: 300, y: 620 });
  dynamics.state.ants = [nextVictim, survivor];
  update(dynamics, mapConfig, { x: 300, y: 500, vx: 3, vy: 0, r: 29 });
  assert.ok(survivor.fleeFrames > 0);
  reset(dynamics, mapConfig);
  assert.ok(
    dynamics.state.ants.every((ant) => ant.alive && ant.fleeFrames === 0),
    "Retry must discard the previous colony's alarm",
  );
  assert.equal(events.antCrushes.length, 0);
}

testCrushAlarmExpiresDoesNotReplayAndResets();

function testSlowOverlapDoesNotScareNearbyAnts() {
  const { dynamics, mapConfig, ant: victim } = antScene({ cheerios: [] });
  const survivor = { ...victim, y: 620, angle: Math.PI / 2 };
  dynamics.state.ants.push(survivor);
  const events = update(dynamics, mapConfig, {
    x: 300,
    y: 500,
    vx: 0.1,
    vy: 0,
    r: 29,
  });
  assert.equal(events.squishedAnts, 0);
  assert.equal(victim.alive, true);
  assert.equal(
    survivor.fleeFrames,
    0,
    "an incidental bump is not a kill alarm",
  );
}

testSlowOverlapDoesNotScareNearbyAnts();

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
  reset(dynamics, mapConfig);
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
    reset(dynamics, mapConfig);
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
  reset(first, mapConfig);
  assert.deepEqual(
    first.state.ants,
    initialAnts,
    "retry restores the same colony and phases",
  );
}

testAntColonyIsDeterministicIndividualAndContained();

function testAntCrushIncludesResolvedReboundPath() {
  const wall = { type: "obstacle", x: 200, y: 0, w: 20, h: 1000 };
  const mapConfig = {
    ...kitchenMap("kitchen-floor", [wall]),
    clusters: [
      {
        x: 0.18,
        y: 0.5345,
        angle: 0,
        ants: [[0, 0]],
        cheerios: [],
        crumbs: [],
      },
    ],
  };
  const dynamics = createKitchenDynamics();
  reset(dynamics, mapConfig);
  const marble = { x: 160, y: 500, r: 29, vx: 14, vy: 0 };
  const previous = { ...marble };
  const context = {
    marble,
    physics: physicsConfig,
    tilt: { smoothX: 0, smoothY: 0 },
    intro: { released: true },
    bounds: { left: 0, top: 0, right: 1000, bottom: 1000 },
    mapState: { obstacles: [wall], terrainByType: {} },
  };
  updatePhysics(context, 2, { onSurface() {} });
  // Wall contact places the center at 200 - 29 = 171. That point is
  // sqrt(9² + 34.5²) = 35.655 from the ant, inside their combined radius 36.
  assert.ok(marble.x < 168, "the final position has already rebounded");
  const events = dynamics.update(
    mapConfig,
    marble,
    previous,
    2,
    context.physicsScratch?.movementPath,
  );
  assert.equal(
    events.squishedAnts,
    1,
    "the rebound must not erase an earlier crush",
  );
  const ant = dynamics.state.ants[0];
  assert.equal(ant.alive, false);
  assert.equal(ant.squishAngle, 0, "the crush follows incoming travel");
  assert.equal(ant.squishAge, 0);

  Object.assign(marble, { x: 500, vx: 0 });
  updatePhysics(context, 1, { onSurface() {} });
  dynamics.update(
    mapConfig,
    marble,
    marble,
    1,
    context.physicsScratch.movementPath,
  );
  assert.equal(events.squishedAnts, 0);
  assert.equal(
    ant.squishAge,
    1,
    "ant timers advance once per frame, not per segment",
  );
}

testAntCrushIncludesResolvedReboundPath();

function testAntOutsideReboundPathIsNotCrushedByEndpointChord() {
  const wall = { type: "obstacle", x: 200, y: 0, w: 20, h: 1000 };
  const mapConfig = {
    ...kitchenMap("kitchen-floor", [wall]),
    clusters: [
      {
        x: 0.13075,
        y: 0.5215,
        angle: 0,
        ants: [[0, 0]],
        cheerios: [],
        crumbs: [],
      },
    ],
  };
  const dynamics = createKitchenDynamics();
  reset(dynamics, mapConfig);
  const ant = dynamics.state.ants[0];
  ant.probeFrames = 100;
  ant.probeInFrames = 1000;
  const marble = { x: 160, y: 500, r: 29, vx: 14, vy: 10 };
  const previous = { ...marble };
  const context = {
    marble,
    physics: physicsConfig,
    tilt: { smoothX: 0, smoothY: 0 },
    intro: { released: true },
    bounds: { left: 0, top: 0, right: 1000, bottom: 1000 },
    mapState: { obstacles: [wall], terrainByType: {} },
  };
  updatePhysics(context, 2, { onSurface() {} });
  // Independently measured path clearance is 36.29556 > 29 + 7. The
  // endpoint chord cuts across that path, passing only 35.15247 away.
  const events = dynamics.update(
    mapConfig,
    marble,
    previous,
    2,
    context.physicsScratch.movementPath,
  );
  assert.equal(events.squishedAnts, 0);
  assert.equal(ant.alive, true);
}

function testAntContactUsesTheSpeedOfItsOwnPathSegment() {
  const { dynamics, mapConfig, ant } = antScene({ cheerios: [] });
  const marble = { x: 264.1, y: 500, r: 29, vx: 0.2, vy: 0 };
  dynamics.update(mapConfig, marble, { x: 254, y: 500 }, 2, {
    count: 2,
    segments: [
      {
        start: { x: 254, y: 500 },
        end: { x: 263.9, y: 500 },
        speed: 14,
        dt: 1,
      },
      { start: { x: 263.9, y: 500 }, end: marble, speed: 0.2, dt: 1 },
    ],
  });
  assert.equal(
    ant.alive,
    true,
    "unrelated fast travel cannot strengthen a slow contact",
  );
}

testAntOutsideReboundPathIsNotCrushedByEndpointChord();
testAntContactUsesTheSpeedOfItsOwnPathSegment();

function testHazardDiscardsEarlierAntContacts() {
  const mapConfig = {
    ...kitchenMap("kitchen-floor", []),
    clusters: [
      {
        x: 0.18,
        y: 0.5345,
        angle: 0,
        ants: [[0, 0]],
        cheerios: [],
        crumbs: [],
      },
    ],
  };
  const dynamics = createKitchenDynamics();
  reset(dynamics, mapConfig);
  const marble = { x: 160, y: 500, r: 29, vx: 14, vy: 0 };
  const previous = { ...marble };
  const context = {
    marble,
    physics: physicsConfig,
    tilt: { smoothX: 0, smoothY: 0 },
    intro: { released: true },
    bounds: { left: 0, top: 0, right: 1000, bottom: 1000 },
    mapState: {
      obstacles: [],
      terrainByType: {
        hazardPatch: { elements: [{ x: 210, y: 490, w: 2, h: 20 }] },
      },
    },
  };
  let segmentsBeforeReset = 0;
  updatePhysics(context, 2, {
    onSurface() {},
    onHazard() {
      segmentsBeforeReset = context.physicsScratch.movementPath.count;
      Object.assign(marble, { x: 800, y: 800, vx: 0, vy: 0 });
      Object.assign(previous, marble);
      return true;
    },
  });
  assert.ok(
    segmentsBeforeReset > 0,
    "the hazard is reached after earlier movement",
  );
  assert.equal(context.physicsScratch.movementPath.count, 0);
  const events = dynamics.update(
    mapConfig,
    marble,
    previous,
    2,
    context.physicsScratch.movementPath,
  );
  assert.equal(
    events.squishedAnts,
    0,
    "respawn must cancel the failed movement's ant contacts",
  );
  assert.equal(dynamics.state.ants[0].alive, true);
}

testHazardDiscardsEarlierAntContacts();

function testCerealCoastingMatchesRepeatedReferenceFrames() {
  const partitions = [
    Array(3).fill(2),
    Array(6).fill(1),
    Array(12).fill(0.5),
    [0.25, 1.75, 0.5, 1.5, 2],
  ];
  for (const [type, retention] of [
    ["floor", 0.88],
    ["gooPatch", 0.55],
  ]) {
    // Independent oracle: repeat the original unit-frame recurrence.
    const reference = { x: 500, y: 500, vx: 8, vy: -4 };
    for (let frame = 0; frame < 6; frame++) {
      reference.vx *= retention;
      reference.vy *= retention;
      reference.x += reference.vx;
      reference.y += reference.vy;
    }
    for (const steps of partitions) {
      const elements =
        type === "floor" ? [] : [{ type, x: 0, y: 0, w: 1000, h: 1000 }];
      const mapConfig = {
        ...kitchenMap("kitchen-floor", elements),
        clusters: [
          {
            x: 0.5,
            y: 0.5,
            angle: 0,
            ants: [],
            cheerios: [[0, 0]],
            crumbs: [],
          },
        ],
      };
      const dynamics = createKitchenDynamics();
      reset(dynamics, mapConfig);
      const food = dynamics.state.cheerios[0];
      food.vx = 8;
      food.vy = -4;
      for (const dt of steps) update(dynamics, mapConfig, farFromAnts, dt);
      for (const [actual, expected] of [
        [food.x, reference.x],
        [food.y, reference.y],
        [food.vx, reference.vx],
        [food.vy, reference.vy],
      ]) {
        assert.ok(
          Math.abs(actual - expected) < 1e-9,
          `${type}: ${actual} != ${expected}`,
        );
      }
      for (let i = 0; i < 400; i++)
        update(dynamics, mapConfig, farFromAnts, steps[0]);
      assert.equal(food.vx, 0);
      assert.equal(food.vy, 0);
      const stopped = [food.x, food.y];
      update(dynamics, mapConfig, farFromAnts, 2);
      assert.deepEqual([food.x, food.y], stopped);
      food.vx = 0.021;
      update(dynamics, mapConfig, farFromAnts, 1);
      assert.equal(
        food.vx,
        0,
        "a reference step crossing the settle threshold stops immediately",
      );
      assert.deepEqual([food.x, food.y], stopped);
    }
  }
}

function testSpongeCoastingMatchesRepeatedReferenceFrames() {
  for (const initialVx of [2, 0.015]) {
    const initialVy = initialVx === 2 ? -1 : 0;
    const reference = {
      x: 300,
      y: 400,
      angle: 0,
      vx: initialVx,
      vy: initialVy,
      omega: 0.01,
    };
    for (let i = 0; i < 6; i++) {
      reference.vx *= 0.94;
      reference.vy *= 0.94;
      reference.omega *= 0.9;
      reference.x += reference.vx;
      reference.y += reference.vy;
      reference.angle += reference.omega;
    }
    for (const steps of [
      Array(3).fill(2),
      Array(6).fill(1),
      Array(12).fill(0.5),
      [0.25, 1.75, 0.5, 1.5, 2],
    ]) {
      const sponge = {
        type: "obstacle",
        fixture: "sponge",
        x: 300,
        y: 400,
        w: 200,
        h: 80,
        angle: 0,
      };
      const water = { type: "waterPatch", x: 800, y: 800, w: 100, h: 100 };
      const mapConfig = {
        ...kitchenMap("kitchen-floor", [sponge, water]),
        clusters: [],
      };
      const dynamics = createKitchenDynamics();
      dynamics.reset({
        mapConfig,
        world,
        obstacles: [sponge],
        waterPatches: [water],
      });
      Object.assign(sponge, {
        vx: initialVx,
        vy: initialVy,
        angularVelocity: 0.01,
      });
      for (const dt of steps) update(dynamics, mapConfig, farFromAnts, dt);
      for (const [actual, expected] of [
        [sponge.x, reference.x],
        [sponge.y, reference.y],
        [sponge.angle, reference.angle],
        [sponge.vx, reference.vx],
        [sponge.vy, reference.vy],
        [sponge.angularVelocity, reference.omega],
      ]) {
        assert.ok(
          Math.abs(actual - expected) < 1e-9,
          `sponge: ${actual} != ${expected}`,
        );
      }
      for (let i = 0; i < 600; i++)
        update(dynamics, mapConfig, farFromAnts, steps[0]);
      assert.equal(sponge.vx, 0);
      assert.equal(sponge.vy, 0);
      assert.equal(sponge.angularVelocity, 0);
      const stopped = [sponge.x, sponge.y, sponge.angle];
      update(dynamics, mapConfig, farFromAnts, 2);
      assert.deepEqual([sponge.x, sponge.y, sponge.angle], stopped);
      Object.assign(sponge, { vx: 0.0101, angularVelocity: 0.000051 });
      update(dynamics, mapConfig, farFromAnts, 1);
      assert.equal(sponge.vx, 0);
      assert.equal(sponge.angularVelocity, 0);
      assert.deepEqual([sponge.x, sponge.y, sponge.angle], stopped);
    }
  }
}

testCerealCoastingMatchesRepeatedReferenceFrames();
testSpongeCoastingMatchesRepeatedReferenceFrames();

function assertSpongeBodyInsideWorld(sponge) {
  // Construct boundary points on the four rounded corners, then rotate them.
  // This checks the actual body, not the layout box or a copied AABB formula.
  for (const normalAngle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const localAngle = normalAngle - sponge.angle;
    const nx = Math.cos(localAngle);
    const ny = Math.sin(localAngle);
    const localX = Math.sign(nx) * (sponge.hitboxW / 2 - 18) + nx * 18;
    const localY = Math.sign(ny) * (sponge.hitboxH / 2 - 18) + ny * 18;
    const x =
      sponge.x +
      sponge.w / 2 +
      Math.cos(sponge.angle) * localX -
      Math.sin(sponge.angle) * localY;
    const y =
      sponge.y +
      sponge.h / 2 +
      Math.sin(sponge.angle) * localX +
      Math.cos(sponge.angle) * localY;
    assert.ok(x >= -1e-9 && x <= world.width + 1e-9, `sponge boundary x=${x}`);
    assert.ok(y >= -1e-9 && y <= world.height + 1e-9, `sponge boundary y=${y}`);
  }
  assert.ok(
    Math.abs(sponge.collisionCenterX - (sponge.x + sponge.w / 2)) < 1e-9,
  );
  assert.ok(
    Math.abs(sponge.collisionCenterY - (sponge.y + sponge.h / 2)) < 1e-9,
  );
}

function testRotatedSpongeBoundsAfterTranslationAndRotation() {
  // At 45 degrees, a 264x112 body with 18-radius corners has this exact extent:
  // rotate the (114,38) corner of its inner rectangle and add the circular rim.
  const extent = (114 + 38) * Math.SQRT1_2 + 18;
  for (const axis of ["x", "y"]) {
    for (const side of [-1, 1]) {
      for (const rotating of [false, true]) {
        for (const dt of [0.5, 1, 2]) {
          const sponge = {
            type: "obstacle",
            fixture: "sponge",
            x: 300,
            y: 400,
            w: 600,
            h: 140,
            hitboxW: 264,
            hitboxH: 112,
            angle: Math.PI / 4,
          };
          const mapConfig = {
            ...kitchenMap("kitchen-floor", [sponge]),
            clusters: [],
            world,
          };
          const runtime = createResolvedMapState(mapConfig);
          const dynamics = createKitchenDynamics();
          dynamics.reset({ mapConfig, world, obstacles: runtime.obstacles });
          const body = dynamics.state.sponge;
          const center = side < 0 ? extent + 0.1 : world.width - extent - 0.1;
          body[axis] = center - (axis === "x" ? body.w : body.h) / 2;
          body[axis === "x" ? "collisionCenterX" : "collisionCenterY"] = center;
          if (rotating) {
            // Y grows when turning clockwise here; X grows counterclockwise.
            body.angularVelocity = axis === "x" ? -0.025 : 0.025;
            body[axis === "x" ? "vx" : "vy"] = -side * 0.5;
          } else {
            body[axis === "x" ? "vx" : "vy"] = side * 3;
            body[axis === "x" ? "vy" : "vx"] = 0.5;
          }
          assertSpongeBodyInsideWorld(body);
          const events = update(
            dynamics,
            mapConfig,
            { x: 900, y: 900, r: 29, vx: 0, vy: 0 },
            dt,
          );
          assertSpongeBodyInsideWorld(body);
          assert.equal(events.spongeChanges, 1);
          if (rotating) {
            assert.ok(body.angle !== Math.PI / 4);
            assert.ok(
              Math.abs(
                body[axis === "x" ? "vx" : "vy"] +
                  side * 0.5 * Math.pow(0.94, dt),
              ) < 1e-9,
              "an inward velocity must survive correction of rotational penetration",
            );
          } else {
            assert.equal(body[axis === "x" ? "vx" : "vy"], 0);
            assert.ok(
              Math.abs(
                body[axis === "x" ? "vy" : "vx"] - 0.5 * Math.pow(0.94, dt),
              ) < 1e-9,
              "a boundary must preserve tangential coasting",
            );
            const finalCenter =
              body[axis] + (axis === "x" ? body.w : body.h) / 2;
            assert.ok(
              Math.abs(
                finalCenter - (side < 0 ? extent : world.width - extent),
              ) < 1e-9,
              "the metal boundary, not the transparent layout margin, must stop at the wall",
            );
          }
        }
      }
    }
  }
}

testRotatedSpongeBoundsAfterTranslationAndRotation();

function testFoodUsesVisibleLiquidFootprints() {
  const cases = [
    { type: "waterPatch", x: 305, y: 405, h: 200, retention: 0.88, wet: false },
    { type: "waterPatch", x: 450, y: 504, h: 200, retention: 0.82, wet: true },
    { type: "gooPatch", x: 305, y: 405, h: 60, retention: 0.88, wet: false },
    { type: "gooPatch", x: 456, y: 430, h: 60, retention: 0.55, wet: false },
    // The rotated goo's long tip extends beyond x=600, its authoring box.
    { type: "gooPatch", x: 604, y: 445, h: 60, retention: 0.55, wet: false },
    { type: "roughPatch", x: 305, y: 405, h: 200, retention: 0.68, wet: false },
  ];
  for (const test of cases) {
    const patch = { type: test.type, x: 300, y: 400, w: 300, h: test.h };
    const mapConfig = {
      ...kitchenMap("kitchen-floor", [patch]),
      clusters: [
        {
          x: test.x / 1000,
          y: test.y / 1000,
          angle: 0,
          ants: [],
          cheerios: [[0, 0]],
          crumbs: [],
        },
      ],
    };
    const dynamics = createKitchenDynamics();
    reset(dynamics, mapConfig);
    const food = dynamics.state.cheerios[0];
    Object.assign(food, { vx: 1, playerDisturbed: true });
    update(dynamics, mapConfig, farFromAnts);
    assert.ok(
      Math.abs(food.vx - test.retention) < 1e-12,
      `${test.type} at (${test.x},${test.y}) must use its actual footprint`,
    );
    assert.equal(food.waterSoak > 0, test.wet);
    if (test.type === "waterPatch" && !test.wet) {
      for (let frame = 0; frame < 30; frame++)
        update(dynamics, mapConfig, farFromAnts);
      assert.equal(
        food.waterSoak,
        0,
        "food resting on a dry corner must never become waterlogged",
      );
    }
  }
}

testFoodUsesVisibleLiquidFootprints();

function testCoincidentFoodContactsSeparateAlongTheImpactDirection() {
  for (const [vx, vy] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [0.5, 0],
    [0, -0.25],
    [0.3, 0.4],
    [0, 0],
  ]) {
    const mapConfig = {
      ...kitchenMap("kitchen-floor", []),
      clusters: [
        { x: 0.5, y: 0.5, angle: 0, ants: [], cheerios: [[0, 0]], crumbs: [] },
      ],
    };
    const dynamics = createKitchenDynamics();
    reset(dynamics, mapConfig);
    const food = dynamics.state.cheerios[0];
    const marble = { x: 500, y: 500, r: 29, vx, vy };
    update(dynamics, mapConfig, marble);
    const dx = food.x - marble.x;
    const dy = food.y - marble.y;
    const separation = Math.hypot(dx, dy);
    assert.ok(
      Math.abs(separation - (marble.r + food.radius + 0.5)) < 1e-10,
      "coincident contact must fully separate by a unit normal",
    );
    if (vx !== 0 || vy !== 0) {
      assert.ok(
        Math.abs(dx * vy - dy * vx) < 1e-10,
        "the push must stay parallel to incoming motion",
      );
      assert.ok(dx * vx + dy * vy > 0);
    } else {
      assert.equal(
        dx,
        separation,
        "stationary overlap uses a deterministic unit fallback",
      );
      assert.equal(dy, 0);
    }
    assert.ok(Math.abs(food.vx - vx * 0.42) < 1e-10);
    assert.ok(Math.abs(food.vy - vy * 0.42) < 1e-10);
  }
}

testCoincidentFoodContactsSeparateAlongTheImpactDirection();

function testKitchenFeedbackCooldownUsesElapsedTime() {
  for (const kind of ["ant", "cereal"]) {
    for (const dt of [2, 1, 0.5]) {
      const mapConfig = {
        ...kitchenMap("kitchen-floor", []),
        clusters: [
          {
            x: 0.5,
            y: 0.5,
            angle: 0,
            ants: kind === "ant" ? [[0, 0]] : [],
            cheerios: kind === "cereal" ? [[0, 0]] : [],
            crumbs: [],
          },
        ],
      };
      const dynamics = createKitchenDynamics();
      reset(dynamics, mapConfig);
      if (kind === "ant") {
        Object.assign(dynamics.state.ants[0], { alive: false, squished: true });
      }
      const pulseTimes = [];
      let time = 0;
      const haptics = createHapticsController(
        {
          enabled: true,
          impact: {
            minImpact: hapticTuning.impactMin,
            lastPulse: -Infinity,
            cooldownMs: hapticTuning.impactCooldownMs,
          },
        },
        hapticTuning,
        {
          now: () => (time * 1000) / 60,
          vibrate: () => pulseTimes.push(time),
        },
      );
      for (; time < 60; time += dt) {
        const food = dynamics.state.cheerios[0];
        const marble =
          kind === "ant"
            ? { x: 480 + time, y: 500, r: 29, vx: 1, vy: 0 }
            : {
                x: food.x,
                y: food.y,
                r: 29,
                vx: 1,
                vy: 0,
              };
        const events = update(dynamics, mapConfig, marble, dt);
        if (events.splatHits)
          haptics.pulseImpact(tuning.antSplatImpactFeedback);
        if (events.cerealHits)
          haptics.pulseImpact(tuning.cerealBumpImpactFeedback);
      }
      const cooldown =
        kind === "ant" ? antConfig.splatFeedbackCooldownFrames : 20;
      const expected = [];
      for (let t = 0; t < 60; t += cooldown) expected.push(t);
      assert.deepEqual(pulseTimes, expected, `${kind} cooldown at dt=${dt}`);
      assert.equal(dynamics.state.frameIndex, 60);
      update(dynamics, mapConfig, farFromAnts, 0);
      assert.equal(
        dynamics.state.frameIndex,
        60,
        "zero elapsed time cannot age a cooldown",
      );
      reset(dynamics, mapConfig);
      assert.equal(
        dynamics.state.frameIndex,
        0,
        "Retry resets the simulation clock",
      );
    }
  }
}

testKitchenFeedbackCooldownUsesElapsedTime();
console.log("Kitchen dynamics tests passed.");

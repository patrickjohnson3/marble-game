import assert from "node:assert/strict";
import {
  cockroachConfig,
  physicsConfig,
  timing,
  hapticTuning,
} from "../core/game-config.js";
import { baseMapConfig, resolvedMapConfig } from "../core/map-config.js";
import { createMapRuntime } from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { createGameState } from "../core/state.js";
import {
  updatePhysics,
  updatePhysicsInput,
  SURFACE_TYPES,
} from "../core/physics.js";

function harness() {
  const runtime = createMapRuntime({ initialMap: resolvedMapConfig });
  const state = createGameState({
    world: resolvedMapConfig.world,
    resolvedMapConfig,
    timing,
    hapticTuning,
    physicsConfig,
  });
  state.intro.released = true;
  Object.assign(state.bounds, { left: 0, right: 4400, top: 0, bottom: 4400 });
  Object.assign(state.marble, {
    x: 446,
    y: 500,
    vx: 0,
    vy: 0,
    r: resolvedMapConfig.spawn.r,
  });
  Object.assign(runtime.state.cockroach, {
    x: 500,
    y: 500,
    previousX: 500,
    previousY: 500,
    mode: "harass",
    modeFrames: cockroachConfig.harassmentDuration,
    angle: Math.PI,
    decisionIn: 1000,
    harassmentIn: 0,
  });
  const impacts = [];
  const context = {
    marble: state.marble,
    bounds: state.bounds,
    intro: state.intro,
    tilt: state.input.tilt,
    keyboard: state.input.keyboard,
    physics: state.physics,
    mapState: runtime.state,
  };
  const feedback = { onImpact: (speed) => impacts.push(speed), onSurface() {} };
  return { runtime, state, context, feedback, impacts };
}

{
  const { context, runtime, feedback, impacts, state } = harness();
  const position = { x: state.marble.x, y: state.marble.y };
  updatePhysics(context, 1, feedback);
  assert.ok(
    state.marble.vx < -cockroachConfig.contactImpulse * 0.8,
    "a real physics step applies the cockroach's disruptive impulse",
  );
  assert.equal(runtime.state.cockroach.mode, "harass");
  assert.equal(runtime.state.cockroach.engaged, true);
  assert.equal(impacts.length, 1);
  assert.deepEqual(
    { x: state.marble.x, y: state.marble.y },
    position,
    "the insect adds momentum without projecting the marble through geometry",
  );
  updatePhysics(context, 1, feedback);
  assert.equal(
    impacts.length,
    1,
    "one physical contact does not repeatedly shove the marble",
  );
}

{
  const test = harness();
  const baseline = harness();
  for (const entry of [test, baseline]) {
    Object.assign(entry.state.marble, { x: 440, vx: 14 });
  }
  baseline.runtime.state.cockroach = null;
  updatePhysics(baseline.context, 1, baseline.feedback);
  updatePhysics(test.context, 1, test.feedback);
  assert.equal(test.runtime.state.cockroach.mode, "stunned");
  assert.ok(test.runtime.state.cockroach.knockbackX > 0);
  assert.equal(test.impacts.length, 1);
  assert.equal(test.state.marble.x, baseline.state.marble.x);
  assert.equal(
    test.state.marble.vx,
    baseline.state.marble.vx,
    "repelling the insect does not rewrite ordinary marble integration",
  );
  for (const field of ["health", "maxHealth", "alive", "dead"]) {
    assert.equal(Object.hasOwn(test.runtime.state.cockroach, field), false);
  }
}

{
  const { context, runtime, state, feedback } = harness();
  Object.assign(state.marble, { x: 1500, y: 500 });
  Object.assign(runtime.state.cockroach, {
    mode: "scurry",
    harassmentIn: 1000,
    decisionIn: 0,
    angle: 0,
  });
  const cereal = {
    kind: "cheerio",
    active: true,
    x: 100,
    y: 500,
  };
  context.kitchenState = { cheerios: [cereal] };
  updatePhysics(context, 2, feedback);
  assert.ok(
    runtime.state.cockroach.x < 500,
    "the real physics path supplies live food to ordinary roach movement",
  );
  const x = runtime.state.cockroach.x;
  cereal.x += 900;
  runtime.state.cockroach.decisionIn = 0;
  updatePhysics(context, 2, feedback);
  assert.ok(
    runtime.state.cockroach.x > x,
    "the next decision uses pushed cereal without refreshing a copied target list",
  );
}

{
  for (const dt of [0.5, 1, 2]) {
    const { context, runtime, feedback, impacts, state } = harness();
    Object.assign(state.marble, { x: 2200, y: 600 });
    Object.assign(runtime.state.cockroach, {
      x: 2254,
      y: 600,
      previousX: 2254,
      previousY: 600,
      decisionIn: 0,
    });
    let elapsed = 0;
    while (elapsed < 180) {
      updatePhysics(context, dt, feedback);
      elapsed += dt;
    }
    assert.ok(
      impacts.length >= 2,
      "separate physical attacks repeat without retreat",
    );
    assert.ok(
      impacts.length <= 3,
      "three seconds of idle contact pressure must not become a rapid shove chain",
    );
    assert.ok(
      state.marble.x < 2100,
      "the stronger hits physically push the marble back",
    );
    assert.equal(runtime.state.cockroach.mode, "harass");
    assert.equal(runtime.state.cockroach.engaged, true);
  }
}

// A modest three-degree tilt away should suffice on clear floor. Requiring
// keyboard-level tilt or a counter-hit makes ordinary ant hunting exhausting.
for (const parts of [[0.5], [1], [2], [0.13, 0.8, 1.17, 2.2]]) {
  const { context, runtime, state, feedback, impacts } = harness();
  const cockroach = runtime.state.cockroach;
  Object.assign(state.marble, { x: 2200, y: 600 });
  Object.assign(cockroach, {
    x: 2254,
    y: 600,
    previousX: 2254,
    previousY: 600,
    decisionIn: 0,
  });
  Object.assign(context.tilt, {
    rawX: -3,
    rawY: 0,
    neutralX: 0,
    neutralY: 0,
    smoothX: 0,
    smoothY: 0,
  });
  let elapsed = 0;
  let index = 0;
  let escaped = false;
  while (elapsed < 120 && !escaped) {
    const dt = Math.min(parts[index++ % parts.length], 120 - elapsed);
    const wasEngaged = cockroach.engaged;
    updatePhysicsInput(context, dt);
    updatePhysics(context, dt, feedback);
    escaped = wasEngaged && !cockroach.engaged && cockroach.mode === "scurry";
    elapsed += dt;
  }
  assert.equal(
    impacts.length,
    1,
    "modest escape steering avoids a second shove",
  );
  assert.equal(
    escaped,
    true,
    "normal steering can disengage within two seconds",
  );
  assert.ok(cockroach.harassmentIn > 0, "escape still grants foraging respite");
  for (let frame = 0; frame < 120; frame++) {
    updatePhysicsInput(context, 1);
    updatePhysics(context, 1, feedback);
    assert.equal(cockroach.mode, "scurry", "escape provides time to hunt ants");
  }
  assert.equal(impacts.length, 1, "no immediate reacquisition after escape");
}

for (const phase of ["intro", "complete", "hazard"]) {
  const { context, runtime, state, feedback, impacts } = harness();
  if (phase === "intro") state.intro.released = false;
  if (phase === "complete") runtime.completeGoal();
  if (phase === "hazard") {
    runtime.state.terrainByType[SURFACE_TYPES.hazardPatch].elements = [
      { x: 400, y: 450, w: 200, h: 100 },
    ];
    feedback.onHazard = () => {
      Object.assign(state.marble, { x: 100, y: 100, vx: 0, vy: 0 });
      return true;
    };
  }
  const before = globalThis.structuredClone(runtime.state.cockroach);
  updatePhysics(context, 2, feedback);
  assert.deepEqual(
    runtime.state.cockroach,
    before,
    `${phase} must not advance or collide a cockroach on an invalid gameplay sweep`,
  );
  assert.equal(impacts.length, 0);
}

{
  const { runtime } = harness();
  const actor = runtime.state.cockroach;
  const authored = resolvedMapConfig.cockroach;
  runtime.state.activeMap.cockroach.x += 100;
  assert.notEqual(
    runtime.state.activeMap.cockroach.x,
    authored.x,
    "runtime authored data must not mutate the shared map definition",
  );
  runtime.setActiveMap(resolvedMapConfig);
  assert.notEqual(runtime.state.cockroach, actor);
  assert.equal(runtime.state.cockroach.x, authored.x);
  assert.equal(runtime.state.cockroach.mode, "scurry");
  assert.equal(runtime.state.cockroach.contactLatched, false);
  assert.equal(runtime.state.cockroach.engaged, false);
  assert.equal(runtime.state.cockroach.attackRecoveryFrames, 0);
  assert.ok(runtime.state.cockroach.harassmentIn > 0);
  for (const variantId of [
    "living-room",
    "kitchen-breakfast-spill",
    "parking-lot",
  ]) {
    // Use the current kitchen config as the fallback too, exercising property clearing.
    const next = resolveMapVariantConfig(
      { ...resolvedMapConfig, variants: baseMapConfig.variants },
      variantId,
    );
    assert.equal(next.cockroach, undefined);
    runtime.setActiveMap(next);
    assert.equal(
      runtime.state.cockroach,
      null,
      `${variantId} must not inherit the kitchen antagonist`,
    );
  }
}

console.log("Cockroach integration tests passed.");

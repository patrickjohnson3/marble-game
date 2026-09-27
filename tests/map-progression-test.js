import assert from "node:assert/strict";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
import { baseMapConfig } from "../core/map-config.js";
import { createMapProgression } from "../core/map-progression.js";
import { createMapRuntime } from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";

function createHarness(config = baseMapConfig) {
  const source = resolveMapVariantConfig(config, "kitchen-floor");
  const runtime = createMapRuntime({ initialMap: source });
  const kitchen = createKitchenDynamics();
  const marble = { ...source.spawn, vx: 0, vy: 0 };
  const calls = [];

  function applyMap(map) {
    runtime.setActiveMap(map);
    kitchen.reset({
      mapConfig: runtime.state.activeMap,
      obstacles: runtime.state.obstacles,
      waterPatches: runtime.state.terrainByType.waterPatch.elements,
      world: runtime.state.activeMap.world,
    });
    calls.push(["apply", map.variantId]);
  }
  applyMap(source);
  calls.length = 0;

  const progression = createMapProgression({
    baseMapConfig: config,
    getCurrentMap: () => runtime.state.activeMap,
    applyMap,
    resetForNextMap() {
      Object.assign(marble, runtime.state.activeMap.spawn, { vx: 0, vy: 0 });
      calls.push(["reset", runtime.state.activeMap.variantId]);
    },
    terrainView: {
      updateGoalProgress(progress) {
        calls.push(["progress", progress]);
      },
    },
    ui: {
      setHint(hint) {
        calls.push(["hint", hint]);
      },
      showLevelLabel(label) {
        calls.push(["label", label]);
      },
    },
    requestRender() {
      calls.push(["render"]);
    },
  });

  return { calls, kitchen, marble, progression, runtime };
}

function testLoadAnyMapAndContinueItsProgression() {
  const config = {
    ...baseMapConfig,
    variants: baseMapConfig.variants.map((map) =>
      map.id === "parking-lot"
        ? { ...map, world: { width: 5400, height: 4800 } }
        : map,
    ),
  };
  const { calls, kitchen, marble, progression, runtime } =
    createHarness(config);
  const destination = resolveMapVariantConfig(config, "parking-lot");
  marble.vx = 10;
  marble.vy = -5;
  runtime.completeGoal();

  assert.equal(progression.loadMap("parking-lot"), true);
  assert.equal(runtime.state.activeMap.variantId, "parking-lot");
  assert.deepEqual(runtime.state.activeMap.world, destination.world);
  assert.deepEqual(runtime.state.activeMap.goal, destination.goal);
  assert.equal(runtime.state.activeMap.objective, undefined);
  assert.deepEqual(marble, { ...destination.spawn, vx: 0, vy: 0 });
  assert.equal(runtime.state.goalCompleted, false);
  assert.equal(kitchen.state.ants.length, 0);
  assert.deepEqual(calls.slice(0, 2), [
    ["apply", "parking-lot"],
    ["reset", "parking-lot"],
  ]);
  assert.equal(
    calls.some(([kind]) => kind === "label"),
    true,
  );
  assert.equal(calls.at(-1)[0], "render");

  assert.equal(progression.advanceToNextMap(), true);
  assert.equal(
    runtime.state.activeMap.variantId,
    "sand-lot",
    "normal progression continues after the selected map",
  );

  runtime.addGoalHold(500);
  assert.equal(runtime.state.goalHoldMs, 500);
  assert.equal(progression.loadMap("living-room"), true);
  assert.equal(runtime.state.goalHoldMs, 0);
  const livingRoom = resolveMapVariantConfig(config, "living-room");
  assert.deepEqual(runtime.state.activeMap.objective, livingRoom.objective);
  assert.deepEqual(runtime.state.activeMap.regions, livingRoom.regions);
  assert.equal(runtime.state.activeMap.goal, undefined);
  assert.deepEqual(marble, { ...livingRoom.spawn, vx: 0, vy: 0 });
}

function testLoadingCurrentMapRestoresItsFreshState() {
  const { kitchen, marble, progression, runtime } = createHarness();
  const initialMap = runtime.state.activeMap;
  const sourceSnapshot = JSON.stringify(baseMapConfig.variants);
  const initial = globalThis.structuredClone({
    ants: kitchen.state.ants,
    cheerios: kitchen.state.cheerios,
    sponge: kitchen.state.sponge,
    waterPatch: kitchen.state.waterPatch,
  });
  kitchen.state.ants[0].alive = false;
  kitchen.state.cheerios[0].active = false;
  kitchen.state.cheerios[0].x += 80;
  kitchen.state.sponge.x += 120;
  kitchen.state.sponge.saturation = 0.8;
  kitchen.state.waterPatch.w /= 2;
  runtime.completeGoal();
  marble.x += 150;
  marble.vx = 10;

  assert.equal(progression.loadMap("kitchen-floor"), true);
  assert.notEqual(runtime.state.activeMap, initialMap);
  assert.deepEqual(kitchen.state.ants, initial.ants);
  assert.deepEqual(kitchen.state.cheerios, initial.cheerios);
  assert.deepEqual(kitchen.state.sponge, initial.sponge);
  assert.deepEqual(kitchen.state.waterPatch, initial.waterPatch);
  assert.equal(runtime.state.goalCompleted, false);
  assert.deepEqual(marble, {
    ...runtime.state.activeMap.spawn,
    vx: 0,
    vy: 0,
  });
  assert.equal(JSON.stringify(baseMapConfig.variants), sourceSnapshot);
}

function testInvalidSelectionDoesNotChangeTheRun() {
  const { calls, kitchen, marble, progression, runtime } = createHarness();
  runtime.completeGoal();
  kitchen.state.ants[0].alive = false;
  marble.vx = 7;
  const mapBefore = runtime.state.activeMap;
  const antsBefore = kitchen.state.ants;
  const marbleBefore = { ...marble };

  for (const id of ["missing-map", "", undefined, null]) {
    assert.equal(progression.loadMap(id), false);
    assert.equal(runtime.state.activeMap, mapBefore);
    assert.equal(runtime.state.goalCompleted, true);
    assert.equal(kitchen.state.ants, antsBefore);
    assert.equal(kitchen.state.ants[0].alive, false);
    assert.deepEqual(marble, marbleBefore);
    assert.deepEqual(calls, []);
  }
}

testLoadAnyMapAndContinueItsProgression();
testLoadingCurrentMapRestoresItsFreshState();
testInvalidSelectionDoesNotChangeTheRun();

console.log("Map progression tests passed.");

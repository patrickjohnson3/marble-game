import assert from "node:assert/strict";
import { createParkingCarCollisionRects } from "../core/map-obstacles.js";
import { validateMapConfig } from "../core/map-validation.js";
import { baseMapConfig } from "../core/map-config.js";
import { getObjectiveRegion } from "../core/map-objectives.js";
import { createResolvedMapState } from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { circleObstacleContact } from "../core/physics-collisions.js";
import { parkingLotMap } from "../maps/parking-lot.js";
import { renderHazardPatches } from "../rendering/hazard-patch-rendering.js";
import {
  renderMapTheme,
  renderMapThemeDynamics,
} from "../rendering/map-theme-rendering.js";
import { renderObstacleWalls } from "../rendering/obstacle-rendering.js";
import { renderAuthoredParkingLot } from "../rendering/parking-lot-rendering.js";
import { renderRoughPatches } from "../rendering/rough-patch-rendering.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

const map = resolveMapVariantConfig(baseMapConfig, "parking-lot");
const before = globalThis.structuredClone(map);
const state = createResolvedMapState(map);
assert.deepEqual(map.spawn, { x: 560, y: 3720, r: 29 });
assert.deepEqual(getObjectiveRegion(map), {
  x: 3760,
  y: 680,
  r: 84,
  holdMs: 5000,
});
assert.deepEqual(map.world, { width: 4400, height: 4400 });
assert.equal(baseMapConfig.variants[2].id, "parking-lot");
assert.equal(state.mouse, null);
assert.equal(state.cockroach, null);

// This certificate checks a broad navigable corridor, not an AI route or a
// claim that every point in the map is reachable. Sample below a marble radius
// so thin fixtures cannot sit unnoticed between samples.
assert.deepEqual(parkingLotMap.route[0], { x: map.spawn.x, y: map.spawn.y });
assert.deepEqual(parkingLotMap.route.at(-1), {
  x: map.goal.x,
  y: map.goal.y,
});
for (let index = 1; index < parkingLotMap.route.length; index += 1) {
  const a = parkingLotMap.route[index - 1];
  const b = parkingLotMap.route[index];
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
  for (let step = 0; step <= steps; step += 1) {
    const circle = {
      x: a.x + ((b.x - a.x) * step) / steps,
      y: a.y + ((b.y - a.y) * step) / steps,
      r: map.spawn.r * 2,
    };
    assert.ok(circle.x >= circle.r && circle.y >= circle.r);
    assert.ok(circle.x + circle.r <= map.world.width);
    assert.ok(circle.y + circle.r <= map.world.height);
    for (const solid of [
      ...state.obstacles,
      ...state.terrainByType.hazardPatch.elements,
    ]) {
      assert.equal(
        circleObstacleContact(circle, solid).intersects,
        false,
        `route section ${index} must retain two-radius clearance from ${solid.fixture ?? solid.type}`,
      );
    }
  }
}

function circleAtLocal(rect, x, y, radius = map.spawn.r) {
  const angle = rect.angle ?? 0;
  return {
    x: rect.x + rect.w / 2 + Math.cos(angle) * x - Math.sin(angle) * y,
    y: rect.y + rect.h / 2 + Math.sin(angle) * x + Math.cos(angle) * y,
    r: radius,
  };
}

// Visible concrete and cone bases are the same rounded rectangles used by
// contact response, including cones rotated away from the map axes.
for (const obstacle of state.obstacles.filter(
  (item) => item.fixture !== "parkedCar",
)) {
  const halfW = (obstacle.hitboxW ?? obstacle.w) / 2;
  const halfH = (obstacle.hitboxH ?? obstacle.h) / 2;
  for (const sign of [-1, 1]) {
    for (const axis of ["x", "y"]) {
      for (const gap of [-0.5, 0.5]) {
        const offset =
          ((axis === "x" ? halfW : halfH) + map.spawn.r + gap) * sign;
        assert.equal(
          circleObstacleContact(
            circleAtLocal(
              obstacle,
              axis === "x" ? offset : 0,
              axis === "y" ? offset : 0,
            ),
            obstacle,
          ).intersects,
          gap < 0,
          `${obstacle.fixture} ${axis} side must contact at the visible boundary`,
        );
      }
    }
  }
  const radius = obstacle.cornerRadius;
  assert.ok(radius > 0);
  for (const gap of [-0.5, 0.5]) {
    const diagonal = (radius + map.spawn.r + gap) / Math.sqrt(2);
    assert.equal(
      circleObstacleContact(
        circleAtLocal(
          obstacle,
          -halfW + radius - diagonal,
          -halfH + radius - diagonal,
        ),
        obstacle,
      ).intersects,
      gap < 0,
      `${obstacle.fixture} corner must preserve the rounded silhouette`,
    );
  }
}

// Independent alpha > 200 measurements from parking-car.webp rendered into
// its 520 × 1140 box. Each sample includes the radius-29 circle envelope of
// nearby opaque pixels, not the bounding rectangles used by the implementation.
const carContacts = [
  [-524.032258, -194.101495, 193.672577],
  [-447.419355, -242.2667, 241.72299],
  [-324.83871, -269.460703, 268.951613],
  [-202.258065, -267.667457, 267.30829],
  [-49.032258, -269.491812, 268.909444],
  [165.483871, -267.040199, 266.510796],
  [318.709677, -274.467742, 273.854839],
  [441.290323, -256.65138, 256.276032],
  [520.967742, -227.317807, 226.793845],
  [545.483871, -202.43672, 202.119656],
];
const authoredCar = map.elements.find((item) => item.fixture === "parkedCar");
const contactTolerance = 5;
for (const angle of [0, Math.PI, 0.45]) {
  const car = { ...authoredCar, angle };
  const parts = createParkingCarCollisionRects(car);
  function hits(x, y) {
    const circle = circleAtLocal(car, x, y);
    return parts.some((part) => circleObstacleContact(circle, part).intersects);
  }
  for (const [y, left, right] of carContacts) {
    for (const [side, boundary] of [
      [-1, left],
      [1, right],
    ]) {
      assert.equal(
        hits(boundary + side * contactTolerance, y),
        false,
        `car shoulder/flank y=${y}, angle=${angle}: transparent space must be clear`,
      );
      assert.equal(
        hits(boundary - side * contactTolerance, y),
        true,
        `car shoulder/flank y=${y}, angle=${angle}: visible body must be solid`,
      );
    }
  }
  for (const [side, end] of [
    [-1, -593.482252],
    [1, 586.740316],
  ]) {
    assert.equal(hits(0, end + side * contactTolerance), false);
    assert.equal(hits(0, end - side * contactTolerance), true);
  }
  const runtime = createResolvedMapState({ ...map, elements: [car] });
  assert.ok(
    runtime.obstacles.length > 1,
    "live contact uses fitted car pieces",
  );
  assert.deepEqual(
    runtime.obstacles.map((part) => part.fixtureSource),
    parts.map(() => car),
    "live car contacts retain the same authoritative visual source",
  );
}

assert.deepEqual(validateMapConfig(map), []);
// The same legacy held-goal validator on a small scene keeps malformed-data
// regressions cheap; the real parking route above is independently checked.
const routeFixture = {
  ...map,
  world: { width: 600, height: 600 },
  spawn: { x: 100, y: 500, r: 10 },
  goal: { x: 500, y: 100, r: 50, holdMs: 5000 },
  elements: [],
  scenery: [],
  views: [],
  route: [
    { x: 100, y: 500 },
    { x: 500, y: 500 },
    { x: 500, y: 100 },
  ],
};
assert.deepEqual(validateMapConfig(routeFixture), []);
for (const route of [
  null,
  {},
  [],
  [null, {}],
  [3, {}],
  [{ x: NaN, y: 10 }, routeFixture.goal],
]) {
  let errors;
  assert.doesNotThrow(() => {
    errors = validateMapConfig({ ...routeFixture, route });
  });
  assert.ok(
    errors.some((error) => error.includes("route")),
    "invalid legacy-goal routes fail clearly instead of crashing or silently passing",
  );
}
const missesGoal = { ...routeFixture, route: routeFixture.route.slice(0, -1) };
assert.ok(
  validateMapConfig(missesGoal).some((error) => error.includes("held goal")),
);
const blockedExit = {
  ...routeFixture,
  elements: [{ type: "obstacle", x: 450, y: 50, w: 100, h: 100 }],
};
assert.ok(
  validateMapConfig(blockedExit).some((error) =>
    error.includes("goal must not overlap"),
  ),
  "a blocked goal must be rejected",
);
const throughDrain = {
  ...routeFixture,
  elements: [
    { type: "hazardPatch", material: "drain", x: 260, y: 260, w: 80, h: 80 },
  ],
  route: [routeFixture.spawn, { x: 300, y: 300 }, routeFixture.goal],
};
assert.ok(
  validateMapConfig(throughDrain).some((error) =>
    error.includes("steering clearance"),
  ),
  "clearance certificate cannot route the player through a reset hazard",
);

function withFakeDocument(callback) {
  const original = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      return tag === "canvas" ? new FakeCanvasElement() : new FakeElement();
    },
  };
  try {
    callback();
  } finally {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  }
}

function descendants(element) {
  return element.children.flatMap((child) => [child, ...descendants(child)]);
}

withFakeDocument(() => {
  const container = new FakeElement();
  renderObstacleWalls(container, state.obstacles, { mapConfig: map });
  const layer = container.firstChild;
  assert.equal(layer.className, "obstacleCanvas parkingObstacleLayer");
  const authored = map.elements.filter((item) => item.type === "obstacle");
  assert.equal(
    layer.children.length,
    authored.length,
    "one visual per solid fixture, with composite car contacts deduplicated",
  );
  for (const [index, fixture] of authored.entries()) {
    const node = layer.children[index];
    assert.equal(node.attributes["data-fixture"], fixture.fixture);
    assert.equal(node.style.left, fixture.x + "px");
    assert.equal(node.style.top, fixture.y + "px");
    assert.equal(node.style.width, fixture.w + "px");
    assert.equal(node.style.height, fixture.h + "px");
    assert.equal(node.style.transform, `rotate(${fixture.angle ?? 0}rad)`);
    if (fixture.fixture === "parkedCar") {
      assert.equal(node.children.length, 1);
      assert.equal(node.firstChild.className, "parkingCarSprite");
    } else {
      assert.equal(node.style.borderRadius, fixture.cornerRadius + "px");
    }
  }

  function captureScenery() {
    const underlay = new FakeElement();
    renderAuthoredParkingLot({ underlay, mapConfig: map, world: map.world });
    const canvases = underlay.children.filter(
      (child) => child instanceof FakeCanvasElement,
    );
    assert.equal(canvases.length, 1, "static paint shares one canvas");
    const canvas = canvases[0];
    assert.equal(canvas.style.left, "0px");
    assert.equal(canvas.style.top, "0px");
    assert.equal(canvas.style.width, map.world.width + "px");
    assert.equal(canvas.style.height, map.world.height + "px");
    assert.ok(canvas.width <= map.world.width / 2);
    assert.ok(canvas.height <= map.world.height / 2);
    return canvas.context.calls;
  }
  assert.deepEqual(
    captureScenery(),
    captureScenery(),
    "map reloads must draw identical world-aligned paint and wear",
  );

  const themes = new FakeElement();
  const overlay = new FakeElement();
  const themeState = {};
  renderMapTheme({
    container: themes,
    overlayContainer: overlay,
    mapConfig: map,
    world: map.world,
    themeState,
  });
  const floorCanvas = descendants(themes).find(
    (node) => node.className === "parkingSceneryCanvas",
  );
  assert.ok(floorCanvas, "the real map-theme path must use authored paint");
  const drawn = floorCanvas.context.calls.length;
  renderMapThemeDynamics({ mapConfig: map, themeState });
  assert.equal(
    floorCanvas.context.calls.length,
    drawn,
    "normal dynamic frames must not rebuild static parking scenery",
  );
  const legacy = resolveMapVariantConfig(baseMapConfig, "parking-lot-puddles");
  renderMapTheme({
    container: themes,
    overlayContainer: overlay,
    mapConfig: legacy,
    world: legacy.world,
    themeState,
  });
  assert.equal(
    descendants(themes).some(
      (node) => node.className === "parkingSceneryCanvas",
    ),
    false,
    "the separate puddles level retains its established presentation",
  );

  const drain = state.terrainByType.hazardPatch.elements.find(
    (patch) => patch.material === "drain",
  );
  assert.ok(drain, "maintenance area must expose a visible open drain");
  const hazards = new FakeElement();
  renderHazardPatches(hazards, [drain], { padding: 18 });
  const drainCalls = hazards.firstChild.context.calls;
  assert.ok(
    drainCalls.some(
      (call) =>
        call[0] === "fillRect" &&
        call[1] === drain.x &&
        call[2] === drain.y &&
        call[3] === drain.w &&
        call[4] === drain.h,
    ),
    "visible dark opening must use the exact rectangular hazard bounds",
  );
  assert.equal(hazards.firstChild.attributes["data-hazard-patches"], "1");
  assert.equal(
    drainCalls.some(
      (call) => call[0] === "addColorStop" && call[2] === "#ff7a59",
    ),
    false,
    "a physical drain must not fall through to the generic neon hazard",
  );
  renderHazardPatches(hazards, [{ ...drain, material: undefined }]);
  assert.ok(
    hazards.firstChild.context.calls.some(
      (call) => call[0] === "addColorStop" && call[2] === "#ff7a59",
    ),
    "unrelated maps keep their original hazard renderer",
  );

  const gravel = state.terrainByType.roughPatch.elements.find(
    (patch) => patch.material === "gravel",
  );
  assert.ok(gravel);
  const rough = new FakeElement();
  renderRoughPatches(rough, [gravel]);
  const gravelCalls = rough.firstChild.context.calls;
  assert.equal(rough.firstChild.attributes["data-rough-patches"], "1");
  assert.ok(gravelCalls.some((call) => call[0] === "clip"));
  assert.ok(
    gravelCalls.some(
      (call) =>
        call[0] === "fillRect" &&
        call[1] === gravel.x &&
        call[2] === gravel.y &&
        call[3] === gravel.w &&
        call[4] === gravel.h,
    ),
    "loose aggregate is confined to the existing rough-terrain footprint",
  );
});
assert.deepEqual(
  map,
  before,
  "rendering and preparation cannot mutate map data",
);
console.log("Parking lot tests passed.");

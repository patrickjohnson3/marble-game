import assert from "node:assert/strict";
import { physicsConfig } from "../core/game-config.js";
import { updatePhysics } from "../core/physics.js";
import { baseMapConfig } from "../core/map-config.js";
import {
  createMapRuntime,
  createResolvedMapState,
} from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import {
  circleObstacleContact,
  handleWallCollisions,
} from "../core/physics-collisions.js";

const marbleRadius = 29;
const silhouetteTolerance = 4;
// Measured from the opaque metal pixels (alpha > 200) of fork.png, rendered
// at its existing 760px width. These are circle-center contact coordinates:
// each includes the radius-29 envelope of nearby pixels, including the flare
// beside the neck. They are independent of the collision primitive layout.
const metalContacts = [
  { region: "handle", x: -237.5, top: -52.007813, bottom: 54.976563 },
  { region: "neck", x: 0, top: -37.90625, bottom: 39.381126 },
  { region: "narrow neck", x: 95, top: -37.90625, bottom: 37.90625 },
  { region: "head transition", x: 142.5, top: -58.814291, bottom: 58.015065 },
  { region: "head", x: 190, top: -76.773026, bottom: 75.757813 },
  { region: "tines", x: 237.5, top: -76.414398, bottom: 75.748314 },
  { region: "tine tips", x: 377.03125, top: -65.765433, bottom: 64.587424 },
];

function assertNear(actual, expected, tolerance, message) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, received ${actual}`,
  );
}

function forkIn(state) {
  return state.activeMap.elements.find((element) => element.fixture === "fork");
}

function forkObstacles(state) {
  return state.obstacles.filter((obstacle) => obstacle.fixture === "fork");
}

function worldPoint(fork, x, y) {
  const cos = Math.cos(fork.angle ?? 0);
  const sin = Math.sin(fork.angle ?? 0);
  return {
    x: fork.x + fork.w / 2 + cos * x - sin * y,
    y: fork.y + fork.h / 2 + sin * x + cos * y,
    r: marbleRadius,
  };
}

function intersectsFork(state, x, y) {
  const circle = worldPoint(forkIn(state), x, y);
  return forkObstacles(state).some(
    (obstacle) => circleObstacleContact(circle, obstacle).intersects,
  );
}

function contactOffset(state, x, side) {
  let inner = 0;
  let outer = 150;
  assert.equal(intersectsFork(state, x, side * inner), true);
  assert.equal(intersectsFork(state, x, side * outer), false);
  for (let step = 0; step < 40; step++) {
    const middle = (inner + outer) / 2;
    if (intersectsFork(state, x, side * middle)) inner = middle;
    else outer = middle;
  }
  return side * ((inner + outer) / 2);
}

function assertMetalBoundary(state) {
  const fork = forkIn(state);
  for (const sample of metalContacts) {
    for (const side of [-1, 1]) {
      const expected = side < 0 ? sample.top : sample.bottom;
      const label = `${state.activeMap.variantId}, angle ${fork.angle}, ${sample.region}, side ${side}`;
      assert.equal(
        intersectsFork(state, sample.x, expected + side * silhouetteTolerance),
        false,
        `${label}: no invisible metal beyond the visible outline`,
      );
      assert.equal(
        intersectsFork(state, sample.x, expected - side * silhouetteTolerance),
        true,
        `${label}: the visible metal must block the marble`,
      );
      assertNear(
        contactOffset(state, sample.x, side),
        expected,
        silhouetteTolerance,
        label,
      );
    }
  }

  // The tine slots are narrower than this marble. A head-on approach must
  // stop at their tips rather than travel into the solid head behind them.
  assert.equal(
    intersectsFork(state, 405.863525 + silhouetteTolerance, 0),
    false,
  );
  assert.equal(
    intersectsFork(state, 405.863525 - silhouetteTolerance, 0),
    true,
  );
  assert.equal(
    intersectsFork(state, -408.257813 - silhouetteTolerance, 0),
    false,
  );
  assert.equal(
    intersectsFork(state, -408.257813 + silhouetteTolerance, 0),
    true,
  );
}

function assertNeckResponse(state) {
  const fork = forkIn(state);
  const obstacles = forkObstacles(state);
  for (const side of [-1, 1]) {
    const contactY = contactOffset(state, 0, side);
    const nx = -Math.sin(fork.angle ?? 0) * side;
    const ny = Math.cos(fork.angle ?? 0) * side;
    for (const incoming of [true, false]) {
      const speed = incoming ? -3 : 3;
      const marble = {
        ...worldPoint(fork, 0, contactY - side * 0.5),
        vx: nx * speed,
        vy: ny * speed,
      };
      const original = { ...marble };
      const impacts = [];
      handleWallCollisions(
        {
          marble,
          bounds: { left: 0, top: 0, right: 4400, bottom: 4400 },
          intro: { released: true },
          obstacles,
          physics: physicsConfig,
        },
        (impact) => impacts.push(impact),
      );
      assert.ok(
        (marble.x - original.x) * nx + (marble.y - original.y) * ny > 0.45,
        "neck contact should correct penetration toward the visible edge",
      );
      assertNear(
        marble.vx * nx + marble.vy * ny,
        incoming ? 3 * physicsConfig.bounce : 3,
        1e-8,
        "fork pieces must retain the existing directional bounce response",
      );
      assert.equal(impacts.length, incoming ? 1 : 0);
      if (!incoming) {
        assertNear(marble.vx, original.vx, 1e-9, "outgoing X velocity");
        assertNear(marble.vy, original.vy, 1e-9, "outgoing Y velocity");
      }
    }
  }
}

function assertDrivenNeckContact(state) {
  const fork = forkIn(state);
  for (const side of [-1, 1]) {
    const nx = -Math.sin(fork.angle ?? 0) * side;
    const ny = Math.cos(fork.angle ?? 0) * side;
    const marble = { ...worldPoint(fork, 0, side * 90), vx: 0, vy: 0 };
    const context = {
      marble,
      mapState: state,
      physics: physicsConfig,
      tilt: { smoothX: -nx * 18, smoothY: -ny * 18 },
      intro: { released: true },
      bounds: { left: 0, top: 0, right: 4400, bottom: 4400 },
    };
    for (let frame = 0; frame < 90; frame++) updatePhysics(context, 1, {});
    const center = worldPoint(fork, 0, 0);
    const offset = (marble.x - center.x) * nx + (marble.y - center.y) * ny;
    assert.ok(
      offset >= 37 && offset < 43,
      "continuous tilt must stop against the narrow metal, without tunneling or the old gap",
    );
    assert.ok(Number.isFinite(marble.vx) && Number.isFinite(marble.vy));
  }
}

const kitchenFloor = resolveMapVariantConfig(baseMapConfig, "kitchen-floor");
const kitchenBreakfast = resolveMapVariantConfig(
  baseMapConfig,
  "kitchen-breakfast-spill",
);
const straightForkMap = {
  ...kitchenFloor,
  elements: kitchenFloor.elements.map((element) =>
    element.fixture === "fork" ? { ...element, angle: 0 } : element,
  ),
};

for (const source of [straightForkMap, kitchenFloor, kitchenBreakfast]) {
  const originalSource = JSON.stringify(source);
  const state = createResolvedMapState(source);
  assertMetalBoundary(state);
  assertNeckResponse(state);
  assertDrivenNeckContact(state);
  assert.equal(
    JSON.stringify(source),
    originalSource,
    "map authoring stays unchanged",
  );

  for (const fixture of source.elements.filter(
    (element) => element.fixture && element.fixture !== "fork",
  )) {
    const prepared = state.obstacles.find(
      (obstacle) => obstacle.fixture === fixture.fixture,
    );
    for (const side of [-1, 1]) {
      for (const gap of [-1, 1]) {
        const circle = worldPoint(
          fixture,
          0,
          side * ((fixture.hitboxH ?? fixture.h) / 2 + marbleRadius + gap),
        );
        assert.equal(
          circleObstacleContact(circle, prepared).intersects,
          circleObstacleContact(circle, fixture).intersects,
          `${fixture.fixture} retains its authored collision boundary`,
        );
      }
    }
  }
}

const runtime = createMapRuntime({ initialMap: kitchenFloor });

// A wide display box letterboxes the PNG horizontally: height limits its scale.
// At image center the opaque metal extends approximately 12px up and 14px down.
const wideFork = createResolvedMapState({
  ...kitchenFloor,
  elements: kitchenFloor.elements.map((element) =>
    element.fixture === "fork" ? { ...element, hitboxW: 1500 } : element,
  ),
});
assertNear(
  contactOffset(wideFork, 0, -1),
  -(29 + (12 * 110) / 132),
  2,
  "fork collision must honor height-limited contain scaling above the neck",
);
assertNear(
  contactOffset(wideFork, 0, 1),
  29 + (14 * 110) / 132,
  2,
  "fork collision must honor height-limited contain scaling below the neck",
);

const firstObstacles = runtime.state.obstacles;
runtime.setActiveMap(kitchenBreakfast);
assertMetalBoundary(runtime.state);
assert.notEqual(runtime.state.obstacles, firstObstacles);
runtime.setActiveMap(kitchenFloor);
assertMetalBoundary(runtime.state);
assert.notEqual(runtime.state.obstacles, firstObstacles);
assert.notEqual(
  forkObstacles(runtime.state)[0],
  firstObstacles.find((obstacle) => obstacle.fixture === "fork"),
);

console.log("Fork collision tests passed.");

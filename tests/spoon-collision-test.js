import assert from "node:assert/strict";
import { physicsConfig } from "../core/game-config.js";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
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
import { updatePhysics } from "../core/physics.js";

const radius = 29;
const tolerance = 4;
// Independent alpha > 200 measurements from spoon.png (1024 x 220), displayed
// at 620px width. These include the radius-29 circle envelope of nearby opaque
// pixels, not just the image's vertical outline at that column.
const metalContacts = [
  ["handle", -216.152344, -54.429688, 58.0625],
  ["taper", -164.6875, -48.66909, 52.579652],
  ["handle/neck", -89.003906, -41.912935, 45.347656],
  ["neck", 0, -37.565465, 39.898438],
  ["narrow neck", 53.28125, -36.871094, 39.292969],
  ["flare", 83.554688, -58.434791, 59.408328],
  ["bowl", 113.828125, -75.771588, 75.565547],
  ["bowl middle", 159.238281, -82.886719, 82.28125],
  ["bowl right", 207.675781, -75.565547, 73.556807],
  ["bowl tip", 234.921875, -64.091672, 61.064328],
];
const metalEnds = [-277.2421875, 276.03125];
const bounds = { left: 0, top: 0, right: 4400, bottom: 4400 };

function spoonParts(obstacles) {
  return obstacles.filter((obstacle) => obstacle.fixture === "spoon");
}

function spoonIn(map) {
  return map.elements.find((element) => element.fixture === "spoon");
}

function worldPoint(spoon, x, y) {
  const cos = Math.cos(spoon.angle ?? 0);
  const sin = Math.sin(spoon.angle ?? 0);
  return {
    x: spoon.x + spoon.w / 2 + cos * x - sin * y,
    y: spoon.y + spoon.h / 2 + sin * x + cos * y,
    r: radius,
  };
}

function intersects(parts, spoon, x, y) {
  const circle = worldPoint(spoon, x, y);
  return parts.some((part) => circleObstacleContact(circle, part).intersects);
}

function assertMetalBoundary(
  parts,
  spoon,
  samples = metalContacts,
  ends = metalEnds,
) {
  for (const [region, x, top, bottom] of samples) {
    for (const side of [-1, 1]) {
      const y = side < 0 ? top : bottom;
      const label = `${region}, angle ${spoon.angle}, side ${side}`;
      assert.equal(
        intersects(parts, spoon, x, y + side * tolerance),
        false,
        `${label}: empty space beside visible metal must remain clear`,
      );
      assert.equal(
        intersects(parts, spoon, x, y - side * tolerance),
        true,
        `${label}: visible metal must stop the marble`,
      );
    }
  }
  for (const [index, side] of [-1, 1].entries()) {
    assert.equal(
      intersects(parts, spoon, ends[index] + side * tolerance, 0),
      false,
    );
    assert.equal(
      intersects(parts, spoon, ends[index] - side * tolerance, 0),
      true,
    );
  }
}

function assertNeckResponse(state) {
  const spoon = spoonIn(state.activeMap);
  const parts = spoonParts(state.obstacles);
  for (const side of [-1, 1]) {
    let inner = 0;
    let outer = 100;
    for (let step = 0; step < 40; step++) {
      const middle = (inner + outer) / 2;
      if (intersects(parts, spoon, 0, side * middle)) inner = middle;
      else outer = middle;
    }
    const circle = worldPoint(spoon, 0, side * (inner - 0.25));
    const contact = parts
      .map((part) => circleObstacleContact(circle, part))
      .find((candidate) => candidate.intersects);
    assert.ok(contact);
    const distance = Math.sqrt(contact.distanceSq);
    const nx = contact.dx / distance;
    const ny = contact.dy / distance;
    for (const incoming of [true, false]) {
      const speed = incoming ? -3 : 3;
      const marble = { ...circle, vx: nx * speed, vy: ny * speed };
      const impacts = [];
      handleWallCollisions(
        {
          marble,
          bounds,
          intro: { released: true },
          obstacles: parts,
          physics: physicsConfig,
        },
        (impact) => impacts.push(impact),
      );
      assert.ok(
        (marble.x - circle.x) * nx + (marble.y - circle.y) * ny > 0.2,
        "spoon contact must correct penetration toward its visible edge",
      );
      const expected = incoming ? 3 * physicsConfig.bounce : 3;
      assert.ok(Math.abs(marble.vx * nx + marble.vy * ny - expected) < 1e-8);
      assert.equal(impacts.length, incoming ? 1 : 0);
      if (!incoming) {
        assert.ok(Math.abs(marble.vx - nx * speed) < 1e-8);
        assert.ok(Math.abs(marble.vy - ny * speed) < 1e-8);
      }
    }

    const nxSide = -Math.sin(spoon.angle ?? 0) * side;
    const nySide = Math.cos(spoon.angle ?? 0) * side;
    const marble = { ...worldPoint(spoon, 0, side * 90), vx: 0, vy: 0 };
    const context = {
      marble,
      mapState: state,
      physics: physicsConfig,
      tilt: { smoothX: -nxSide * 18, smoothY: -nySide * 18 },
      intro: { released: true },
      bounds,
    };
    for (let frame = 0; frame < 90; frame++) updatePhysics(context, 1, {});
    const center = worldPoint(spoon, 0, 0);
    const offset =
      (marble.x - center.x) * nxSide + (marble.y - center.y) * nySide;
    const expected = side < 0 ? 37.565465 : 39.898438;
    assert.ok(
      Math.abs(offset - expected) < tolerance,
      "held input must reach the spoon neck without the former gap or tunneling",
    );
    assert.ok(Number.isFinite(marble.vx) && Number.isFinite(marble.vy));
  }
}

const kitchen = resolveMapVariantConfig(baseMapConfig, "kitchen-floor");
const breakfast = resolveMapVariantConfig(
  baseMapConfig,
  "kitchen-breakfast-spill",
);
const straight = {
  ...kitchen,
  elements: kitchen.elements.map((element) =>
    element.fixture === "spoon" ? { ...element, angle: 0 } : element,
  ),
};

for (const map of [straight, kitchen, breakfast]) {
  const original = JSON.stringify(map);
  const state = createResolvedMapState(map);
  const spoon = spoonIn(map);
  assertMetalBoundary(spoonParts(state.obstacles), spoon);
  assertNeckResponse(state);

  // Isolated dynamics callers must use the same metal boundary as the live
  // map runtime; otherwise ants/cereal still collide with the old rectangle.
  const dynamics = createKitchenDynamics();
  dynamics.reset({ mapConfig: state.activeMap, world: map.world });
  assertMetalBoundary(spoonParts(dynamics.state.obstacles), spoon);
  assert.equal(
    JSON.stringify(map),
    original,
    "preparation must not mutate authored placement",
  );
}

// This wide box makes CSS contain scaling height-limited. Expectations remain
// independent image measurements at scale 150/220, not scaled marble radii.
const wide = {
  ...kitchen,
  elements: kitchen.elements.map((element) =>
    element.fixture === "spoon" ? { ...element, hitboxW: 1500 } : element,
  ),
};
assertMetalBoundary(
  spoonParts(createResolvedMapState(wide).obstacles),
  spoonIn(wide),
  [
    ["neck", 0, -38.570615, 41.272727],
    ["narrow neck", 60, -37.863636, 40.590909],
    ["flare", 94.090909, -60.784791, 62.12407],
    ["bowl", 179.318182, -89.681818, 89],
    ["bowl tip", 264.545455, -67.779906, 64.370815],
  ],
  [-308.545455, 307.181818],
);

const runtime = createMapRuntime({ initialMap: kitchen });
const oldPart = spoonParts(runtime.state.obstacles)[0];
oldPart.x += 1000;
oldPart.collisionCenterX += 1000;
runtime.setActiveMap(breakfast);
runtime.setActiveMap(kitchen);
assert.notEqual(spoonParts(runtime.state.obstacles)[0], oldPart);
assertMetalBoundary(spoonParts(runtime.state.obstacles), spoonIn(kitchen));

console.log("Spoon collision tests passed.");

import assert from "node:assert/strict";
import { baseMapConfig } from "../core/map-config.js";
import {
  createMapRuntime,
  createResolvedMapState,
} from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { pointInContainer } from "../core/containers.js";
import { updateCockroach } from "../core/cockroach.js";
import { cockroachConfig } from "../core/game-config.js";
import { physicsConfig } from "../core/game-config.js";
import { updatePhysics } from "../core/physics.js";
import { circleObstacleContact } from "../core/physics-collisions.js";
import {
  cupCutawayShape,
  renderObstacleWalls,
  renderContainerOccupants,
} from "../rendering/obstacle-rendering.js";
import { FakeElement } from "./test-dom.js";

const map = resolveMapVariantConfig(baseMapConfig, "kitchen-floor");
const authoredCup = map.elements.find((e) => e.fixture === "tippedCup");
function world(cup, x, y, r = 29) {
  return {
    x: cup.x + cup.w / 2 + Math.cos(cup.angle) * x - Math.sin(cup.angle) * y,
    y: cup.y + cup.h / 2 + Math.sin(cup.angle) * x + Math.cos(cup.angle) * y,
    r,
    vx: 0,
    vy: 0,
  };
}
function scenario(
  angle = authoredCup.angle,
  start = [-280, 45],
  target = [0, 45],
) {
  const cup = { ...authoredCup, angle };
  const state = createResolvedMapState({ ...map, elements: [cup] });
  const roach = state.cockroach;
  Object.assign(roach, world(cup, ...start, 24), {
    mode: "harass",
    engaged: true,
    modeFrames: 100000,
    harassmentIn: 100000,
  });
  return { cup, state, roach, target: world(cup, ...target) };
}
function reach(s, target, inside, steps = [1], duration = 600) {
  let elapsed = 0,
    index = 0;
  while (elapsed < duration) {
    const previous = { x: s.roach.x, y: s.roach.y };
    const dt = Math.min(steps[index++ % steps.length], duration - elapsed);
    updateCockroach(s.roach, target, dt, s.state);
    elapsed += dt;
    const distance = Math.hypot(s.roach.x - previous.x, s.roach.y - previous.y);
    assert.ok(
      distance <= cockroachConfig.harassSpeed * (dt + 0.5) + 1e-7,
      "guidance never teleports the insect",
    );
    for (let i = 0; i <= Math.ceil(distance / 2); i++) {
      const t = i / Math.max(1, Math.ceil(distance / 2));
      const probe = {
        x: previous.x + (s.roach.x - previous.x) * t,
        y: previous.y + (s.roach.y - previous.y) * t,
        r: s.roach.r,
      };
      assert.ok(
        s.state.obstacles.every(
          (o) => !circleObstacleContact(probe, o).intersects,
        ),
        "the whole pursuit path stays clear of ceramic and other solids",
      );
    }
    if (
      Math.hypot(s.roach.x - target.x, s.roach.y - target.y) < 52 &&
      pointInContainer(s.state.containers[0], s.roach) === inside
    )
      return elapsed;
  }
  assert.fail(
    `pursuit stalled: ${JSON.stringify({ angle: s.cup.angle, roach: [s.roach.x, s.roach.y], target: [target.x, target.y], mode: s.roach.mode })}`,
  );
}

assert.ok(
  cockroachConfig.radius + 3 <= map.spawn.r,
  "the conservative route probe still fits every marble-clear passage",
);
for (const angle of [0, Math.PI / 2, -0.4]) {
  for (const [w, h] of [
    [380, 380],
    [760, 500],
  ]) {
    const cup = { ...authoredCup, angle, w, h };
    const container = createResolvedMapState({ ...map, elements: [cup] })
      .containers[0];
    const scale = Math.min(w / 1261, h / 1247);
    const imagePoint = (x, y) =>
      world(cup, (x - 1261 / 2) * scale, (y - 1247 / 2) * scale);
    assert.equal(pointInContainer(container, imagePoint(650, 760)), true);
    assert.equal(
      pointInContainer(container, imagePoint(600, 300)),
      false,
      "the transparent handle is not the interior",
    );
    assert.ok(
      container.opening.left > container.interior.left &&
        container.opening.right === container.interior.right &&
        container.opening.top > container.interior.top &&
        container.opening.bottom < container.interior.bottom,
      "the exposed mouth stays between the solid rim pieces",
    );
  }
}
for (const angle of [0, Math.PI / 2, -0.4]) {
  for (const start of [
    [-280, 45],
    [0, -300],
    [0, 300],
    [280, 45],
  ]) {
    for (const target of [
      [0, 45],
      [-50, 35],
      [80, 20],
    ]) {
      const s = scenario(angle, start, target);
      assert.ok(
        s.state.obstacles.every(
          (o) => !circleObstacleContact(s.target, o).intersects,
        ),
        "the target is a physically marble-accessible interior position",
      );
      const sourceBefore = globalThis.structuredClone(s.state.activeMap);
      reach(s, s.target, true);
      assert.equal(
        s.roach.mode,
        "harass",
        "entering is not an automatic escape",
      );
      const outside = world(s.cup, 280, 45);
      reach(s, outside, false);
      reach(s, world(s.cup, -280, 45), false);
      assert.deepEqual(
        s.state.activeMap,
        sourceBefore,
        "guidance does not alter authored placement",
      );
    }
  }
}
for (const steps of [[0.5], [1], [2], [0.13, 0.8, 1.17, 2.2]]) {
  const s = scenario();
  reach(s, s.target, true, steps);
  reach(s, world(s.cup, 280, 45), false, steps);
  assert.equal(s.roach.mode, "harass");
}
// Compare a fixed elapsed interval too, without sampling a moving arrival.
let reference = null;
for (const steps of [[0.5], [1], [2], [0.13, 0.8, 1.17, 2.2]]) {
  const s = scenario();
  let elapsed = 0,
    index = 0;
  while (elapsed < 90) {
    const dt = Math.min(steps[index++ % steps.length], 90 - elapsed);
    updateCockroach(s.roach, s.target, dt, s.state);
    elapsed += dt;
  }
  reference ??= [s.roach.x, s.roach.y];
  assert.ok(
    Math.hypot(s.roach.x - reference[0], s.roach.y - reference[1]) < 1e-7,
    "fixed-tick routing is independent of update partitioning",
  );
}

// A 60-unit passage fits the radius-29 marble and must also admit the roach.
const narrow = scenario(Math.PI / 2, [420, 45]);
narrow.state.obstacles.push(
  { x: 2400, y: 1460, w: 115, h: 250 },
  { x: 2575, y: 1460, w: 200, h: 250 },
);
const marble = world(narrow.cup, 420, 45);
const actor = narrow.state.cockroach;
narrow.state.cockroach = null;
const context = {
  marble,
  mapState: narrow.state,
  physics: physicsConfig,
  intro: { released: true },
  bounds: { left: 0, top: 0, right: 4400, bottom: 4400 },
  tilt: { smoothX: 0, smoothY: -18 },
};
for (let i = 0; i < 100; i++) updatePhysics(context, 1, {});
assert.ok(
  marble.y < 1300,
  "the marble can traverse the narrow passage into the cup",
);
narrow.state.cockroach = actor;
reach(narrow, narrow.target, true);

// The mouth sits only 58.5 units from a world edge: the marble can still
// approach it. Roach guides must use the roach's fitting footprint too.
const edgeCup = { ...authoredCup, angle: 0, x: 4000.96 };
const edgeState = createResolvedMapState({ ...map, elements: [edgeCup] });
Object.assign(edgeState.cockroach, world(edgeCup, -280, 45, 24), {
  mode: "harass",
  engaged: true,
  modeFrames: 10000,
  decisionIn: 0,
});
reach(
  { cup: edgeCup, state: edgeState, roach: edgeState.cockroach },
  world(edgeCup, 0, 45),
  true,
);

const blocked = scenario();
const barrier = { type: "obstacle", x: 2300, y: 1420, w: 600, h: 35 };
blocked.state.obstacles.push(barrier);
for (let i = 0; i < 300; i++) {
  updateCockroach(blocked.roach, blocked.target, 1, blocked.state);
  assert.ok(
    blocked.state.obstacles.every(
      (o) => !circleObstacleContact(blocked.roach, o).intersects,
    ),
  );
  assert.equal(
    pointInContainer(blocked.state.containers[0], blocked.roach),
    false,
    "a blocked mouth cannot be bypassed through a wall",
  );
}
blocked.state.obstacles.pop();
reach(blocked, blocked.target, true);
const runtime = createMapRuntime({ initialMap: map });
const old = runtime.state.containers[0];
runtime.state.cockroach.routeX = 100;
runtime.setActiveMap(map);
assert.notEqual(runtime.state.containers[0], old);
assert.equal(runtime.state.cockroach.routeX, null);
runtime.setActiveMap(resolveMapVariantConfig(baseMapConfig, "living-room"));
assert.deepEqual(runtime.state.containers, []);

// The rear opening fits occupants instead of stretching the full mouth height.
// Check real geometry bounds and continuity, independently of CSS path syntax.
for (const angle of [0, Math.PI / 2, -0.4]) {
  const s = scenario(angle);
  const c = s.state.containers[0];
  const centerY = (c.opening.top + c.opening.bottom) / 2;
  const shape = (body, insect = null) => cupCutawayShape(c, body, insect, {});
  const rest = shape(null);
  assert.equal(rest.left, c.opening.left);
  assert.equal(rest.top, c.opening.top);
  assert.equal(rest.bottom, c.opening.bottom);
  for (const r of [24, 29]) {
    for (const x of [c.interior.right - 0.01, c.interior.right + 0.01]) {
      const atMouth = world(s.cup, x, centerY, r);
      assert.ok(
        s.state.obstacles.every(
          (part) => !circleObstacleContact(atMouth, part).intersects,
        ),
        "the body can straddle the open mouth at the center boundary",
      );
      assert.deepEqual(
        shape(atMouth),
        rest,
        "crossing the center boundary at the rim leaves the ordinary aperture intact",
      );
    }
    const body = world(s.cup, 0, centerY, r);
    const occupied = shape(body);
    assert.ok(
      occupied.bottom - occupied.top > 2 * r,
      "interior remains visible around the body",
    );
    assert.ok(
      occupied.bottom - occupied.top < c.opening.bottom - c.opening.top,
      "a single body must not expose the mouth's full height all the way back",
    );
    assert.ok(occupied.radius > r, "the rear edge curves around the occupant");
    assert.deepEqual(
      shape(null, body),
      occupied,
      "both actors share the same contour",
    );
    const threshold = c.opening.left + r;
    const positions = [
      threshold + 1,
      threshold,
      threshold - 1e-6,
      threshold - r / 2,
      threshold - r,
      0,
    ];
    const entry = positions.map((x) => shape(world(s.cup, x, centerY, r)));
    const exit = [...positions]
      .reverse()
      .map((x) => shape(world(s.cup, x, centerY, r)));
    assert.deepEqual(
      exit.reverse(),
      entry,
      "hovering/reversal has no history or delayed fade",
    );
    for (const key of ["left", "top", "bottom", "radius"])
      assert.ok(
        Math.abs(entry[2][key] - rest[key]) < 2e-6,
        "crossing the reveal threshold cannot switch to a full-sized window",
      );
    for (const y of [c.interior.top + r, centerY, c.interior.bottom - r]) {
      const offCenter = shape(world(s.cup, 0, y, r));
      assert.ok(
        offCenter.top >= c.interior.top &&
          offCenter.bottom <= c.interior.bottom,
      );
      assert.ok(offCenter.left >= c.interior.left);
    }
  }
  const resident = world(s.cup, 0, centerY - 20, 24);
  const alone = shape(null, resident);
  const entrant = world(s.cup, c.opening.left + 29 - 1e-6, centerY + 50);
  const together = shape(entrant, resident);
  for (const key of ["left", "top", "bottom", "radius"])
    assert.ok(
      Math.abs(together[key] - alone[key]) < 1e-6,
      "a second entrant cannot pop an already occupied opening to another shape",
    );

  const backRoach = world(s.cup, -70, 115, 24);
  const oppositeMarble = world(s.cup, -37, -20, 29);
  assert.ok(
    [backRoach, oppositeMarble].every((body) =>
      s.state.obstacles.every(
        (part) => !circleObstacleContact(body, part).intersects,
      ),
    ),
    "the simultaneous rear-corner poses are physically clear",
  );
  const rearCorner = shape(oppositeMarble, backRoach);
  assert.ok(
    rearCorner.left + rearCorner.radius <= -70 + 1e-9,
    "the rear wall clamp cannot push the rounded shoulders ahead of the roach",
  );
}

// In a larger cup the mouth's ellipse can be deeper than either body radius.
// A center within that ellipse still leaves it alone until the body reaches
// the ceramic behind it.
{
  const cup = { ...authoredCup, angle: 0, w: 760, h: 760 };
  const state = createResolvedMapState({ ...map, elements: [cup] });
  const c = state.containers[0];
  const r = state.cockroach.r;
  const body = world(cup, c.opening.left + r + 1, 80, r);
  assert.equal(pointInContainer(c, body), true);
  assert.deepEqual(
    cupCutawayShape(c, null, body, {}),
    cupCutawayShape(c, null, null, {}),
    "a body that has not reached the cutaway cannot reshape the mouth",
  );
}

const originalDocument = globalThis.document;
globalThis.document = { createElement: () => new FakeElement() };
try {
  const s = scenario();
  const layer = new FakeElement();
  renderObstacleWalls(layer, s.state.obstacles, { mapConfig: map });
  const sprite = layer.children.find((e) => e.className === "kitchenCupSprite");
  const outside = world(s.cup, 260, 45);
  renderContainerOccupants(layer, s.state.containers, outside, null);
  const closed = sprite.style.properties["--cup-clip"];
  assert.ok(closed.startsWith("path(evenodd,"), "the mouth is a real aperture");
  const interior = layer.children.find(
    (e) => e.className === "kitchenCupInterior",
  );
  assert.ok(interior, "the cavity is below actors, not a glyph on the surface");
  assert.equal(sprite.children.length, 0, "no silhouette canvas remains");
  const children = [...layer.children];
  // This was physically outside but its enlarged antenna envelope previously
  // drew an insect on the ceramic. It must leave the ordinary opening alone.
  Object.assign(s.roach, world(s.cup, -140, -88, 24));
  assert.equal(pointInContainer(s.state.containers[0], s.roach), false);
  renderContainerOccupants(layer, s.state.containers, outside, s.roach);
  assert.equal(sprite.style.properties["--cup-clip"], closed);
  const entering = world(s.cup, 135, 45);
  renderContainerOccupants(layer, s.state.containers, entering, null);
  const partial = sprite.style.properties["--cup-clip"];
  assert.notEqual(
    partial,
    closed,
    "the cutaway starts with the leading extent",
  );
  renderContainerOccupants(
    layer,
    s.state.containers,
    world(s.cup, 134, 45),
    null,
  );
  assert.notEqual(sprite.style.properties["--cup-clip"], partial);
  const inside = world(s.cup, 0, 45);
  const before = globalThis.structuredClone(s.state);
  renderContainerOccupants(layer, s.state.containers, inside, null);
  const marbleCut = sprite.style.properties["--cup-clip"];
  Object.assign(s.roach, inside);
  const roachBefore = { ...s.roach };
  const marbleBefore = { ...outside };
  renderContainerOccupants(layer, s.state.containers, outside, s.roach);
  assert.deepEqual(
    s.roach,
    roachBefore,
    "visibility cannot advance the insect",
  );
  assert.deepEqual(outside, marbleBefore, "visibility cannot move the marble");
  assert.equal(
    sprite.style.properties["--cup-clip"],
    marbleCut,
    "identical bodies get identical visibility regardless of creature type",
  );
  renderContainerOccupants(layer, s.state.containers, inside, s.roach);
  assert.equal(sprite.style.properties["--cup-clip"], marbleCut);
  assert.deepEqual(
    layer.children,
    children,
    "repeated frames reuse two static layers",
  );
  assert.deepEqual(
    s.state.obstacles,
    before.obstacles,
    "visibility cannot alter solids",
  );
  renderContainerOccupants(layer, s.state.containers, outside, null);
  assert.equal(
    sprite.style.properties["--cup-clip"],
    closed,
    "exiting restores ceramic",
  );
  renderObstacleWalls(layer, [], { mapConfig: map });
  assert.equal(
    interior.parent,
    null,
    "removing the cup removes its cavity too",
  );
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}
console.log("Container geometry, navigation and cutaway tests passed.");

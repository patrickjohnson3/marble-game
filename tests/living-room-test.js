import assert from "node:assert/strict";
import { livingRoomMap } from "../maps/living-room.js";
import { expandMap } from "../maps/map-authoring.js";
import { createResolvedMapState } from "../core/map-runtime.js";
import { physicsConfig } from "../core/game-config.js";
import { circleObstacleContact } from "../core/physics-collisions.js";
import { updatePhysics } from "../core/physics.js";
import {
  renderLivingRoom,
  renderLivingRoomFixtures,
} from "../rendering/living-room-rendering.js";
import { renderRoughPatches } from "../rendering/rough-patch-rendering.js";
import { renderObstacleHitboxes } from "../rendering/obstacle-rendering.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function withFakeDocument(callback) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: (tag) =>
      tag === "canvas" ? new FakeCanvasElement() : new FakeElement(),
  };
  try {
    return callback();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

const authoredMap = expandMap(livingRoomMap);
const { obstacles } = createResolvedMapState(authoredMap);

function worldPoint(fixture, localX, localY) {
  const cos = Math.cos(fixture.angle);
  const sin = Math.sin(fixture.angle);
  return {
    x: fixture.x + fixture.w / 2 + cos * localX - sin * localY,
    y: fixture.y + fixture.h / 2 + sin * localX + cos * localY,
    r: livingRoomMap.spawn.r,
  };
}

for (const fixture of obstacles) {
  for (const [nx, ny] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    for (const [gap, intersects] of [
      [-0.1, true],
      [0.1, false],
    ]) {
      const r = livingRoomMap.spawn.r + gap;
      const point = worldPoint(
        fixture,
        nx * (fixture.w / 2 + r),
        ny * (fixture.h / 2 + r),
      );
      assert.equal(
        circleObstacleContact(point, fixture).intersects,
        intersects,
        `${fixture.fixture}: collision should track every visible side, including rotated toys`,
      );
    }
  }
  for (const [gap, intersects] of [
    [-0.1, true],
    [0.1, false],
  ]) {
    const radialDistance =
      (fixture.cornerRadius + livingRoomMap.spawn.r + gap) / Math.SQRT2;
    const point = worldPoint(
      fixture,
      fixture.w / 2 - fixture.cornerRadius + radialDistance,
      fixture.h / 2 - fixture.cornerRadius + radialDistance,
    );
    assert.equal(
      circleObstacleContact(point, fixture).intersects,
      intersects,
      `${fixture.fixture}: visible rounded corners must share their collision radius`,
    );
  }
}

withFakeDocument(() => {
  const container = new FakeElement();
  renderLivingRoomFixtures(container, obstacles);
  const items = container.firstChild.children;
  assert.equal(items.length, obstacles.length);
  items.forEach((item, index) => {
    const fixture = obstacles[index];
    assert.equal(item.style.left, fixture.x + "px");
    assert.equal(item.style.top, fixture.y + "px");
    assert.equal(item.style.width, fixture.w + "px");
    assert.equal(item.style.height, fixture.h + "px");
    assert.equal(item.style.transform, `rotate(${fixture.angle}rad)`);
    assert.equal(item.style.borderRadius, fixture.cornerRadius + "px");
  });

  const hitboxes = new FakeElement();
  renderObstacleHitboxes(hitboxes, obstacles);
  const hitboxCalls = hitboxes.firstChild.context.calls.filter((call) =>
    ["transform", "roundRect"].includes(call[0]),
  );
  assert.equal(hitboxCalls.length, obstacles.length * 2);
  assert.ok(
    hitboxCalls.every((call) => call.slice(1).every(Number.isFinite)),
    "rounded authored fixtures without separate hitbox dimensions must render finite overlays",
  );
  const rectangles = hitboxCalls.filter((call) => call[0] === "roundRect");
  rectangles.forEach((call, index) => {
    assert.equal(call[3], obstacles[index].w);
    assert.equal(call[4], obstacles[index].h);
  });

  const underlay = new FakeElement();
  const overlay = new FakeElement();
  renderLivingRoom({
    underlay,
    overlay,
    mapConfig: authoredMap,
    world: livingRoomMap.world,
  });
  assert.equal(underlay.children.length, 1, "floor has no duplicate rug");
  assert.equal(underlay.firstChild.style.width, "4400px");
  assert.equal(overlay.children.length, authoredMap.scenery.length);
  assert.equal(
    overlay.children.every((item) =>
      item.className.includes("livingRoomDressing"),
    ),
    true,
    "theme dressing must not independently place visible furniture",
  );
});

const rug = authoredMap.elements.find((element) => element.material === "shag");

function drivenDistance(roughPatches) {
  const marble = { x: rug.x + 150, y: rug.y + 150, r: 29, vx: 0, vy: 0 };
  const context = {
    marble,
    bounds: { left: 0, top: 0, right: 4400, bottom: 4400 },
    intro: { released: true },
    tilt: { smoothX: 8, smoothY: 0 },
    physics: { ...physicsConfig },
    mapState: {
      obstacles: [],
      terrainByType: { roughPatch: { elements: roughPatches } },
    },
  };
  const start = marble.x;
  for (let frame = 0; frame < 120; frame += 1) {
    updatePhysics(context, 1, { onImpact: () => {}, onSurface: () => {} });
  }
  return { distance: marble.x - start, vx: marble.vx };
}

const bareFloor = drivenDistance([]);
const shagFloor = drivenDistance([rug]);
assert.ok(shagFloor.distance > 0, "sustained tilt must make progress on shag");
assert.ok(
  shagFloor.distance < bareFloor.distance,
  "the authored rug must slow traversal relative to normal flooring",
);
assert.ok(shagFloor.vx < bareFloor.vx, "shag should reduce driven speed");

withFakeDocument(() => {
  const first = new FakeElement();
  const second = new FakeElement();
  renderRoughPatches(first, [rug]);
  renderRoughPatches(second, [rug]);
  const calls = first.firstChild.context.calls;
  assert.ok(
    calls.some(
      (call) =>
        JSON.stringify(call) ===
        JSON.stringify(["fillRect", rug.x, rug.y, rug.w, rug.h]),
    ),
    "the visible carpet backing must match its terrain rectangle",
  );
  assert.deepEqual(calls, second.firstChild.context.calls);
  assert.equal(
    calls.filter((call) => call[0] === "stroke").length,
    3,
    "static fibers are batched instead of stroked individually",
  );
});

console.log("Living room tests passed");

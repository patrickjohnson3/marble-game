import assert from "node:assert/strict";
import { baseMapConfig } from "../core/map-config.js";
import { createResolvedMapState } from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { circleObstacleContact } from "../core/physics-collisions.js";
import { renderObstacleWalls } from "../rendering/obstacle-rendering.js";
import { FakeElement } from "./test-dom.js";

const map = resolveMapVariantConfig(baseMapConfig, "kitchen-floor");
const runtime = createResolvedMapState(map);
const cup = map.elements.find((item) => item.fixture === "tippedCup");
const cupParts = runtime.obstacles.filter(
  (item) => item.fixture === "tippedCup",
);
assert.ok(cupParts.length > 1);

// Independent alpha > 200 measurements of tipped-cup.webp (1261 x 1247),
// displayed at 380px width, including the radius-29 marble envelope. These
// sample the body, handle, and rim, rather than deriving an oracle from parts.
const silhouette = [
  [-138.7708, -89.9737, 178.2218],
  [-69.4607, -172.0169, 179.8247],
  [-0.1507, -191.8222, 179.8247],
  [66.1459, -166.8042, 179.8247],
  [132.4425, -96.249, 180.463],
];
for (const angle of [0, cup.angle, -0.4]) {
  const state = createResolvedMapState({
    ...map,
    elements: [{ ...cup, angle }],
  });
  function intersects(x, y) {
    const circle = {
      x: cup.x + cup.w / 2 + Math.cos(angle) * x - Math.sin(angle) * y,
      y: cup.y + cup.h / 2 + Math.sin(angle) * x + Math.cos(angle) * y,
      r: 29,
    };
    return state.obstacles.some(
      (part) => circleObstacleContact(circle, part).intersects,
    );
  }
  for (const [x, top, bottom] of silhouette) {
    for (const [boundary, side] of [
      [top, -1],
      [bottom, 1],
    ]) {
      assert.equal(
        intersects(x, boundary + side * 4),
        false,
        "empty space beside the cup remains clear",
      );
      assert.equal(
        intersects(x, boundary - side * 4),
        true,
        "visible ceramic stops the marble",
      );
    }
  }
  assert.equal(
    intersects(-9.1911, -97.4861),
    false,
    "a marble fits inside the visible handle opening",
  );
  assert.equal(intersects(0, 50), true, "the cup body is solid");
}

const feet = runtime.obstacles.filter(
  (item) => item.fixture === "applianceFoot",
);
assert.equal(feet.length, 2);
for (const foot of feet) {
  assert.equal(
    circleObstacleContact({ x: foot.x + 1, y: foot.y + 1, r: 1 }, foot)
      .intersects,
    false,
    "round feet have empty corners",
  );
  assert.equal(
    circleObstacleContact(
      { x: foot.x + foot.w - 1, y: foot.y + foot.h / 2, r: 1 },
      foot,
    ).intersects,
    true,
  );
}
assert.equal(
  runtime.obstacles.some(
    (item) =>
      circleObstacleContact({ x: 340, y: 2100, r: 29 }, item).intersects,
  ),
  false,
  "the gap between appliance feet remains playable",
);

const originalDocument = globalThis.document;
globalThis.document = { createElement: () => new FakeElement() };
try {
  const container = new FakeElement();
  const sourceBefore = globalThis.structuredClone(runtime.obstacles);
  renderObstacleWalls(container, runtime.obstacles, { mapConfig: map });
  const layer = container.firstChild;
  const sprites = [...layer.children];
  assert.equal(
    sprites.length,
    map.elements.filter((item) => item.fixture).length,
    "composite collision pieces render as one prop",
  );
  assert.equal(
    sprites.filter((sprite) => sprite.className === "kitchenCupSprite").length,
    1,
  );
  for (const fixture of runtime.obstacles.filter((item) =>
    ["cabinetBase", "applianceBase", "applianceFoot"].includes(item.fixture),
  )) {
    const sprite = sprites.find(
      (item) =>
        item.style.left === fixture.x + "px" &&
        item.style.top === fixture.y + "px",
    );
    assert.ok(sprite);
    assert.equal(sprite.style.width, fixture.w + "px");
    assert.equal(sprite.style.height, fixture.h + "px");
    assert.equal(sprite.style.borderRadius, (fixture.cornerRadius ?? 0) + "px");
  }
  renderObstacleWalls(container, runtime.obstacles, { mapConfig: map });
  assert.deepEqual(
    layer.children,
    sprites,
    "redrawing retains existing fixture DOM nodes",
  );
  assert.deepEqual(
    runtime.obstacles,
    sourceBefore,
    "rendering owns no collision state",
  );
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}

console.log("Kitchen fixture tests passed.");

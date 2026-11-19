import assert from "node:assert/strict";
import { baseMapConfig } from "../core/map-config.js";
import { physicsConfig } from "../core/game-config.js";
import { updatePhysics } from "../core/physics.js";
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
    cockroach: undefined, // Isolate cup contact from the independently moving pest.
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
  assert.equal(intersects(0, 45), false, "the cup has a hollow interior");

  for (const steps of [[0.5], [1], [2], [0.13, 0.8, 1.17, 2.2]]) {
    function drive(startX, startY, directionX, directionY) {
      const marble = {
        x:
          cup.x +
          cup.w / 2 +
          Math.cos(angle) * startX -
          Math.sin(angle) * startY,
        y:
          cup.y +
          cup.h / 2 +
          Math.sin(angle) * startX +
          Math.cos(angle) * startY,
        r: 29,
        vx: 0,
        vy: 0,
      };
      const context = {
        marble,
        mapState: state,
        physics: physicsConfig,
        intro: { released: true },
        bounds: { left: 0, top: 0, right: 4400, bottom: 4400 },
        tilt: {
          smoothX:
            18 * (Math.cos(angle) * directionX - Math.sin(angle) * directionY),
          smoothY:
            18 * (Math.sin(angle) * directionX + Math.cos(angle) * directionY),
        },
      };
      let elapsed = 0;
      let index = 0;
      while (elapsed < 90) {
        const dt = Math.min(steps[index++ % steps.length], 90 - elapsed);
        updatePhysics(context, dt, {});
        elapsed += dt;
      }
      const dx = marble.x - cup.x - cup.w / 2;
      const dy = marble.y - cup.y - cup.h / 2;
      return {
        x: Math.cos(angle) * dx + Math.sin(angle) * dy,
        y: -Math.sin(angle) * dx + Math.cos(angle) * dy,
      };
    }
    // +X is the mouth. The visible back is near local x=-164, and the side
    // walls near y=-66 and y=152. These bounds prove containment without
    // copying individual collision parts or asserting arbitrary speed tuning.
    const entered = drive(240, 45, -1, 0);
    assert.ok(
      entered.x < -30 && entered.x > -135,
      "normal movement enters through the mouth and stops at the closed back",
    );
    const exited = drive(entered.x, entered.y, 1, 0);
    assert.ok(exited.x > 240, "normal movement can exit the cup again");
    assert.ok(
      drive(-260, 45, 1, 0).x < -160,
      "the closed back prevents entry from behind",
    );
    assert.ok(
      drive(0, 45, 0, -1).y > -66,
      "the inner upper wall contains the marble",
    );
    assert.ok(
      drive(0, 45, 0, 1).y < 152,
      "the inner lower wall contains the marble",
    );
    assert.ok(
      drive(0, -260, 0, 1).y < -66,
      "the outer upper wall remains solid",
    );
    assert.ok(
      drive(0, 260, 0, -1).y > 152,
      "the outer lower wall remains solid",
    );
  }

  // Overspeed may follow a pest shove. Even across a long supported frame,
  // neither a direct back-wall strike nor a grazing rim hit may tunnel through.
  for (const [x, y, vx, vy] of [
    [0, 45, -35, 0],
    [210, -70, -30, 12],
  ]) {
    const marble = {
      x: cup.x + cup.w / 2 + Math.cos(angle) * x - Math.sin(angle) * y,
      y: cup.y + cup.h / 2 + Math.sin(angle) * x + Math.cos(angle) * y,
      vx: Math.cos(angle) * vx - Math.sin(angle) * vy,
      vy: Math.sin(angle) * vx + Math.cos(angle) * vy,
      r: 29,
    };
    const context = {
      marble,
      mapState: state,
      physics: physicsConfig,
      intro: { released: true },
      bounds: { left: 0, top: 0, right: 4400, bottom: 4400 },
      tilt: { smoothX: 0, smoothY: 0 },
    };
    for (let i = 0; i < 30; i++) {
      updatePhysics(context, 2.2, {});
      assert.ok(
        state.obstacles.every((part) => {
          const contact = circleObstacleContact(marble, part);
          // The contact predicate includes tangency. Allow floating-point
          // roundoff at a resting surface, but no meaningful penetration.
          return (
            !contact.intersects ||
            (contact.insideDistance === 0 &&
              contact.distanceSq >= (marble.r - 1e-7) ** 2)
          );
        }),
        "fast contact does not penetrate the solid rim or walls",
      );
      const dx = marble.x - cup.x - cup.w / 2;
      const dy = marble.y - cup.y - cup.h / 2;
      assert.ok(
        Math.cos(angle) * dx + Math.sin(angle) * dy > -135,
        "an interior or mouth approach cannot emerge behind the closed back",
      );
    }
  }
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
  const cupSprite = container.children.find(
    (sprite) => sprite.className === "kitchenCupSprite",
  );
  assert.ok(
    cupSprite,
    "the overhead cup sprite is outside the ordinary fixture stacking context",
  );
  assert.equal(
    sprites.length + 1,
    map.elements.filter((item) => item.fixture).length,
    "composite collision pieces render as one prop",
  );
  assert.equal(
    container.children.length,
    2,
    "one overhead sprite serves all cup collision parts",
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
  assert.equal(
    container.children[1],
    cupSprite,
    "redrawing reuses the overhead cup sprite",
  );
  assert.deepEqual(
    runtime.obstacles,
    sourceBefore,
    "rendering owns no collision state",
  );
  renderObstacleWalls(
    container,
    runtime.obstacles.filter((item) => item.fixture !== "tippedCup"),
    { mapConfig: map },
  );
  assert.equal(
    container.children.length,
    1,
    "a removed cup leaves no stale overhead surface",
  );
  renderObstacleWalls(container, createResolvedMapState(map).obstacles, {
    mapConfig: map,
  });
  assert.equal(
    container.children.length,
    2,
    "Retry reconstructs one fresh overhead surface",
  );
  assert.notEqual(container.children[1], cupSprite);
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}

console.log("Kitchen fixture tests passed.");

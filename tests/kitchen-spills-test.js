import assert from "node:assert/strict";
import { physicsConfig } from "../core/game-config.js";
import { pointInEllipsePatch } from "../core/geometry.js";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
import { baseMapConfig } from "../core/map-config.js";
import { ELLIPTICAL_SURFACE_SHAPES } from "../core/map-elements.js";
import { createMapRuntime } from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { updatePhysics } from "../core/physics.js";
import { renderGooPatches } from "../rendering/goo-patch-rendering.js";
import { renderWaterPatches } from "../rendering/water-patch-rendering.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function stepOnSurface(mapState, x, y, radius = 29) {
  const marble = { x, y, vx: 0.5, vy: 0, r: radius };
  const surfaces = [];
  updatePhysics(
    {
      marble,
      mapState,
      bounds: { left: 0, top: 0, right: 4400, bottom: 4400 },
      intro: { released: true },
      tilt: { smoothX: 0, smoothY: 0 },
      physics: physicsConfig,
    },
    1,
    {
      onImpact: () => assert.fail("splash drops must not block the marble"),
      onSurface: () => {},
      onTerrain: (surface) => surfaces.push(surface),
    },
  );
  return { marble, surfaces };
}

function testKitchenSplashFootprints() {
  for (const id of ["kitchen-floor", "kitchen-breakfast-spill"]) {
    const source = resolveMapVariantConfig(baseMapConfig, id);
    const runtime = createMapRuntime({ initialMap: source });
    for (const type of ["waterPatch", "gooPatch"]) {
      const patches = runtime.state.terrainByType[type].elements;
      const [main, ...drops] = patches;
      assert.ok(drops.length > 0, "each spill should include detached drops");
      assert.ok(
        patches.every((patch) => patch.w * patch.h <= main.w * main.h),
        "the main puddle must stay first for sponge ownership",
      );
      const shape = ELLIPTICAL_SURFACE_SHAPES[type];
      for (const drop of drops) {
        assert.ok(
          drop.x >= main.x &&
            drop.y >= main.y &&
            drop.x + drop.w <= main.x + main.w &&
            drop.y + drop.h <= main.y + main.h,
          "satellite drops must not enlarge the retained terrain canvas",
        );
        for (let sample = 0; sample < 96; sample++) {
          const angle = (sample * Math.PI) / 48;
          const localX = drop.w * shape.radiusX * Math.cos(angle);
          const localY = drop.h * shape.radiusY * Math.sin(angle);
          assert.equal(
            pointInEllipsePatch(
              drop.x +
                drop.w * shape.centerX +
                localX * shape.cos -
                localY * shape.sin,
              drop.y +
                drop.h * shape.centerY +
                localX * shape.sin +
                localY * shape.cos,
              main,
              shape,
              7,
            ),
            false,
            "a detached drop must clear the main wet body and its meniscus, avoiding doubled rims",
          );
        }
        const { marble, surfaces } = stepOnSurface(
          runtime.state,
          drop.x + drop.w * shape.centerX,
          drop.y + drop.h * shape.centerY,
        );
        assert.deepEqual(surfaces, [type]);
        const retention = physicsConfig[`${type}DragRetention`];
        assert.ok(
          Math.abs(
            marble.vx - 0.5 * physicsConfig.baseDragRetention * retention,
          ) < 1e-12,
          "a visible splash must apply exactly the existing terrain drag",
        );
        const dryCorner = stepOnSurface(runtime.state, drop.x, drop.y, 1);
        assert.deepEqual(
          dryCorner.surfaces,
          ["floor"],
          "transparent drop corners must remain dry, not become rectangular terrain",
        );
      }
    }
  }
}

function testSpongeKeepsMainPuddleOwnership() {
  const source = resolveMapVariantConfig(baseMapConfig, "kitchen-floor");
  const original = globalThis.structuredClone(source.elements);
  const runtime = createMapRuntime({ initialMap: source });
  const dynamics = createKitchenDynamics();
  const reset = () =>
    dynamics.reset({
      mapConfig: runtime.state.activeMap,
      obstacles: runtime.state.obstacles,
      waterPatches: runtime.state.terrainByType.waterPatch.elements,
      world: runtime.state.activeMap.world,
    });
  reset();
  const [main, ...drops] = runtime.state.terrainByType.waterPatch.elements;
  const originalDrops = globalThis.structuredClone(drops);
  assert.equal(dynamics.state.waterPatch, main);
  const widthBefore = main.w;
  const sponge = dynamics.state.sponge;
  sponge.collisionCenterX = main.x + main.w * 0.5;
  sponge.collisionCenterY = main.y + main.h * 0.52;
  sponge.x = sponge.collisionCenterX - sponge.w * 0.5;
  sponge.y = sponge.collisionCenterY - sponge.h * 0.5;
  dynamics.state.spongeDisturbed = true;
  const marble = { x: 4000, y: 4000, r: 29, vx: 0, vy: 0 };
  dynamics.update(runtime.state.activeMap, marble, marble, 1);
  assert.ok(
    main.w < widthBefore,
    "the sponge must still shrink the main puddle",
  );
  assert.deepEqual(
    drops,
    originalDrops,
    "detached drops remain separate spills",
  );
  assert.deepEqual(
    source.elements,
    original,
    "absorption must not mutate the map definition",
  );

  runtime.setActiveMap(source);
  reset();
  assert.notEqual(dynamics.state.waterPatch, main);
  assert.deepEqual(runtime.state.activeMap.elements, original);
  assert.equal(dynamics.state.waterPatch.w, widthBefore);
}

function testSmallDropsUseRestrainedStaticDetail() {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => new FakeCanvasElement() };
  try {
    for (const render of [renderWaterPatches, renderGooPatches]) {
      const small = new FakeElement();
      const large = new FakeElement();
      render(small, [{ x: 100, y: 100, w: 92, h: 68 }]);
      render(large, [{ x: 100, y: 100, w: 920, h: 680 }]);
      const smallCalls = small.firstChild.context.calls;
      const largeCalls = large.firstChild.context.calls;
      assert.ok(smallCalls.some(([name]) => name === "closePath"));
      assert.ok(smallCalls.some(([name]) => name === "fill"));
      assert.ok(smallCalls.some(([name]) => name === "stroke"));
      assert.equal(
        smallCalls.filter(
          ([name]) => name === "ellipse" || name === "bezierCurveTo",
        ).length,
        0,
        "small drops need a glint, not miniature bubbles, folds, or caustic patterns",
      );
      assert.ok(largeCalls.some(([name]) => name === "ellipse"));
      assert.ok(largeCalls.some(([name]) => name === "bezierCurveTo"));
      assert.ok(smallCalls.length < largeCalls.length);
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
}

testKitchenSplashFootprints();
testSpongeKeepsMainPuddleOwnership();
testSmallDropsUseRestrainedStaticDetail();
console.log("Kitchen spill tests passed.");

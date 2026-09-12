import assert from "node:assert/strict";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
import { baseMapConfig } from "../core/map-config.js";
import { createMapRuntime } from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { pointInEllipsePatch } from "../core/geometry.js";
import { ELLIPTICAL_SURFACE_SHAPES } from "../core/map-elements.js";
import { circleOrientedRectContact } from "../core/physics-collisions.js";
import { renderMapTheme } from "../rendering/map-theme-rendering.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

const originalDocument = globalThis.document;
globalThis.document = {
  createElement: (tag) =>
    tag === "canvas" ? new FakeCanvasElement() : new FakeElement(),
};

try {
  const floorCalls = [];
  for (const id of ["kitchen-floor", "kitchen-breakfast-spill"]) {
    const config = resolveMapVariantConfig(baseMapConfig, id);
    const sourceBefore = globalThis.structuredClone(config);
    const runtime = createMapRuntime({ initialMap: config });
    const dynamics = createKitchenDynamics();
    const reset = () =>
      dynamics.reset({
        mapConfig: runtime.state.activeMap,
        obstacles: runtime.state.obstacles,
        waterPatches: runtime.state.terrainByType.waterPatch.elements,
        world: config.world,
      });
    reset();
    assert.equal(
      dynamics.state.ants.length,
      10,
      "composition must not increase the live ant budget",
    );
    assert.equal(
      dynamics.state.cheerios.filter((food) => food.kind === "cheerio").length,
      34,
    );
    assert.equal(
      dynamics.state.cheerios.filter((food) => food.kind === "crumb").length,
      12,
    );
    const initialAnts = globalThis.structuredClone(dynamics.state.ants);
    const initialFood = globalThis.structuredClone(dynamics.state.cheerios);
    const obstaclesBefore = globalThis.structuredClone(runtime.state.obstacles);
    const floor = new FakeElement();
    renderMapTheme({
      container: floor,
      overlayContainer: new FakeElement(),
      mapConfig: runtime.state.activeMap,
      dynamicsState: dynamics.state,
      world: config.world,
    });
    assert.deepEqual(
      runtime.state.obstacles,
      obstaclesBefore,
      "flat litter must never acquire collision geometry",
    );
    assert.deepEqual(
      config,
      sourceBefore,
      "rendering and reset must not mutate the authored map",
    );
    const calls = floor.firstChild.children.find(
      (child) => child.className === "kitchenFloorCanvas",
    ).context.calls;
    const clusterOrigins = calls
      .filter(
        ([name, , , , , x, y]) => name === "transform" && (x !== 0 || y !== 0),
      )
      .map(([, , , , , x, y]) => [x, y]);
    assert.deepEqual(
      clusterOrigins,
      config.clusters.map(({ x, y }) => [x * 4400, y * 4400]),
      "each variant must paint its litter at the anchors used to place its food",
    );
    floorCalls.push(calls);

    const circles = [
      ...initialFood.map((food) => ({
        x: food.originX,
        y: food.originY,
        r: food.radius,
      })),
      ...initialAnts.map((ant) => ({ x: ant.x, y: ant.y, r: 7 })),
    ];
    for (const circle of circles) {
      assert.ok(
        circle.x > circle.r && circle.x < config.world.width - circle.r,
      );
      assert.ok(
        circle.y > circle.r && circle.y < config.world.height - circle.r,
      );
      for (const obstacle of runtime.state.obstacles) {
        assert.equal(
          circleOrientedRectContact(circle, obstacle).intersects,
          false,
          `${id}: food/ants must start clear of the utensils`,
        );
      }
      for (const element of config.elements) {
        const shape = ELLIPTICAL_SURFACE_SHAPES[element.type];
        if (shape)
          assert.equal(
            pointInEllipsePatch(circle.x, circle.y, element, shape, circle.r),
            false,
            `${id}: the food resources and ants should start on dry floor`,
          );
      }
      for (const reserved of [config.spawn]) {
        assert.ok(
          Math.hypot(circle.x - reserved.x, circle.y - reserved.y) >
            circle.r + reserved.r + 29,
          "spawn should keep a clear marble-width apron",
        );
      }
    }
    for (const ant of initialAnts) {
      assert.ok(
        initialFood.some(
          (food) =>
            Math.hypot(ant.x - food.originX, ant.y - food.originY) < 220,
        ),
        "ants should start close enough to forage in the authored food scenes",
      );
    }

    const marble = { x: 4200, y: 4100, r: 29, vx: 0, vy: 0 };
    for (let frame = 0; frame < 180; frame++)
      dynamics.update(runtime.state.activeMap, marble, marble, 1);
    assert.notDeepEqual(dynamics.state.ants, initialAnts);
    dynamics.state.cheerios[0].pushX = 100;
    dynamics.state.cheerios[0].active = false;
    dynamics.state.ants[0].alive = false;
    runtime.setActiveMap(config);
    reset();
    assert.deepEqual(
      dynamics.state.ants,
      initialAnts,
      "Retry restores living ants at the authored resources",
    );
    assert.deepEqual(
      dynamics.state.cheerios,
      initialFood,
      "Retry restores the food arrangement",
    );
  }
  assert.notDeepEqual(
    floorCalls[0],
    floorCalls[1],
    "each kitchen variant must place litter beside its own food, rather than falling back to the first map's layout",
  );
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
}

console.log("Kitchen layout tests passed.");

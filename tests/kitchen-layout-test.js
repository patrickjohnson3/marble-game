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
import { antConfig } from "../core/game-config.js";

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
      12,
      "both kitchens have 20% more ants than the original ten",
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
    if (id === "kitchen-floor") {
      const bases = config.elements.filter(
        (item) => item.fixture === "cabinetBase",
      );
      assert.ok(
        bases.some((item) => item.y === 0 && item.w === config.world.width),
        "cabinet bases frame the top edge",
      );
      assert.ok(
        bases.some((item) => item.x === 0 && item.h > item.w),
        "cabinet bases also frame the left edge",
      );
      assert.equal(
        config.elements.filter((item) => item.fixture === "applianceFoot")
          .length,
        2,
      );
      assert.equal(
        config.elements.filter((item) => item.fixture === "tippedCup").length,
        1,
      );
      assert.ok(
        initialAnts.filter((ant) => ant.y < config.world.height / 3).length >=
          3,
        "the upper third has a real food-and-ant scene",
      );
      assert.ok(initialFood.some((food) => food.y < config.world.height / 3));
      assert.ok(
        config.route?.length >= 4,
        "the escape loop has an authored clearance certificate",
      );
      // A 240-unit lane is over four marble diameters wide. This is a static
      // clearance check, not a simulation of escaping a live roach.
      for (let index = 1; index < config.route.length; index++) {
        const a = config.route[index - 1];
        const b = config.route[index];
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5);
        for (let step = 0; step <= steps; step++) {
          const circle = {
            x: a.x + ((b.x - a.x) * step) / steps,
            y: a.y + ((b.y - a.y) * step) / steps,
            r: 120,
          };
          assert.ok(
            circle.x >= circle.r &&
              circle.y >= circle.r &&
              circle.x <= config.world.width - circle.r &&
              circle.y <= config.world.height - circle.r,
          );
          assert.ok(
            runtime.state.obstacles.every(
              (obstacle) =>
                !circleOrientedRectContact(circle, obstacle).intersects,
            ),
            "wide escape loop stays clear of solid objects",
          );
        }
      }
    } else {
      assert.equal(
        config.elements.some(
          (item) =>
            item.fixture === "cabinetBase" || item.fixture === "tippedCup",
        ),
        false,
        "breakfast kitchen composition stays unchanged",
      );
    }
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
        x: food.x,
        y: food.y,
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
          (food) => Math.hypot(ant.x - food.x, ant.y - food.y) < 220,
        ),
        "ants should start close enough to forage in the authored food scenes",
      );
    }

    const victim = dynamics.state.ants.find((ant) =>
      dynamics.state.ants.some((other) => {
        const gap = Math.hypot(ant.x - other.x, ant.y - other.y);
        return (
          other !== ant &&
          gap > config.spawn.r * 2 &&
          gap < antConfig.crushAlarmDistance
        );
      }),
    );
    assert.ok(
      victim,
      "authored food scenes include a visible nearby-crush encounter",
    );
    const survivor = dynamics.state.ants.find((ant) => {
      const gap = Math.hypot(ant.x - victim.x, ant.y - victim.y);
      return (
        ant !== victim &&
        gap > config.spawn.r * 2 &&
        gap < antConfig.crushAlarmDistance
      );
    });
    const charge = {
      x: victim.x,
      y: victim.y,
      r: config.spawn.r,
      vx: 6,
      vy: 0,
    };
    const events = dynamics.update(runtime.state.activeMap, charge, charge, 1);
    assert.ok(events.antCrushes.includes(victim));
    assert.ok(
      survivor.alive && survivor.mode === "flee",
      "a real authored neighbor flees the crushed ant",
    );
    reset();

    const marble = { x: 4200, y: 4100, r: 29, vx: 0, vy: 0 };
    for (let frame = 0; frame < 180; frame++)
      dynamics.update(runtime.state.activeMap, marble, marble, 1);
    assert.notDeepEqual(dynamics.state.ants, initialAnts);
    dynamics.state.cheerios[0].x += 100;
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

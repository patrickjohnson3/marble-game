import assert from "node:assert/strict";
import { baseMapConfig, resolvedMapConfig } from "../core/map-config.js";
import { createKitchenDynamics } from "../core/kitchen-dynamics.js";
import { createResolvedMapState } from "../core/map-runtime.js";
import { resolveMapVariantConfig } from "../core/map-variants.js";
import { circleObstacleContact } from "../core/physics-collisions.js";
import { updatePhysics } from "../core/physics.js";
import { physicsConfig } from "../core/game-config.js";
import {
  renderMapTheme,
  renderMapThemeDynamics,
} from "../rendering/map-theme-rendering.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

const map = resolveMapVariantConfig(baseMapConfig, "living-room");
const distantMarble = { x: 4000, y: 4000, vx: 0, vy: 0, r: 29 };

function fixture(config = map) {
  const runtime = createResolvedMapState(config);
  const dynamics = createKitchenDynamics();
  dynamics.reset({
    mapConfig: runtime.activeMap,
    world: runtime.activeMap.world,
    obstacles: runtime.obstacles,
  });
  return { runtime, dynamics, config: runtime.activeMap };
}

{
  const { dynamics, config, runtime } = fixture();
  assert.ok(
    dynamics.state.cheerios.length >= 12,
    "a spill needs a bunch of pieces",
  );
  assert.equal(dynamics.state.cheerios.length, config.popcorn.length);
  assert.equal(
    dynamics.state.ants.length,
    0,
    "popcorn must not add kitchen ants",
  );
  assert.equal(dynamics.state.sponge, null);
  assert.deepEqual(
    config.objective,
    map.objective,
    "food does not alter completion",
  );
  const before = globalThis.structuredClone(map.popcorn);
  dynamics.state.cheerios.forEach((piece, index) => {
    assert.equal(piece.kind, "popcorn");
    assert.equal(piece.x, config.popcorn[index].x);
    assert.equal(piece.y, config.popcorn[index].y);
    assert.equal(piece.radius, config.popcorn[index].r);
    const circle = { x: piece.x, y: piece.y, r: piece.radius };
    assert.equal(
      runtime.obstacles.some(
        (o) => circleObstacleContact(circle, o).intersects,
      ),
      false,
    );
    assert.ok(
      Math.hypot(piece.x - config.spawn.x, piece.y - config.spawn.y) >
        piece.radius + config.spawn.r,
    );
  });
  const piece = dynamics.state.cheerios[0];
  const context = {
    marble: {
      x: piece.x - piece.radius - 31,
      y: piece.y,
      r: 29,
      vx: 12,
      vy: 0,
    },
    bounds: {
      left: 0,
      top: 0,
      right: map.world.width,
      bottom: map.world.height,
    },
    intro: { released: true },
    physics: { ...physicsConfig },
    tilt: { smoothX: 0, smoothY: 0 },
    // Keep this isolated contact away from the opponent; food uses real fixtures.
    mapState: { ...runtime, mouse: null },
  };
  const previous = { ...context.marble };
  const startX = piece.x;
  updatePhysics(context, 1, { onImpact() {}, onSurface() {} });
  const events = dynamics.update(
    config,
    context.marble,
    previous,
    1,
    context.physicsScratch.movementPath,
  );
  assert.ok(
    piece.x > startX && piece.vx > 0,
    "a real marble path pushes popcorn forward",
  );
  assert.equal(events.cerealHits, 1, "food reuses existing bump feedback");
  const pushedX = piece.x;
  dynamics.update(config, distantMarble, distantMarble, 1);
  assert.ok(piece.x > pushedX, "popcorn coasts after separation");
  for (let frame = 0; frame < 120; frame++)
    dynamics.update(config, distantMarble);
  assert.equal(piece.vx, 0, "floor friction eventually settles the piece");
  assert.deepEqual(
    map.popcorn,
    before,
    "pushing cannot mutate authored placement",
  );

  config.popcorn[0].x += 100;
  const retry = fixture();
  assert.notEqual(retry.dynamics.state.cheerios[0], piece);
  assert.equal(retry.dynamics.state.cheerios[0].x, before[0].x);
  assert.equal(retry.dynamics.state.cheerios[0].vx, 0);
  assert.equal(retry.dynamics.state.cheerios[0].playerDisturbed, false);
  assert.deepEqual(
    map.popcorn,
    before,
    "runtime descriptions are isolated too",
  );

  const kitchen = resolveMapVariantConfig(
    { ...map, variants: baseMapConfig.variants },
    "kitchen-floor",
  );
  assert.equal(
    kitchen.popcorn,
    undefined,
    "switching maps must not inherit the spill",
  );
  dynamics.reset({
    mapConfig: resolvedMapConfig,
    world: resolvedMapConfig.world,
    obstacles: [],
  });
  assert.ok(dynamics.state.cheerios.every((food) => food.kind !== "popcorn"));
  assert.ok(
    dynamics.state.ants.length > 0,
    "kitchen food and prey remain intact",
  );
}

function coast(elements, parts = [1]) {
  const { dynamics, config } = fixture({
    ...map,
    mouse: undefined,
    elements,
    popcorn: [{ x: 1200, y: 1200, r: 22, angle: 0 }],
  });
  const piece = dynamics.state.cheerios[0];
  piece.vx = 6;
  let elapsed = 0;
  let index = 0;
  while (elapsed < 12 - 1e-8) {
    const dt = Math.min(parts[index++ % parts.length], 12 - elapsed);
    dynamics.update(config, distantMarble, distantMarble, dt);
    elapsed += dt;
  }
  return piece;
}

{
  const wood = coast([]);
  const shag = coast([
    { type: "roughPatch", material: "shag", x: 1000, y: 1000, w: 600, h: 600 },
  ]);
  assert.ok(
    shag.x > 1200 && shag.x < wood.x,
    "popcorn coasts less on shag than wood",
  );
  assert.ok(shag.vx < wood.vx);
  for (const parts of [[0.5], [2], [0.13, 0.8, 1.17, 2.2]]) {
    const piece = coast([], parts);
    assert.ok(
      Math.abs(piece.x - wood.x) < 1e-8,
      "coasting composes across frame partitions",
    );
  }
  const { dynamics, config, runtime } = fixture();
  const piece = dynamics.state.cheerios[0];
  const table = runtime.obstacles.find((o) => o.fixture === "coffeeTable");
  Object.assign(piece, {
    x: table.x - piece.radius - 2,
    y: table.y + table.h / 2,
    vx: 10,
    vy: 0,
  });
  dynamics.update(config, distantMarble, distantMarble, 2);
  assert.equal(
    circleObstacleContact({ x: piece.x, y: piece.y, r: piece.radius }, table)
      .intersects,
    false,
    "food cannot coast through solid furniture",
  );
  Object.assign(piece, { x: map.world.width - piece.radius - 2, vx: 10 });
  dynamics.update(config, distantMarble, distantMarble, 2);
  assert.ok(
    piece.x + piece.radius <= map.world.width,
    "pieces stay inside the room",
  );
}

{
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) =>
      tag === "canvas" ? new FakeCanvasElement() : new FakeElement(),
  };
  try {
    const { dynamics, config } = fixture();
    const container = new FakeElement();
    const overlayContainer = new FakeElement();
    const themeState = {};
    const args = {
      container,
      overlayContainer,
      themeState,
      mapConfig: config,
      dynamicsState: dynamics.state,
    };
    renderMapTheme(args);
    assert.equal(themeState.popcornEntries.length, config.popcorn.length);
    const { piece, element } = themeState.popcornEntries[0];
    assert.equal(element.className, "themeObject livingRoomPopcorn");
    assert.equal(element.style.width, piece.radius * 2 + "px");
    const previous = element.style.transform;
    piece.x += 100;
    renderMapThemeDynamics(args);
    assert.notEqual(
      element.style.transform,
      previous,
      "art follows the authoritative food position",
    );
    assert.ok(
      element.style.transform.includes(`translate(${piece.x - piece.radius}px`),
    );
    let writes = 0;
    Object.defineProperty(element.style, "transform", {
      set() {
        writes++;
      },
    });
    renderMapThemeDynamics(args);
    assert.equal(
      writes,
      0,
      "stationary popcorn does not generate style writes",
    );
    renderMapTheme({ ...args, mapConfig: { theme: "none", world: map.world } });
    assert.equal(
      themeState.popcornEntries.length,
      0,
      "map replacement drops old render references",
    );
    assert.equal(overlayContainer.children.length, 0);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

console.log("Popcorn tests passed.");

import assert from "node:assert/strict";
import { mapConfig } from "../core/config.js";
import {
  hashMapSeed,
  normalizedObstacleRects,
  resolveSeededMapConfig,
  selectNextMapVariant,
  selectSeededMapVariant,
  snapRectToGrid,
  snapToGrid,
  validateMapConfig
} from "../core/map.js";
import { renderObstacleWalls } from "../rendering/rendering.js";
import { FakeElement } from "./test-dom.js";

function currentMapObstacles() {
  return normalizedObstacleRects(mapConfig.elements.filter((element) => element.type === "obstacle"));
}

function testGridSnapping() {
  assert.equal(snapToGrid(264, 10), 260);
  assert.equal(snapToGrid(266, 10), 270);
  assert.deepEqual(
    snapRectToGrid({ type: "obstacle", x: 264, y: 336, w: 53, h: 47 }, 10),
    { type: "obstacle", x: 260, y: 340, w: 50, h: 50 }
  );
}

testGridSnapping();

function testSeededMapVariantSelection() {
  const variants = [
    { id: "a", elements: [{ type: "obstacle", x: 0, y: 0, w: 10, h: 10 }] },
    { id: "b", elements: [{ type: "roughPatch", x: 10, y: 10, w: 20, h: 20 }] }
  ];
  const seed = "same-seed";

  assert.equal(hashMapSeed(seed), hashMapSeed(seed));
  assert.equal(
    selectSeededMapVariant(variants, seed),
    selectSeededMapVariant(variants, seed)
  );
  assert.equal(selectSeededMapVariant(variants, "b").id, "b");
  assert.equal(selectSeededMapVariant([null, variants[0]], "a").id, "a");
  assert.equal(selectSeededMapVariant([null], "a"), null);
}

testSeededMapVariantSelection();

function testNextMapVariantSelectionIsGuarded() {
  const variants = [
    { id: "a" },
    { id: "b" }
  ];

  assert.equal(selectNextMapVariant(variants, "a").id, "b");
  assert.equal(selectNextMapVariant(variants, "b").id, "a");
  assert.equal(selectNextMapVariant([null, variants[0]], "a").id, "a");
  assert.equal(selectNextMapVariant(variants, "missing").id, "a");
  assert.equal(selectNextMapVariant([], "a"), null);
  assert.equal(selectNextMapVariant(null, "a"), null);
  assert.equal(selectNextMapVariant([null], "a"), null);
}

testNextMapVariantSelectionIsGuarded();

function testResolveSeededMapConfigCopiesSelectedElements() {
  const config = {
    seed: "seed-a",
    variants: [
      { id: "only", elements: [{ type: "obstacle", x: 0, y: 0, w: 10, h: 10 }] }
    ],
    world: { width: 100, height: 100 }
  };
  const resolved = resolveSeededMapConfig(config);

  assert.equal(resolved.seed, "seed-a");
  assert.equal(resolved.variantId, "only");
  assert.deepEqual(resolved.elements, config.variants[0].elements);
  assert.notEqual(resolved.elements, config.variants[0].elements);
}

testResolveSeededMapConfigCopiesSelectedElements();

function testResolveSeededMapConfigAllowsValidationOfMissingVariantElements() {
  const resolved = resolveSeededMapConfig({
    seed: "bad-variant",
    variants: [
      { id: "bad-variant", goal: { x: 80, y: 80, r: 10, holdMs: 5000 } }
    ],
    world: { width: 100, height: 100 }
  });

  assert.equal(resolved.variantId, "bad-variant");
  assert.ok(validateMapConfig(resolved).includes("elements must be an array"));
}

testResolveSeededMapConfigAllowsValidationOfMissingVariantElements();

function testMapValidationRejectsBlockedSpawn() {
  const config = {
    world: { width: 100, height: 100 },
    elements: [
      { type: "obstacle", x: 45, y: 45, w: 10, h: 10 }
    ],
    goal: { x: 80, y: 80, r: 10, holdMs: 5000 }
  };

  assert.ok(
    validateMapConfig(config, { spawn: { x: 50, y: 50, r: 8 } }).includes("spawn must not overlap obstacles")
  );
}

testMapValidationRejectsBlockedSpawn();

function testMapValidationReportsMalformedConfig() {
  assert.deepEqual(
    validateMapConfig({}),
    [
      "elements must be an array",
      "world width must be positive",
      "world height must be positive",
      "goal is required",
      "spawn has non-finite x",
      "spawn has non-finite y"
    ]
  );
}

testMapValidationReportsMalformedConfig();

function testMapValidationReportsInvalidElementEntries() {
  const config = {
    world: { width: 100, height: 100 },
    elements: [null],
    goal: { x: 80, y: 80, r: 10, holdMs: 5000 }
  };

  assert.ok(validateMapConfig(config).includes("element 0 must be an object"));
}

testMapValidationReportsInvalidElementEntries();

function testMapValidationReportsInvalidNormalizedObstacles() {
  const config = {
    world: { width: 100, height: 100 },
    elements: [],
    goal: { x: 80, y: 80, r: 10, holdMs: 5000 }
  };

  assert.ok(
    validateMapConfig(config, { normalizedObstacles: [null] }).includes("normalized obstacle 0 must be an object")
  );
  assert.ok(
    validateMapConfig(config, { normalizedObstacles: "bad" }).includes("normalized obstacles must be an array")
  );
}

testMapValidationReportsInvalidNormalizedObstacles();

function testObstacleVisualsTrimSmallJoinOverhangs() {
  const [horizontal, vertical] = normalizedObstacleRects([
    { x: 0, y: 20, w: 100, h: 20 },
    { x: 80, y: 0, w: 20, h: 50 }
  ]);

  assert.equal(horizontal.h, 20);
  assert.equal(vertical.h, 40);
}

testObstacleVisualsTrimSmallJoinOverhangs();

function testObstacleVisualsTrimTouchingJoinOverhangs() {
  const [, vertical] = normalizedObstacleRects([
    { x: 0, y: 20, w: 100, h: 20 },
    { x: 100, y: 0, w: 20, h: 50 }
  ]);

  assert.equal(vertical.h, 40);
  assert.equal(vertical.w, 20);
}

testObstacleVisualsTrimTouchingJoinOverhangs();

function testCurrentMapJoinedWallsSurviveNormalization() {
  const obstacles = currentMapObstacles();

  assert.deepEqual(
    obstacles.slice(0, 2),
    [
      { type: "obstacle", x: 260, y: 330, w: 514, h: 42 },
      { type: "obstacle", x: 720, y: 250, w: 54, h: 360 }
    ],
    "top joined wall group should survive normalization"
  );
  assert.deepEqual(
    obstacles.slice(4, 6),
    [
      { type: "obstacle", x: 250, y: 900, w: 718, h: 54 },
      { type: "obstacle", x: 910, y: 760, w: 58, h: 380 }
    ],
    "middle joined wall group should survive normalization"
  );
  assert.deepEqual(
    obstacles.slice(7, 9),
    [
      { type: "obstacle", x: 520, y: 1380, w: 52, h: 440 },
      { type: "obstacle", x: 520, y: 1570, w: 930, h: 52 }
    ],
    "lower joined wall group should survive normalization"
  );
}

testCurrentMapJoinedWallsSurviveNormalization();

function renderCurrentMapObstacleOutline() {
  const originalDocument = globalThis.document;

  globalThis.document = {
    createElementNS() {
      return new FakeElement();
    }
  };

  try {
    const container = new FakeElement();
    renderObstacleWalls(container, currentMapObstacles());
    const svg = container.children[0];
    const outline = svg.children.find((child) => child.classList.contains("obstacleWallOutline"));

    assert.ok(outline, "current map obstacle outline should render");
    return outline.attributes.d;
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
}

function testCurrentMapJoinedWallsDoNotRenderInternalSeams() {
  const outline = renderCurrentMapObstacleOutline();

  [
    "M720 330H774",
    "M720 330V372",
    "M910 900V954",
    "M572 1570V1622"
  ].forEach((internalSegment) => {
    assert.equal(
      outline.includes(internalSegment),
      false,
      "current map obstacle outline should not draw internal segment " + internalSegment
    );
  });
}

testCurrentMapJoinedWallsDoNotRenderInternalSeams();

console.log("Map tests passed.");

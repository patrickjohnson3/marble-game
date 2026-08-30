import assert from "node:assert/strict";
import { authoredMapVariants, baseMapConfig } from "../core/map-config.js";
import {
  mapHazardPatchElements,
  mapObstacleElements,
  mapRoughPatchElements,
} from "../core/map-elements.js";
import {
  normalizeJoinedObstacleRects,
  snapRectToGrid,
  snapToGrid,
} from "../core/map-obstacles.js";
import {
  resolveMapVariantConfig,
  selectNextMapVariant,
  validMapVariants,
} from "../core/map-variants.js";
import { createMapProgression } from "../core/map-progression.js";
import { copy } from "../core/copy.js";
import { renderObstacleWalls } from "../rendering/obstacle-rendering.js";
import {
  malformedVariantConfig,
  simpleMapConfig,
  smallJoinOverhangRects,
  touchingJoinOverhangRects,
  variantSelectionFixtures,
} from "./map-fixtures.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function currentMapObstacles() {
  const classicMap = resolveMapVariantConfig(baseMapConfig, "default");

  return normalizeJoinedObstacleRects(mapObstacleElements(classicMap.elements));
}

function testGridSnapping() {
  assert.equal(snapToGrid(264, 10), 260);
  assert.equal(snapToGrid(266, 10), 270);
  assert.deepEqual(
    snapRectToGrid({ type: "obstacle", x: 264, y: 336, w: 53, h: 47 }, 10),
    { type: "obstacle", x: 260, y: 340, w: 50, h: 50 },
  );
}

testGridSnapping();

function testValidMapVariantsFiltersMalformedEntries() {
  const valid = { id: "valid", elements: [] };

  assert.deepEqual(validMapVariants(null), []);
  assert.deepEqual(validMapVariants([null, "bad", valid, 7]), [valid]);
}

testValidMapVariantsFiltersMalformedEntries();

function testMapBoundaryWrapsVariantSelection() {
  assert.equal(
    resolveMapVariantConfig(simpleMapConfig, "only").variantId,
    "only",
  );
  assert.equal(
    selectNextMapVariant(simpleMapConfig.variants, "missing").id,
    "only",
  );
}

testMapBoundaryWrapsVariantSelection();

function testBaseMapConfigAppendsFrozenVariantsAfterAuthoredMaps() {
  assert.equal(
    baseMapConfig.variants.length > authoredMapVariants.length,
    true,
  );
  assert.deepEqual(
    baseMapConfig.variants
      .slice(0, authoredMapVariants.length)
      .map((variant) => variant.id),
    authoredMapVariants.map((variant) => variant.id),
  );
  assert.equal(
    baseMapConfig.variants
      .slice(authoredMapVariants.length)
      .every((variant) => variant.id.startsWith("generated-")),
    true,
  );
}

testBaseMapConfigAppendsFrozenVariantsAfterAuthoredMaps();

function testAuthoredMapsIncludeRealWorldVariants() {
  assert.deepEqual(
    authoredMapVariants
      .slice(0, 7)
      .map((variant) => [variant.name, variant.theme]),
    [
      ["kitchen floor", "kitchenFloor"],
      ["living room", "livingRoom"],
      ["parking lot", "parkingLot"],
      ["sand lot", "sandLot"],
      ["kitchen breakfast spill", "kitchenFloor"],
      ["parking lot puddles", "parkingLot"],
      ["hockey rink", "hockeyRink"],
    ],
  );
}

testAuthoredMapsIncludeRealWorldVariants();

function testNextMapVariantSelectionIsGuarded() {
  const variants = variantSelectionFixtures;

  assert.equal(selectNextMapVariant(variants, "a").id, "b");
  assert.equal(selectNextMapVariant(variants, "b").id, "a");
  assert.equal(selectNextMapVariant([null, variants[0]], "a").id, "a");
  assert.equal(selectNextMapVariant(variants, "missing").id, "a");
  assert.equal(selectNextMapVariant([], "a"), null);
  assert.equal(selectNextMapVariant(null, "a"), null);
  assert.equal(selectNextMapVariant([null], "a"), null);
}

testNextMapVariantSelectionIsGuarded();

function testMapElementFiltersHandleMalformedInput() {
  assert.deepEqual(mapObstacleElements(null), []);
  assert.deepEqual(mapHazardPatchElements(null), []);
  assert.deepEqual(mapRoughPatchElements(undefined), []);
}

testMapElementFiltersHandleMalformedInput();

function testMapProgressionHandlesMissingCurrentMap() {
  const hints = [];
  let renderRequests = 0;
  const progression = createMapProgression({
    baseMapConfig: simpleMapConfig,
    getCurrentMap: () => null,
    applyMap() {
      throw new Error("missing current map should not apply next map");
    },
    resetForNextMap() {},
    terrainView: { updateGoalProgress() {} },
    ui: { setHint: (hint) => hints.push(hint) },
    requestRender: () => {
      renderRequests++;
    },
  });

  assert.equal(progression.advanceToNextMap(), false);
  assert.deepEqual(hints, [copy.hints.goalNoNextMap]);
  assert.equal(renderRequests, 1);
}

testMapProgressionHandlesMissingCurrentMap();

function testMapProgressionUsesQuietSuccessHint() {
  const hints = [];
  const labels = [];
  let activeMap = resolveMapVariantConfig(simpleMapConfig, "only");
  const progression = createMapProgression({
    baseMapConfig: simpleMapConfig,
    getCurrentMap: () => activeMap,
    applyMap(nextMap) {
      activeMap = nextMap;
    },
    resetForNextMap() {},
    terrainView: { updateGoalProgress() {} },
    ui: {
      setHint: (hint) => hints.push(hint),
      showLevelLabel(label, durationMs) {
        labels.push({ durationMs, label });
      },
    },
    requestRender() {},
    copy: copy.hints,
    formatMapLabel: (map) => "next: " + map.variantId,
    mapLabelDurationMs: 1800,
  });

  assert.equal(progression.advanceToNextMap(), true);
  assert.deepEqual(hints, [copy.hints.mapOpen]);
  assert.deepEqual(labels, [{ durationMs: 1800, label: "next: only" }]);
}

testMapProgressionUsesQuietSuccessHint();

function testResolveMapConfigCopiesSelectedElements() {
  const config = simpleMapConfig;
  const resolved = resolveMapVariantConfig(config, "only");

  assert.equal(resolved.variantId, "only");
  assert.equal(resolved.name, undefined);
  assert.deepEqual(resolved.elements, config.variants[0].elements);
  assert.notEqual(resolved.elements, config.variants[0].elements);
}

testResolveMapConfigCopiesSelectedElements();

function testResolveMapVariantConfigIgnoresMalformedVariants() {
  const resolved = resolveMapVariantConfig(malformedVariantConfig, "safe");

  assert.equal(resolved.variantId, "safe");
}

testResolveMapVariantConfigIgnoresMalformedVariants();

function testResolveMapVariantConfigFallsBackToBaseWhenMissing() {
  const resolved = resolveMapVariantConfig(simpleMapConfig, "missing");

  assert.equal(resolved.variantId, undefined);
  assert.deepEqual(resolved.spawn, simpleMapConfig.spawn);
}

testResolveMapVariantConfigFallsBackToBaseWhenMissing();

function testObstacleVisualsTrimSmallJoinOverhangs() {
  const [horizontal, vertical] = normalizeJoinedObstacleRects(
    smallJoinOverhangRects,
  );

  assert.equal(horizontal.h, 20);
  assert.equal(vertical.h, 40);
}

testObstacleVisualsTrimSmallJoinOverhangs();

function testObstacleVisualsTrimTouchingJoinOverhangs() {
  const [, vertical] = normalizeJoinedObstacleRects(touchingJoinOverhangRects);

  assert.equal(vertical.h, 40);
  assert.equal(vertical.w, 20);
}

testObstacleVisualsTrimTouchingJoinOverhangs();

function testObstacleNormalizationLeavesNonTouchingRectsUnchanged() {
  const rects = [
    { type: "obstacle", x: 0, y: 0, w: 100, h: 20 },
    { type: "obstacle", x: 200, y: 200, w: 20, h: 100 },
  ];

  assert.deepEqual(normalizeJoinedObstacleRects(rects), rects);
}

testObstacleNormalizationLeavesNonTouchingRectsUnchanged();

function testObstacleNormalizationDoesNotMutateInput() {
  const rects = [
    { type: "obstacle", x: 0, y: 40, w: 120, h: 20 },
    { type: "obstacle", x: 100, y: 0, w: 20, h: 80 },
  ];
  const original = rects.map((rect) => ({ ...rect }));

  normalizeJoinedObstacleRects(rects);

  assert.deepEqual(rects, original);
}

testObstacleNormalizationDoesNotMutateInput();

function testObstacleNormalizationTrimsTJoinOverhang() {
  const [, vertical] = normalizeJoinedObstacleRects([
    { type: "obstacle", x: 0, y: 40, w: 140, h: 20 },
    { type: "obstacle", x: 80, y: 0, w: 20, h: 65 },
  ]);

  assert.deepEqual(vertical, {
    type: "obstacle",
    x: 80,
    y: 0,
    w: 20,
    h: 60,
  });
}

testObstacleNormalizationTrimsTJoinOverhang();

function testObstacleNormalizationTrimsRightJoinOverhang() {
  const [horizontal] = normalizeJoinedObstacleRects([
    { type: "obstacle", x: 0, y: 40, w: 110, h: 20 },
    { type: "obstacle", x: 80, y: 0, w: 20, h: 80 },
  ]);

  assert.equal(horizontal.w, 100);
}

testObstacleNormalizationTrimsRightJoinOverhang();

function testCurrentMapJoinedWallsSurviveNormalization() {
  const obstacles = currentMapObstacles();

  assert.deepEqual(
    obstacles.slice(0, 2),
    [
      { type: "obstacle", x: 520, y: 660, w: 970, h: 40 },
      { type: "obstacle", x: 1440, y: 500, w: 50, h: 720 },
    ],
    "top joined wall group should survive normalization",
  );
  assert.deepEqual(
    obstacles.slice(4, 6),
    [
      { type: "obstacle", x: 500, y: 1800, w: 1380, h: 50 },
      { type: "obstacle", x: 1820, y: 1520, w: 60, h: 760 },
    ],
    "middle joined wall group should survive normalization",
  );
  assert.deepEqual(
    obstacles.slice(7, 9),
    [
      { type: "obstacle", x: 1040, y: 2760, w: 50, h: 880 },
      { type: "obstacle", x: 1040, y: 3140, w: 1860, h: 50 },
    ],
    "lower joined wall group should survive normalization",
  );
}

testCurrentMapJoinedWallsSurviveNormalization();

function renderCurrentMapObstacles() {
  const originalDocument = globalThis.document;

  globalThis.document = {
    createElement(tagName) {
      return tagName === "canvas" ? new FakeCanvasElement() : new FakeElement();
    },
    createElementNS() {
      return new FakeElement();
    },
  };

  try {
    const container = new FakeElement();
    renderObstacleWalls(container, currentMapObstacles());
    return container.children[0];
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
}

function testCurrentMapObstaclesRenderToGroupedCanvas() {
  const canvas = renderCurrentMapObstacles();

  assert.equal(
    canvas.classList.contains("obstacleCanvas"),
    true,
    "current map obstacles should render to canvas",
  );
  assert.equal(
    Number(canvas.attributes["data-wall-groups"]) > 1,
    true,
    "current map obstacle groups should render separate canvas fills",
  );
  assert.equal(
    canvas.context.calls.some((call) => call[0] === "fill"),
    true,
    "current map canvas should draw fills",
  );
  assert.equal(
    canvas.context.calls.some((call) => call[0] === "stroke"),
    true,
    "current map canvas should draw outline",
  );
}

testCurrentMapObstaclesRenderToGroupedCanvas();

console.log("Map tests passed.");

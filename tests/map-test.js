import assert from "node:assert/strict";
import { circleRectContact } from "../core/geometry.js";
import {
  authoredMapVariants,
  baseMapConfig,
  resolvedMapConfig,
} from "../core/map-config.js";
import {
  mapObstacleElements,
  mapRoughPatchElements,
} from "../core/map-elements.js";
import {
  normalizeJoinedObstacleRects,
  snapRectToGrid,
  snapToGrid,
} from "../core/map-obstacles.js";
import {
  hashMapSeed,
  resolveMapVariantConfig,
  resolveSeededMapConfig,
  selectNextMapVariant,
  selectSeededMapVariant,
} from "../core/map-variants.js";
import { validateMapConfig } from "../core/map-validation.js";
import { createMapProgression } from "../core/map-progression.js";
import { generateProceduralMapVariants } from "../core/procedural-generator.js";
import { copy } from "../core/copy.js";
import { renderObstacleWalls } from "../rendering/obstacle-rendering.js";
import {
  malformedVariantConfig,
  simpleSeededMapConfig,
  smallJoinOverhangRects,
  touchingJoinOverhangRects,
  variantSelectionFixtures,
} from "./map-fixtures.js";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

function currentMapObstacles() {
  return normalizeJoinedObstacleRects(
    mapObstacleElements(resolvedMapConfig.elements),
  );
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

function testSeededMapVariantSelection() {
  const variants = variantSelectionFixtures;
  const seed = "same-seed";

  assert.equal(hashMapSeed(seed), hashMapSeed(seed));
  assert.equal(
    selectSeededMapVariant(variants, seed),
    selectSeededMapVariant(variants, seed),
  );
  assert.equal(selectSeededMapVariant(variants, "b").id, "b");
  assert.equal(selectSeededMapVariant([null, variants[0]], "a").id, "a");
  assert.equal(selectSeededMapVariant([null], "a"), null);
}

testSeededMapVariantSelection();

function testProceduralMapBoundaryWrapsVariantSelection() {
  assert.equal(resolveSeededMapConfig(simpleSeededMapConfig).variantId, "only");
  assert.equal(
    resolveMapVariantConfig(simpleSeededMapConfig, "only").variantId,
    "only",
  );
  assert.equal(
    selectNextMapVariant(simpleSeededMapConfig.variants, "missing").id,
    "only",
  );
}

testProceduralMapBoundaryWrapsVariantSelection();

function testProceduralMapGenerationReturnsValidSeededVariants() {
  const variants = generateProceduralMapVariants({
    baseMapConfig: resolvedMapConfig,
    count: 4,
    seed: "batch-seed",
  });
  const repeated = generateProceduralMapVariants({
    baseMapConfig: resolvedMapConfig,
    count: 4,
    seed: "batch-seed",
  });

  assert.equal(variants.length, 4);
  assert.deepEqual(variants, repeated);
  assert.deepEqual(
    variants.map((variant) => variant.id),
    ["generated-1-0", "generated-2-1", "generated-3-2", "generated-1-3"],
  );
  variants.forEach((variant) => {
    assert.deepEqual(
      validateMapConfig({
        ...resolvedMapConfig,
        ...variant,
      }),
      [],
    );
  });
}

testProceduralMapGenerationReturnsValidSeededVariants();

function testProceduralMapGenerationIsGridAlignedAndSeeded() {
  const variants = generateProceduralMapVariants({
    baseMapConfig: resolvedMapConfig,
    count: 3,
    seed: "same-seed",
  });
  const otherSeedVariants = generateProceduralMapVariants({
    baseMapConfig: resolvedMapConfig,
    count: 3,
    seed: "other-seed",
  });
  const generated = variants[2];

  assert.notDeepEqual(variants, otherSeedVariants);
  assert.equal(generated.spawn.x % resolvedMapConfig.grid.size, 0);
  assert.equal(generated.goal.y % resolvedMapConfig.grid.size, 0);
  assert.equal(
    generated.elements.every(
      (element) =>
        element.x % resolvedMapConfig.grid.size === 0 &&
        element.y % resolvedMapConfig.grid.size === 0 &&
        element.w % resolvedMapConfig.grid.size === 0 &&
        element.h % resolvedMapConfig.grid.size === 0,
    ),
    true,
  );
}

testProceduralMapGenerationIsGridAlignedAndSeeded();

function testBaseMapConfigAppendsProceduralVariantsAfterAuthoredMaps() {
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

testBaseMapConfigAppendsProceduralVariantsAfterAuthoredMaps();

function testProceduralMapGenerationKeepsSpawnAndGoalClear() {
  const variants = generateProceduralMapVariants({
    baseMapConfig: resolvedMapConfig,
    count: 6,
    seed: "clear-zone-seed",
  });

  variants.forEach((variant) => {
    variant.elements.forEach((element) => {
      assert.equal(
        circleRectContact({ ...variant.spawn, r: variant.spawn.r * 4 }, element)
          .intersects,
        false,
      );
      assert.equal(
        circleRectContact(
          { ...variant.goal, r: variant.goal.r * 1.45 },
          element,
        ).intersects,
        false,
      );
    });
  });
}

testProceduralMapGenerationKeepsSpawnAndGoalClear();

function testProceduralMapGenerationIncludesPlayableElementMix() {
  const variants = generateProceduralMapVariants({
    baseMapConfig: resolvedMapConfig,
    count: 6,
    seed: "element-mix-seed",
  });
  const elements = variants.flatMap((variant) => variant.elements);

  assert.equal(
    elements.some((element) => element.type === "obstacle"),
    true,
  );
  assert.equal(
    elements.some((element) => element.type === "roughPatch"),
    true,
  );
  assert.equal(
    elements.some((element) => element.type === "icePatch"),
    true,
  );
}

testProceduralMapGenerationIncludesPlayableElementMix();

function testProceduralMapsUseOneTerrainFocus() {
  const variants = generateProceduralMapVariants({
    baseMapConfig: resolvedMapConfig,
    count: 6,
    seed: "terrain-focus-seed",
  });

  variants.forEach((variant) => {
    const terrainTypes = new Set(
      variant.elements
        .filter(
          (element) =>
            element.type === "roughPatch" || element.type === "icePatch",
        )
        .map((element) => element.type),
    );

    assert.equal(terrainTypes.size <= 1, true);
    if (terrainTypes.size === 1) {
      assert.equal([...terrainTypes][0], variant.terrainFocus);
    }
  });
}

testProceduralMapsUseOneTerrainFocus();

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
  assert.deepEqual(mapRoughPatchElements(undefined), []);
}

testMapElementFiltersHandleMalformedInput();

function testMapProgressionHandlesMissingCurrentMap() {
  const hints = [];
  let renderRequests = 0;
  const progression = createMapProgression({
    baseMapConfig: simpleSeededMapConfig,
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
  let activeMap = resolveSeededMapConfig(simpleSeededMapConfig);
  const progression = createMapProgression({
    baseMapConfig: simpleSeededMapConfig,
    getCurrentMap: () => activeMap,
    applyMap(nextMap) {
      activeMap = nextMap;
    },
    resetForNextMap() {},
    terrainView: { updateGoalProgress() {} },
    ui: { setHint: (hint) => hints.push(hint) },
    requestRender() {},
    copy: copy.hints,
  });

  assert.equal(progression.advanceToNextMap(), true);
  assert.deepEqual(hints, [copy.hints.mapOpen]);
}

testMapProgressionUsesQuietSuccessHint();

function testResolveSeededMapConfigCopiesSelectedElements() {
  const config = simpleSeededMapConfig;
  const resolved = resolveSeededMapConfig(config);

  assert.equal(resolved.seed, "seed-a");
  assert.equal(resolved.variantId, "only");
  assert.deepEqual(resolved.elements, config.variants[0].elements);
  assert.notEqual(resolved.elements, config.variants[0].elements);
}

testResolveSeededMapConfigCopiesSelectedElements();

function testResolveMapVariantConfigIgnoresMalformedVariants() {
  const resolved = resolveMapVariantConfig(malformedVariantConfig, "safe");

  assert.equal(resolved.variantId, "safe");
}

testResolveMapVariantConfigIgnoresMalformedVariants();

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

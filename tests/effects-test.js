import assert from "node:assert/strict";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";
import { visualConfig } from "../core/game-config.js";
import { MAP_ELEMENT_TYPES } from "../core/map-elements.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function testEffectsThrottleAndParticleCap() {
  const originalDocument = globalThis.document;
  let currentTime = 0;

  globalThis.document = {
    createElement(tagName) {
      if (tagName === "canvas") return new FakeCanvasElement();
      return new FakeElement();
    },
  };

  try {
    const { createEffectsRenderer } = await import(
      "../rendering/effects.js?test=" + Date.now()
    );
    const effectsEl = new FakeElement();
    const effects = createEffectsRenderer({
      effectsEl,
      marble: { x: 50, y: 50, vx: 10, vy: 0, r: 10 },
      config: {
        impactMin: 1,
        impactReference: 10,
        impactCooldownMs: 100,
        maxParticles: 3,
        impactMinParticles: 2,
        impactExtraParticles: 0,
        impactEdgeRatio: 1,
        impactJitterRatio: 0,
        impactSpread: 0,
        impactDriftMin: 1,
        impactDriftRange: 0,
        impactSizeMin: 2,
        impactSizeRange: 0,
        impactLifeMinMs: 100,
        impactLifeRangeMs: 0,
        impactOpacity: 0.5,
        gooSplatMinSpeed: 1,
        gooSplatReferenceSpeed: 10,
        gooSplatCooldownMs: 100,
        gooSplatSizeBase: 18,
        gooSplatSizeRange: 8,
        gooSplatLifeMs: 150,
        gooSplatOpacity: 0.45,
        waterRippleMinSpeed: 1,
        waterRippleReferenceSpeed: 10,
        waterRippleCooldownMs: 100,
        waterRippleSizeBase: 20,
        waterRippleSizeRange: 10,
        waterRippleLifeMs: 150,
        waterRippleOpacity: 0.4,
        canvasScale: 0.5,
        canvasWorldSize: 100,
        goalCompleteParticles: 4,
        goalCompleteDriftMin: 2,
        goalCompleteDriftRange: 0,
        goalCompleteSizeMin: 3,
        goalCompleteSizeRange: 0,
        goalCompleteLifeMs: 120,
        goalCompleteOpacity: 0.7,
      },
      clamp,
      random: () => 0.5,
      now: () => currentTime,
      world: { width: 200, height: 200 },
    });

    assert.equal(effectsEl.childNodes.length, 1);
    assert.equal(effects.canvas.className, "effectsCanvas");
    effects.setWorld({ width: 300, height: 120 });
    assert.equal(effects.canvas.width, 50);
    assert.equal(effects.canvas.height, 50);
    assert.equal(effects.canvas.style.width, "100px");
    assert.equal(effects.canvas.style.height, "100px");
    effects.render(currentTime);
    effects.render(currentTime);
    assert.equal(
      effects.canvas.context.calls.filter((call) => call[0] === "clearRect")
        .length,
      0,
      "an empty effects canvas should not be cleared every frame",
    );
    effects.spawnImpact(5);
    assert.equal(effects.activeCount(), 2);
    effects.spawnImpact(5);
    assert.equal(effects.activeCount(), 2);

    currentTime = 150;
    effects.spawnImpact(5);
    assert.equal(effects.activeCount(), 3);

    effects.clear();
    assert.equal(effectsEl.childNodes.length, 1);
    assert.equal(effects.activeCount(), 0);
    effects.spawnGoalComplete();
    assert.equal(effects.activeCount(), 3);
    effects.render(currentTime);
    assert.equal(
      effects.canvas.context.calls.some((call) => call[0] === "ellipse"),
      true,
    );
    assert.equal(
      Number.parseFloat(effects.canvas.style.left) >= 0,
      true,
      "the bounded effects canvas should remain inside the world",
    );

    effects.clear();
    assert.equal(effects.activeCount(), 0);
    effects.spawnImpact(5);
    assert.equal(effects.activeCount(), 2);

    currentTime = 1000;
    effects.render(currentTime);
    assert.equal(effects.activeCount(), 0);

    effects.clear();
    currentTime = 300;
    effects.spawnWaterRipple(5);
    effects.spawnWaterRipple(5);
    assert.equal(effects.activeCount(), 1);

    effects.clear();
    currentTime = 500;
    effects.spawnGooSplat(5);
    effects.spawnGooSplat(5);
    assert.equal(effects.activeCount(), 1);
    effects.canvas.context.calls.length = 0;
    effects.render(currentTime);
    currentTime += 200;
    effects.render(currentTime);
    const firstDirtyClear = effects.canvas.context.calls.find(
      (call) => call[0] === "clearRect",
    );
    assert.ok(
      firstDirtyClear[3] < effects.canvas.width &&
        firstDirtyClear[4] < effects.canvas.height,
      "effects should clear only the prior particle footprint",
    );
    effects.render(currentTime + 1);
    assert.equal(
      effects.canvas.context.calls.filter((call) => call[0] === "clearRect")
        .length,
      1,
      "effects should clear the final particle footprint once it expires",
    );
  } finally {
    globalThis.document = originalDocument;
  }
}

await testEffectsThrottleAndParticleCap();

async function testLiquidWakeClippingAndSquishLifecycle() {
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: () => new FakeCanvasElement(),
  };
  try {
    const { createEffectsRenderer } = await import("../rendering/effects.js");
    const water = {
      type: MAP_ELEMENT_TYPES.waterPatch,
      x: 200,
      y: 200,
      w: 200,
      h: 160,
    };
    const goo = { ...water, type: MAP_ELEMENT_TYPES.gooPatch, x: 600 };
    const marble = { x: 20, y: 20, vx: 6, vy: 0, r: 10 };
    let currentTime = 0;
    const effects = createEffectsRenderer({
      effectsEl: new FakeElement(),
      marble,
      mapState: {
        terrainByType: {
          [water.type]: { elements: [water] },
          [goo.type]: { elements: [goo] },
        },
      },
      config: { ...visualConfig.effects, maxParticles: 3 },
      random: () => 0.5,
      now: () => currentTime,
      world: { width: 1200, height: 800 },
    });
    const calls = effects.canvas.context.calls;

    effects.spawnWaterRipple(6);
    effects.spawnGooSplat(6);
    assert.equal(
      effects.activeCount(),
      0,
      "dry floor must not emit liquid wakes",
    );
    marble.x = 300;
    marble.y = 280;
    effects.spawnWaterRipple(6);
    effects.render();
    assert.equal(effects.activeCount(), 1);
    const ripple = calls.find((call) => call[0] === "ellipse");
    const openAngle = ripple[5] + (ripple[6] + ripple[7]) / 2 + Math.PI;
    assert.ok(
      Math.cos(openAngle) > 0.99,
      "water wake must open along the marble's forward direction",
    );
    assert.ok(
      calls.findIndex((call) => call[0] === "clip") <
        calls.findIndex((call) => call[0] === "stroke"),
      "water wakes must be clipped before drawing",
    );
    const initialClip = calls.find((call) => call[0] === "moveTo");
    water.w *= 0.5;
    water.h *= 0.5;
    calls.length = 0;
    currentTime += 100;
    effects.render();
    const shrunkClip = calls.find((call) => call[0] === "moveTo");
    assert.ok(
      shrunkClip[1] < initialClip[1] - 80,
      "existing ripples must follow the live sponge-shrunken puddle contour",
    );
    assert.ok(shrunkClip[2] < initialClip[2] - 30);
    assert.equal(
      calls.filter((call) => call[0] === "save").length,
      calls.filter((call) => call[0] === "restore").length,
      "liquid clipping must not leak to later effects",
    );

    effects.clear();
    marble.x = 700;
    marble.y = 280;
    marble.vx = 0;
    marble.vy = 6;
    effects.spawnGooSplat(6);
    calls.length = 0;
    effects.render();
    assert.equal(effects.activeCount(), 1);
    assert.ok(calls.some((call) => call[0] === "clip"));
    assert.ok(
      calls.some((call) => call[0] === "quadraticCurveTo"),
      "goo should leave a stretched wake",
    );
    const wakeTransform = calls.find((call) => call[0] === "transform");
    assert.ok(
      Math.abs(wakeTransform[1]) < 1e-12 && wakeTransform[2] === 1,
      "wake must turn with the marble's travel direction",
    );
    currentTime += visualConfig.effects.waterRippleLifeMs;
    effects.render();
    assert.equal(
      effects.activeCount(),
      1,
      "viscous goo disturbance should outlast water ripples",
    );

    effects.setWorld({ width: 600, height: 600 });
    assert.equal(
      effects.activeCount(),
      0,
      "map transitions must discard old liquid references and effects",
    );
    effects.spawnAntSquish({ x: 125, y: 140, angle: 0, squishStrength: 1 });
    assert.equal(
      effects.activeCount(),
      3,
      "ant feedback must share the existing particle cap",
    );
    calls.length = 0;
    effects.render();
    assert.equal(
      calls.some((call) => call[0] === "clip"),
      false,
    );
    for (const dot of calls.filter((call) => call[0] === "ellipse")) {
      assert.equal(
        dot[1],
        125,
        "swept crush flecks must start at the ant, not the marble endpoint",
      );
      assert.equal(dot[2], 140);
    }
    currentTime += visualConfig.effects.antSquishLifeMs;
    effects.render();
    assert.equal(
      effects.activeCount(),
      0,
      "flecks expire while the kitchen owns persistent remains",
    );
    effects.spawnAntSquish({ x: 125, y: 140, angle: 0 });
    effects.clear();
    assert.equal(
      effects.activeCount(),
      0,
      "Retry clears transient ant feedback",
    );
  } finally {
    globalThis.document = originalDocument;
  }
}

await testLiquidWakeClippingAndSquishLifecycle();

async function testMaterialImpactShapesStrengthAndSharedThrottle() {
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => new FakeCanvasElement() };
  try {
    const { createEffectsRenderer } = await import("../rendering/effects.js");
    let time = 0;
    const effects = createEffectsRenderer({
      effectsEl: new FakeElement(),
      marble: { x: 129, y: 140, vx: -8, vy: 0, r: 29 },
      config: { ...visualConfig.effects, maxParticles: 2 },
      random: () => 0.5,
      now: () => time,
      world: { width: 1200, height: 1200 },
    });
    const contact = { x: 100, y: 140, nx: 1, ny: 0 };
    const calls = effects.canvas.context.calls;
    function sample(material, strength) {
      effects.clear();
      calls.length = 0;
      assert.equal(effects.spawnImpact(strength, material, contact), true);
      effects.render();
      return calls.filter((call) => call[0] === "lineTo");
    }
    const weakGlint = sample("metal", 2);
    assert.equal(effects.activeCount(), 1, "metal uses one restrained glint");
    assert.equal(
      calls.some((call) => call[0] === "ellipse"),
      false,
    );
    for (const start of calls.filter((call) => call[0] === "moveTo")) {
      assert.deepEqual(
        start.slice(1),
        [100, 140],
        "glints start on the fixture, not the marble's post-bounce edge",
      );
    }
    const strongGlint = sample("metal", 8);
    assert.ok(
      Math.hypot(strongGlint[0][1] - 100, strongGlint[0][2] - 140) >
        Math.hypot(weakGlint[0][1] - 100, weakGlint[0][2] - 140),
      "stronger hits enlarge the cue",
    );
    for (const [, x, y] of strongGlint) {
      assert.ok(
        Math.hypot(x - 129, y - 140) > 29,
        "the overlaid marble must not hide the contact glint",
      );
    }
    const cappedGlint = sample("metal", 1000);
    const maximumGlint = sample("metal", visualConfig.effects.impactReference);
    assert.deepEqual(
      cappedGlint,
      maximumGlint,
      "extreme speed cannot grow an unbounded cue",
    );
    time += 200;
    effects.render();
    assert.equal(effects.activeCount(), 0, "metal glints expire quickly");

    sample("wood", 8);
    const arcs = calls.filter((call) => call[0] === "ellipse");
    assert.equal(
      arcs.length,
      2,
      "wood uses rounded knock waves, rather than metal rays",
    );
    for (const arc of arcs) {
      assert.deepEqual(arc.slice(1, 3), [100, 140]);
      const [, x, y, radius, , , start, end] = arc;
      const angle = (start + end) / 2;
      assert.ok(
        Math.hypot(
          x + Math.cos(angle) * radius - 129,
          y + Math.sin(angle) * radius - 140,
        ) > 29,
        "wooden knock waves remain outside the marble silhouette too",
      );
    }
    assert.equal(
      effects.spawnImpact(8, "metal", contact),
      false,
      "materials share the original cooldown",
    );
    time += 200;
    effects.render();
    assert.equal(
      effects.activeCount(),
      1,
      "the wood knock settles more slowly than the metal tick",
    );
    effects.spawnImpact(8, "wood", contact);
    time += 100;
    effects.spawnImpact(8, "metal", contact);
    assert.equal(
      effects.activeCount(),
      2,
      "material marks share the particle cap",
    );

    effects.clear();
    assert.equal(effects.spawnImpact(0.1, "sponge", contact), false);
    assert.equal(effects.spawnImpact(8, "sponge", contact), true);
    assert.equal(
      effects.activeCount(),
      0,
      "a sponge compresses instead of shedding sparks",
    );
    assert.equal(
      effects.spawnImpact(8, "sponge", contact),
      false,
      "compression is throttled too",
    );
    effects.setWorld({ width: 1200, height: 1200 });
    assert.equal(
      effects.spawnImpact(8, "sponge", contact),
      true,
      "Retry clears visual cooldowns",
    );
    effects.clear();
    effects.spawnImpact(8);
    assert.equal(
      effects.activeCount(),
      2,
      "unclassified impacts retain their existing particles and cap",
    );
  } finally {
    globalThis.document = originalDocument;
  }
}

await testMaterialImpactShapesStrengthAndSharedThrottle();

console.log("Effects tests passed.");

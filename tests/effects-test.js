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

console.log("Effects tests passed.");

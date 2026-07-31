import assert from "node:assert/strict";
import { FakeCanvasElement, FakeElement } from "./test-dom.js";

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
        surfaceMinSpeed: 1,
        surfaceReferenceSpeed: 10,
        surfaceCooldownMs: 100,
        surfaceMinParticles: 1,
        surfaceExtraParticles: 0,
        surfaceBackRatio: 1,
        surfaceWidthRatio: 1,
        surfaceLiftMin: 1,
        surfaceLiftRange: 0,
        surfaceDriftMin: 1,
        surfaceDriftRange: 0,
        surfaceScatter: 0,
        surfaceSizeMin: 2,
        surfaceSizeRange: 0,
        surfaceLifeMinMs: 100,
        surfaceLifeRangeMs: 0,
        surfaceOpacity: 0.5,
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
  } finally {
    globalThis.document = originalDocument;
  }
}

await testEffectsThrottleAndParticleCap();

console.log("Effects tests passed.");

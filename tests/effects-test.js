import assert from "node:assert/strict";
import { FakeElement } from "./test-dom.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

class FakeParticle extends FakeElement {
  constructor() {
    super();
    this.style = {};
  }
}

async function testEffectsThrottleAndParticleCap() {
  const originalDocument = globalThis.document;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let currentTime = 0;
  let nextTimer = 1;
  const clearedTimers = [];

  globalThis.document = {
    createElement() {
      return new FakeParticle();
    },
  };
  globalThis.setTimeout = () => nextTimer++;
  globalThis.clearTimeout = (timer) => {
    clearedTimers.push(timer);
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
    });

    effects.spawnImpact(5);
    assert.equal(effectsEl.childNodes.length, 2);
    effects.spawnImpact(5);
    assert.equal(effectsEl.childNodes.length, 2);

    currentTime = 150;
    effects.spawnImpact(5);
    assert.equal(effectsEl.childNodes.length, 3);

    effects.clear();
    assert.equal(effectsEl.childNodes.length, 0);
    assert.deepEqual(clearedTimers, [1, 2, 3, 4]);
    effects.spawnGoalComplete();
    assert.equal(effectsEl.childNodes.length, 3);
    assert.equal(effectsEl.childNodes[0].className, "effectParticle celebrate");

    effects.clear();
    assert.equal(effectsEl.childNodes.length, 0);
    assert.deepEqual(clearedTimers, [1, 2, 3, 4, 5, 6, 7, 8]);
    effects.spawnImpact(5);
    assert.equal(effectsEl.childNodes.length, 2);
  } finally {
    globalThis.document = originalDocument;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

await testEffectsThrottleAndParticleCap();

console.log("Effects tests passed.");

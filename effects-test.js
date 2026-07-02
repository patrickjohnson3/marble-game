import assert from "node:assert/strict";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

class FakeParticle {
  constructor() {
    this.parent = null;
    this.style = {};
  }

  setAttribute() {}

  remove() {
    if (!this.parent) return;
    this.parent.childNodes = this.parent.childNodes.filter((child) => child !== this);
    this.parent = null;
  }
}

class FakeElement {
  constructor() {
    this.childNodes = [];
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  appendChild(child) {
    child.parent = this;
    this.childNodes.push(child);
  }

  replaceChildren() {
    this.childNodes.forEach((child) => {
      child.parent = null;
    });
    this.childNodes = [];
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
    }
  };
  globalThis.setTimeout = () => nextTimer++;
  globalThis.clearTimeout = (timer) => {
    clearedTimers.push(timer);
  };

  try {
    const { createEffectsRenderer } = await import("./effects.js?test=" + Date.now());
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
        surfaceOpacity: 0.5
      },
      clamp,
      random: () => 0.5,
      now: () => currentTime
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

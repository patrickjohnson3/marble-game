import assert from "node:assert/strict";
import {
  createRuntimeSettings,
  persistedSettingsFromRuntime
} from "./settings-runtime.js";
import { availableStorage, loadSettings, saveSettings } from "./settings-store.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function storageWith(value) {
  return {
    value,
    getItem() {
      return this.value;
    },
    setItem(_key, nextValue) {
      this.value = nextValue;
    }
  };
}

function testTrailMigrationDefaultsOldSavedTrailOff() {
  const settings = loadSettings({
    storage: storageWith(JSON.stringify({
      maxSpeed: 12,
      acceleration: 0.1,
      trailEnabled: true
    })),
    storageKey: "settings",
    defaults: {
      maxSpeed: 14,
      acceleration: 0.115,
      rotationEnabled: false,
      hapticsEnabled: true,
      trailEnabled: false,
      trailDefaultVersion: 2,
      fullscreenEnabled: true
    },
    controls: {
      maxSpeed: { min: 8, max: 24 },
      acceleration: { min: 0.06, max: 0.18 }
    },
    clamp
  });

  assert.equal(settings.trailEnabled, false);
  assert.equal(settings.trailDefaultVersion, 2);
}

function testTrailMigrationPreservesCurrentSavedTrailChoice() {
  const settings = loadSettings({
    storage: storageWith(JSON.stringify({
      maxSpeed: 12,
      acceleration: 0.1,
      trailEnabled: true,
      trailDefaultVersion: 2
    })),
    storageKey: "settings",
    defaults: {
      maxSpeed: 14,
      acceleration: 0.115,
      rotationEnabled: false,
      hapticsEnabled: true,
      trailEnabled: false,
      trailDefaultVersion: 2,
      fullscreenEnabled: true
    },
    controls: {
      maxSpeed: { min: 8, max: 24 },
      acceleration: { min: 0.06, max: 0.18 }
    },
    clamp
  });

  assert.equal(settings.trailEnabled, true);
}

function testRuntimeSettingsAreIndependentFromPersistedSettings() {
  const persisted = {
    maxSpeed: 14,
    acceleration: 0.115,
    rotationEnabled: false,
    hapticsEnabled: true,
    trailEnabled: false,
    trailDefaultVersion: 2,
    fullscreenEnabled: true
  };
  const runtime = createRuntimeSettings(persisted);

  runtime.maxSpeed = 20;

  assert.equal(persisted.maxSpeed, 14);
  assert.deepEqual(persistedSettingsFromRuntime(runtime), {
    ...persisted,
    maxSpeed: 20
  });
}

function testUnavailableStorageFallsBackToDefaults() {
  const defaults = {
    maxSpeed: 14,
    acceleration: 0.115,
    rotationEnabled: false,
    hapticsEnabled: true,
    trailEnabled: false,
    trailDefaultVersion: 2,
    fullscreenEnabled: true
  };
  const controls = {
    maxSpeed: { min: 8, max: 24 },
    acceleration: { min: 0.06, max: 0.18 }
  };
  const storage = availableStorage(() => {
    throw new Error("storage blocked");
  });

  assert.equal(storage, null);
  assert.deepEqual(loadSettings({
    storage,
    storageKey: "settings",
    defaults,
    controls,
    clamp
  }), defaults);
  assert.doesNotThrow(() => saveSettings({
    storage,
    storageKey: "settings",
    settings: defaults
  }));
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

testTrailMigrationDefaultsOldSavedTrailOff();
testTrailMigrationPreservesCurrentSavedTrailChoice();
testRuntimeSettingsAreIndependentFromPersistedSettings();
testUnavailableStorageFallsBackToDefaults();
await testEffectsThrottleAndParticleCap();

console.log("UI behavior tests passed.");

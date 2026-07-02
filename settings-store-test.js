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

function testTrailMigrationDefaultsOldSavedTrailOff() {
  const settings = loadSettings({
    storage: storageWith(JSON.stringify({
      maxSpeed: 12,
      acceleration: 0.1,
      trailEnabled: true
    })),
    storageKey: "settings",
    defaults,
    controls,
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
    defaults,
    controls,
    clamp
  });

  assert.equal(settings.trailEnabled, true);
}

function testRuntimeSettingsAreIndependentFromPersistedSettings() {
  const persisted = { ...defaults };
  const runtime = createRuntimeSettings(persisted);

  runtime.maxSpeed = 20;

  assert.equal(persisted.maxSpeed, 14);
  assert.deepEqual(persistedSettingsFromRuntime(runtime), {
    ...persisted,
    maxSpeed: 20
  });
}

function testUnavailableStorageFallsBackToDefaults() {
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

testTrailMigrationDefaultsOldSavedTrailOff();
testTrailMigrationPreservesCurrentSavedTrailChoice();
testRuntimeSettingsAreIndependentFromPersistedSettings();
testUnavailableStorageFallsBackToDefaults();

console.log("Settings store tests passed.");

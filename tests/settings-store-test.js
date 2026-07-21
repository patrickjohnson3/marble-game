import assert from "node:assert/strict";
import {
  availableStorage,
  createRuntimeSettings,
  loadSettings,
  persistedSettingsFromRuntime,
  saveSettings,
} from "../settings/settings-store.js";

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
    },
  };
}

const defaults = {
  maxSpeed: 14,
  acceleration: 0.115,
  hapticsEnabled: true,
  trailEnabled: false,
  trailDefaultVersion: 2,
  fullscreenEnabled: true,
  fpsEnabled: false,
  statsEnabled: false,
};
const controls = {
  maxSpeed: { min: 8, max: 24 },
  acceleration: { min: 0.06, max: 0.18 },
};

function testTrailMigrationDefaultsOldSavedTrailOff() {
  const settings = loadSettings({
    storage: storageWith(
      JSON.stringify({
        maxSpeed: 12,
        acceleration: 0.1,
        trailEnabled: true,
      }),
    ),
    storageKey: "settings",
    defaults,
    controls,
    clamp,
  });

  assert.equal(settings.trailEnabled, false);
  assert.equal(settings.trailDefaultVersion, 2);
}

function testTrailMigrationPreservesCurrentSavedTrailChoice() {
  const settings = loadSettings({
    storage: storageWith(
      JSON.stringify({
        maxSpeed: 12,
        acceleration: 0.1,
        trailEnabled: true,
        trailDefaultVersion: 2,
      }),
    ),
    storageKey: "settings",
    defaults,
    controls,
    clamp,
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
    maxSpeed: 20,
  });
}

function testPersistedSettingsFilterRuntimeOnlyKeys() {
  const runtime = {
    ...defaults,
    maxSpeed: 18,
    transientDebugFlag: true,
    sensorPhase: "running",
  };
  const storage = storageWith(null);

  assert.deepEqual(persistedSettingsFromRuntime(runtime), {
    ...defaults,
    maxSpeed: 18,
  });

  saveSettings({
    storage,
    storageKey: "settings",
    settings: runtime,
  });

  assert.deepEqual(JSON.parse(storage.value), {
    ...defaults,
    maxSpeed: 18,
  });
}

function testUnavailableStorageFallsBackToDefaults() {
  const storage = availableStorage(() => {
    throw new Error("storage blocked");
  });

  assert.equal(storage, null);
  assert.deepEqual(
    loadSettings({
      storage,
      storageKey: "settings",
      defaults,
      controls,
      clamp,
    }),
    defaults,
  );
  assert.doesNotThrow(() =>
    saveSettings({
      storage,
      storageKey: "settings",
      settings: defaults,
    }),
  );
}

function testFpsSettingPersistsValidChoice() {
  const settings = loadSettings({
    storage: storageWith(
      JSON.stringify({
        ...defaults,
        fpsEnabled: true,
      }),
    ),
    storageKey: "settings",
    defaults,
    controls,
    clamp,
  });

  assert.equal(settings.fpsEnabled, true);
}

function testStatsSettingPersistsValidChoice() {
  const settings = loadSettings({
    storage: storageWith(
      JSON.stringify({
        ...defaults,
        statsEnabled: true,
      }),
    ),
    storageKey: "settings",
    defaults,
    controls,
    clamp,
  });

  assert.equal(settings.statsEnabled, true);
}

function testMalformedSavedSettingsFallBackToDefaults() {
  const settings = loadSettings({
    storage: storageWith(
      JSON.stringify({
        maxSpeed: "fast",
        acceleration: null,
        hapticsEnabled: "yes",
        trailEnabled: false,
        trailDefaultVersion: 2,
        fullscreenEnabled: 1,
        fpsEnabled: true,
        statsEnabled: false,
      }),
    ),
    storageKey: "settings",
    defaults,
    controls,
    clamp,
  });

  assert.equal(settings.maxSpeed, defaults.maxSpeed);
  assert.equal(settings.acceleration, defaults.acceleration);
  assert.equal(settings.hapticsEnabled, defaults.hapticsEnabled);
  assert.equal(settings.trailEnabled, false);
  assert.equal(settings.fullscreenEnabled, defaults.fullscreenEnabled);
  assert.equal(settings.fpsEnabled, true);
  assert.equal(settings.statsEnabled, false);
}

function testNumericSettingsClampToControlRanges() {
  const low = loadSettings({
    storage: storageWith(
      JSON.stringify({
        maxSpeed: 1,
        acceleration: 0.001,
      }),
    ),
    storageKey: "settings",
    defaults,
    controls,
    clamp,
  });
  const high = loadSettings({
    storage: storageWith(
      JSON.stringify({
        maxSpeed: 100,
        acceleration: 10,
      }),
    ),
    storageKey: "settings",
    defaults,
    controls,
    clamp,
  });

  assert.equal(low.maxSpeed, controls.maxSpeed.min);
  assert.equal(low.acceleration, controls.acceleration.min);
  assert.equal(high.maxSpeed, controls.maxSpeed.max);
  assert.equal(high.acceleration, controls.acceleration.max);
}

testTrailMigrationDefaultsOldSavedTrailOff();
testTrailMigrationPreservesCurrentSavedTrailChoice();
testRuntimeSettingsAreIndependentFromPersistedSettings();
testPersistedSettingsFilterRuntimeOnlyKeys();
testUnavailableStorageFallsBackToDefaults();
testFpsSettingPersistsValidChoice();
testStatsSettingPersistsValidChoice();
testMalformedSavedSettingsFallBackToDefaults();
testNumericSettingsClampToControlRanges();

console.log("Settings store tests passed.");

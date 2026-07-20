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
  cameraMode: "follow",
};
const controls = {
  maxSpeed: { min: 8, max: 24 },
  acceleration: { min: 0.06, max: 0.18 },
  cameraModes: ["follow", "lockedCenter", "predictiveLookAhead"],
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

function testCameraModePersistsValidChoice() {
  const settings = loadSettings({
    storage: storageWith(
      JSON.stringify({
        ...defaults,
        cameraMode: "predictiveLookAhead",
      }),
    ),
    storageKey: "settings",
    defaults,
    controls,
    clamp,
  });

  assert.equal(settings.cameraMode, "predictiveLookAhead");
}

function testCameraModeFallsBackForInvalidChoice() {
  const settings = loadSettings({
    storage: storageWith(
      JSON.stringify({
        ...defaults,
        cameraMode: "orbit",
      }),
    ),
    storageKey: "settings",
    defaults,
    controls,
    clamp,
  });

  assert.equal(settings.cameraMode, "follow");
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

testTrailMigrationDefaultsOldSavedTrailOff();
testTrailMigrationPreservesCurrentSavedTrailChoice();
testRuntimeSettingsAreIndependentFromPersistedSettings();
testUnavailableStorageFallsBackToDefaults();
testCameraModePersistsValidChoice();
testCameraModeFallsBackForInvalidChoice();
testFpsSettingPersistsValidChoice();
testStatsSettingPersistsValidChoice();

console.log("Settings store tests passed.");

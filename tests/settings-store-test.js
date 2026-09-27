import assert from "node:assert/strict";
import {
  availableStorage,
  loadSettings,
  saveSettings,
} from "../settings/settings-store.js";

import {
  settingsConfig as defaults,
  settingsControls as controls,
} from "../settings/settings-config.js";

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
  });

  assert.equal(settings.trailEnabled, true);
}

function testPersistedSettingsFilterRuntimeOnlyKeys() {
  const runtime = {
    ...defaults,
    maxSpeed: 18,
    transientDebugFlag: true,
    sensorPhase: "running",
  };
  const storage = storageWith(null);

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

function testMalformedJsonFallsBackToDefaults() {
  assert.deepEqual(
    loadSettings({
      storage: storageWith("{bad json"),
      storageKey: "settings",
    }),
    defaults,
  );
}

function testUnknownSavedSettingsDoNotLeakIntoRuntime() {
  const settings = loadSettings({
    storage: storageWith(
      JSON.stringify({
        ...defaults,
        secretDevOnlySetting: true,
      }),
    ),
    storageKey: "settings",
  });

  assert.equal(Object.hasOwn(settings, "secretDevOnlySetting"), false);
}

function testStorageReadErrorsFallBackToDefaults() {
  const storage = {
    getItem() {
      throw new Error("read blocked");
    },
  };

  assert.deepEqual(
    loadSettings({
      storage,
      storageKey: "settings",
    }),
    defaults,
  );
}

function testStorageWriteErrorsAreIgnored() {
  const storage = {
    setItem() {
      throw new Error("write blocked");
    },
  };

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
  });

  assert.equal(settings.maxSpeed, defaults.maxSpeed);
  assert.equal(settings.acceleration, defaults.acceleration);
  assert.equal(settings.hapticsEnabled, defaults.hapticsEnabled);
  assert.equal(settings.trailEnabled, false);
  assert.equal(settings.fullscreenEnabled, defaults.fullscreenEnabled);
  assert.equal(settings.goalIndicatorEnabled, defaults.goalIndicatorEnabled);
  assert.equal(settings.hitboxOverlayEnabled, defaults.hitboxOverlayEnabled);
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
  });
  const high = loadSettings({
    storage: storageWith(
      JSON.stringify({
        maxSpeed: 100,
        acceleration: 10,
      }),
    ),
    storageKey: "settings",
  });

  assert.equal(low.maxSpeed, controls.maxSpeed.min);
  assert.equal(low.acceleration, controls.acceleration.min);
  assert.equal(high.maxSpeed, controls.maxSpeed.max);
  assert.equal(high.acceleration, controls.acceleration.max);
}

function testLoadsDoNotShareMutableDefaults() {
  const original = { ...defaults };
  for (const storage of [null, storageWith("{bad json"), storageWith("{}")]) {
    const settings = loadSettings({ storage, storageKey: "settings" });
    settings.maxSpeed += 1;
    settings.trailEnabled = !settings.trailEnabled;
    assert.deepEqual(defaults, original);
    assert.deepEqual(
      loadSettings({ storage, storageKey: "settings" }),
      original,
    );
  }
}

testLoadsDoNotShareMutableDefaults();
testTrailMigrationDefaultsOldSavedTrailOff();
testTrailMigrationPreservesCurrentSavedTrailChoice();
testPersistedSettingsFilterRuntimeOnlyKeys();
testUnavailableStorageFallsBackToDefaults();
testMalformedJsonFallsBackToDefaults();
testUnknownSavedSettingsDoNotLeakIntoRuntime();
testStorageReadErrorsFallBackToDefaults();
testStorageWriteErrorsAreIgnored();
testFpsSettingPersistsValidChoice();
testStatsSettingPersistsValidChoice();
testMalformedSavedSettingsFallBackToDefaults();
testNumericSettingsClampToControlRanges();

console.log("Settings store tests passed.");

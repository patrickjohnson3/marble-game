import { persistedSettingsKeys } from "./settings-config.js";

function copyPersistedSettings(settings) {
  return Object.fromEntries(
    persistedSettingsKeys.map((key) => [key, settings[key]]),
  );
}

export function applyRangeConfig(input, range) {
  input.min = range.min;
  input.max = range.max;
  input.step = range.step;
}

export function createRuntimeSettings(persistedSettings) {
  return copyPersistedSettings(persistedSettings);
}

export function persistedSettingsFromRuntime(settings) {
  return copyPersistedSettings(settings);
}

function numberSetting(value, fallback, range, clamp) {
  return Number.isFinite(value) ? clamp(value, range.min, range.max) : fallback;
}

export function availableStorage(getStorage = () => localStorage) {
  try {
    return getStorage();
  } catch {
    return null;
  }
}

export function loadSettings({
  storage,
  storageKey,
  defaults,
  controls,
  clamp,
}) {
  try {
    if (!storage) return { ...defaults };

    const saved = JSON.parse(storage.getItem(storageKey) || "null");
    if (!saved || typeof saved !== "object") return { ...defaults };
    const trailDefaultVersion = Number.isFinite(saved.trailDefaultVersion)
      ? saved.trailDefaultVersion
      : 1;
    const shouldUseCurrentTrailDefault =
      trailDefaultVersion < defaults.trailDefaultVersion;

    return {
      maxSpeed: numberSetting(
        saved.maxSpeed,
        defaults.maxSpeed,
        controls.maxSpeed,
        clamp,
      ),
      acceleration: numberSetting(
        saved.acceleration,
        defaults.acceleration,
        controls.acceleration,
        clamp,
      ),
      hapticsEnabled:
        typeof saved.hapticsEnabled === "boolean"
          ? saved.hapticsEnabled
          : defaults.hapticsEnabled,
      trailEnabled:
        shouldUseCurrentTrailDefault || typeof saved.trailEnabled !== "boolean"
          ? defaults.trailEnabled
          : saved.trailEnabled,
      trailDefaultVersion: defaults.trailDefaultVersion,
      fullscreenEnabled:
        typeof saved.fullscreenEnabled === "boolean"
          ? saved.fullscreenEnabled
          : defaults.fullscreenEnabled,
      fpsEnabled:
        typeof saved.fpsEnabled === "boolean"
          ? saved.fpsEnabled
          : defaults.fpsEnabled,
      statsEnabled:
        typeof saved.statsEnabled === "boolean"
          ? saved.statsEnabled
          : defaults.statsEnabled,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings({ storage, storageKey, settings }) {
  try {
    if (!storage) return;

    storage.setItem(
      storageKey,
      JSON.stringify(copyPersistedSettings(settings)),
    );
  } catch {
    // Persistence is optional; gameplay should still work without storage.
  }
}

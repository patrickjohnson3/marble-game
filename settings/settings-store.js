import { persistedSettingsKeys, settingsSchema } from "./settings-config.js";

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
  if (!Number.isFinite(value)) return fallback;
  if (!range) return value;
  return clamp(value, range.min, range.max);
}

function settingValue({ clamp, controls, defaults, key, saved }) {
  const config = settingsSchema[key];
  const fallback = defaults[key];

  if (config?.type === "number") {
    return numberSetting(saved[key], fallback, controls[key], clamp);
  }
  if (config?.type === "boolean") {
    return typeof saved[key] === "boolean" ? saved[key] : fallback;
  }
  return saved[key] ?? fallback;
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
    const settings = Object.fromEntries(
      persistedSettingsKeys.map((key) => [
        key,
        settingValue({ clamp, controls, defaults, key, saved }),
      ]),
    );

    settings.trailEnabled = shouldUseCurrentTrailDefault
      ? defaults.trailEnabled
      : settings.trailEnabled;
    settings.trailDefaultVersion = defaults.trailDefaultVersion;
    return settings;
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

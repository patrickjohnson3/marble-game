import { clamp } from "../core/geometry.js";
import {
  persistedSettingsKeys,
  settingsConfig,
  settingsSchema,
} from "./settings-config.js";

function copyPersistedSettings(settings) {
  return Object.fromEntries(
    persistedSettingsKeys.map((key) => [key, settings[key]]),
  );
}

function numberSetting(value, fallback, range) {
  if (!Number.isFinite(value)) return fallback;
  if (!range) return value;
  return clamp(value, range.min, range.max);
}

function settingValue(key, saved) {
  const config = settingsSchema[key];
  const fallback = config.defaultValue;

  if (config?.type === "number") {
    return numberSetting(saved[key], fallback, config.control);
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

export function loadSettings({ storage, storageKey }) {
  try {
    if (!storage) return { ...settingsConfig };

    const saved = JSON.parse(storage.getItem(storageKey) || "null");
    if (!saved || typeof saved !== "object") return { ...settingsConfig };
    const trailDefaultVersion = Number.isFinite(saved.trailDefaultVersion)
      ? saved.trailDefaultVersion
      : 1;
    const shouldUseCurrentTrailDefault =
      trailDefaultVersion < settingsConfig.trailDefaultVersion;
    const settings = Object.fromEntries(
      persistedSettingsKeys.map((key) => [key, settingValue(key, saved)]),
    );

    settings.trailEnabled = shouldUseCurrentTrailDefault
      ? settingsConfig.trailEnabled
      : settings.trailEnabled;
    settings.trailDefaultVersion = settingsConfig.trailDefaultVersion;
    return settings;
  } catch {
    return { ...settingsConfig };
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

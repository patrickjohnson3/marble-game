import { persistedSettingsKeys } from "./settings-config.js";

function copyPersistedSettings(settings) {
  return Object.fromEntries(
    persistedSettingsKeys.map((key) => [key, settings[key]]),
  );
}

export function createRuntimeSettings(persistedSettings) {
  return copyPersistedSettings(persistedSettings);
}

export function persistedSettingsFromRuntime(settings) {
  return copyPersistedSettings(settings);
}

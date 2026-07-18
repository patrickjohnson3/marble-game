export function createRuntimeSettings(persistedSettings) {
  return {
    maxSpeed: persistedSettings.maxSpeed,
    acceleration: persistedSettings.acceleration,
    hapticsEnabled: persistedSettings.hapticsEnabled,
    trailEnabled: persistedSettings.trailEnabled,
    trailDefaultVersion: persistedSettings.trailDefaultVersion,
    fullscreenEnabled: persistedSettings.fullscreenEnabled,
    fpsEnabled: persistedSettings.fpsEnabled,
    statsEnabled: persistedSettings.statsEnabled,
    cameraMode: persistedSettings.cameraMode,
  };
}

export function persistedSettingsFromRuntime(settings) {
  return {
    maxSpeed: settings.maxSpeed,
    acceleration: settings.acceleration,
    hapticsEnabled: settings.hapticsEnabled,
    trailEnabled: settings.trailEnabled,
    trailDefaultVersion: settings.trailDefaultVersion,
    fullscreenEnabled: settings.fullscreenEnabled,
    fpsEnabled: settings.fpsEnabled,
    statsEnabled: settings.statsEnabled,
    cameraMode: settings.cameraMode,
  };
}

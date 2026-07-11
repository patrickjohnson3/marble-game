export function createRuntimeSettings(persistedSettings) {
  return {
    maxSpeed: persistedSettings.maxSpeed,
    acceleration: persistedSettings.acceleration,
    rotationEnabled: persistedSettings.rotationEnabled,
    hapticsEnabled: persistedSettings.hapticsEnabled,
    trailEnabled: persistedSettings.trailEnabled,
    trailDefaultVersion: persistedSettings.trailDefaultVersion,
    fullscreenEnabled: persistedSettings.fullscreenEnabled,
    fpsEnabled: persistedSettings.fpsEnabled,
    cameraMode: persistedSettings.cameraMode
  };
}

export function persistedSettingsFromRuntime(settings) {
  return {
    maxSpeed: settings.maxSpeed,
    acceleration: settings.acceleration,
    rotationEnabled: settings.rotationEnabled,
    hapticsEnabled: settings.hapticsEnabled,
    trailEnabled: settings.trailEnabled,
    trailDefaultVersion: settings.trailDefaultVersion,
    fullscreenEnabled: settings.fullscreenEnabled,
    fpsEnabled: settings.fpsEnabled,
    cameraMode: settings.cameraMode
  };
}

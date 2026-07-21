import {
  exitFullscreenMode,
  requestFullscreenMode,
} from "../platform/platform.js";

export function createSettingsApplier({
  documentRef,
  haptics,
  physics,
  settings,
  trailRenderer,
  requestFullscreen = requestFullscreenMode,
  exitFullscreen = exitFullscreenMode,
}) {
  function applySettings() {
    physics.maxSpeed = settings.maxSpeed;
    physics.accel = settings.acceleration;
    haptics.enabled = settings.hapticsEnabled;
    trailRenderer.setEnabled(settings.trailEnabled);
  }

  function applyFullscreenSetting() {
    if (settings.fullscreenEnabled) {
      requestFullscreen({ fullscreenOnStart: true, documentRef });
    } else {
      exitFullscreen({ documentRef });
    }
  }

  return {
    applyFullscreenSetting,
    applySettings,
  };
}

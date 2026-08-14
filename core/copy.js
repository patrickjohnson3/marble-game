export const copy = {
  bootError: "game failed to load. refresh and try again.",
  title: "marble tilt",
  initialHint: "",
  hints: {
    mapOpen: "",
    noMotionSensor:
      "no motion sensor yet. use arrows/WASD here, or try HTTPS on your phone.",
    neutralSet: "neutral set. tilt from your normal holding angle.",
    motionDenied: "motion permission denied. check chrome site settings.",
    calibrating: "keep holding normally for half a sec...",
    neutralReset: "neutral reset to current hand position.",
    icePatch: "ice: slippery.",
    gooPatch: "green goo: sticky.",
    roughPatch: "rough patch: heavy drag.",
    waterPatch: "water: shallow drag, ripples on contact.",
    hazardPatch: "hazard. back to start.",
    goalNoNextMap: "goal reached. no next map available.",
  },
  pwa: {
    checking: "checking for app updates...",
    error: "offline app setup failed. refresh online and try again.",
    installedFullscreen:
      "installed app mode. fullscreen is handled by the app.",
    unsupported: "offline app unavailable in this browser.",
    updateDelayed:
      "app update is taking longer than expected. current version is still available.",
    updateFailed: "app update failed. current version is still available.",
    updateInstalling: "downloading app update...",
    updateReady: "app update installed. reloading...",
  },
  intro: {
    countdown: "map opens in",
  },
  buttons: {
    start: "start",
    closeSettings: "×",
    installApp: "install app",
    neutral: "set neutral",
    retryMap: "retry map",
    reset: "reset",
    resume: "resume",
  },
  settings: {
    toggleLabel: "settings",
    title: "Settings",
    closeLabel: "close settings",
    help: {
      title: "Controls & map",
      movement: "Tilt your phone to steer. On desktop, use arrows or WASD.",
      camera: "Pinch to zoom. Drag with two fingers to pan.",
      goal: "Hold the marble inside the green goal to visit the next map.",
    },
    sections: {
      gameplay: "Gameplay",
      device: "Device",
      diagnostics: "Diagnostics",
    },
    labels: {
      speedSetting: "top speed",
      sensitivitySetting: "tilt response",
      hapticsSetting: "haptics",
      trailSetting: "trail",
      fullscreenSetting: "fullscreen",
      goalIndicatorSetting: "goal arrow",
      hitboxOverlaySetting: "hitboxes",
      fpsSetting: "fps",
      statsSetting: "stats",
    },
  },
  debugFallback: "waiting for sensors...",
};

export function applyDocumentCopy({ document, els }) {
  document.title = copy.title;

  els.hint.textContent = copy.initialHint;
  els.startBtn.textContent = copy.buttons.start;
  els.settingsToggle.setAttribute("aria-label", copy.settings.toggleLabel);
  els.settingsToggle.title = copy.settings.title;
  els.settingsTitle.textContent = copy.settings.title;
  els.controlsHelpTitle.textContent = copy.settings.help.title;
  els.movementHelp.textContent = copy.settings.help.movement;
  els.cameraHelp.textContent = copy.settings.help.camera;
  els.goalHelp.textContent = copy.settings.help.goal;
  els.gameplaySettingsTitle.textContent = copy.settings.sections.gameplay;
  els.deviceSettingsTitle.textContent = copy.settings.sections.device;
  els.diagnosticsSettingsTitle.textContent = copy.settings.sections.diagnostics;
  els.closeSettings.setAttribute("aria-label", copy.settings.closeLabel);
  els.closeSettings.textContent = copy.buttons.closeSettings;
  els.installApp.textContent = copy.buttons.installApp;
  els.retryMap.textContent = copy.buttons.retryMap;
  els.resetSpeedSetting.textContent = copy.buttons.reset;
  els.resetSpeedSetting.title = "reset top speed";
  els.resetSpeedSetting.setAttribute("aria-label", "reset top speed");
  els.resetSensitivitySetting.textContent = copy.buttons.reset;
  els.resetSensitivitySetting.title = "reset tilt response";
  els.resetSensitivitySetting.setAttribute("aria-label", "reset tilt response");
  els.neutralBtn.textContent = copy.buttons.neutral;
  els.resumeGame.textContent = copy.buttons.resume;
  els.debug.textContent = copy.debugFallback;

  for (const [controlId, label] of Object.entries(copy.settings.labels)) {
    const labelEl = document.querySelector(
      'label[for="' + controlId + '"] span',
    );
    if (labelEl) labelEl.textContent = label;
  }
}

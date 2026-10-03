export const copy = {
  bootError: "game failed to load. reconnect and try again.",
  title: "marble tilt",
  startHelp:
    "Tilt your phone to roll, or use arrows/WASD. Kill all kitchen ants, then choose Next room; defeat the living-room mouse with fast hits, then reach its exit. Follow the objective shown above. Pinch to zoom; use two fingers to pan, or open Camera.",
  initialHint: "",
  hints: {
    mapOpen: "",
    noMotionSensor:
      "No motion readings. Open Settings for help; arrows/WASD still work.",
    neutralSet: "neutral set. tilt from your normal holding angle.",
    motionDenied:
      "Motion access denied. Open Settings for help; arrows/WASD still work.",
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
    current: "up to date at the last successful check.",
    checking: "checking for app updates...",
    checkFailed:
      "could not check for updates. reconnect and try again; this may be an older release.",
    applying: "applying update and restarting game windows...",
    updateHelp:
      "Updating restarts all open game windows. Current runs will be lost.",
    confirmUpdate:
      "Update and restart all open game windows? Current runs will be lost.",
    error: "offline app setup failed. refresh online and try again.",
    installedFullscreen:
      "installed app mode. fullscreen is handled by the app.",
    unsupported: "offline app unavailable in this browser.",
    updateDelayed:
      "app update is taking longer than expected. current version is still available.",
    updateFailed: "app update failed. current version is still available.",
    updateInstalling: "downloading app update...",
    updateReady:
      "update ready. choose Update now, or finish your game and close all game tabs and windows, then reopen. your current game can continue until you apply it.",
  },
  intro: {
    countdown: "map opens in",
  },
  buttons: {
    start: "start",
    closeSettings: "×",
    installApp: "install app",
    checkAppUpdates: "Check for updates",
    updateApp: "Update now",
    neutral: "set neutral",
    retryMap: "retry map",
    retryMotion: "Reload to retry motion",
    nextRoom: "Next room",
    loadMap: "load map",
    reset: "reset",
    resume: "resume",
  },
  settings: {
    toggleLabel: "settings",
    title: "Settings",
    closeLabel: "close settings",
    motionDeniedHelp:
      "Motion access was denied. Check your browser’s motion permissions. Reload and tap Start to try again; if access stays blocked, close and reopen the browser or installed app. Reloading restarts this run. Keyboard controls still work.",
    motionMissingHelp:
      "No motion readings are available. On a phone, open the game over HTTPS and allow motion access when prompted. After checking access, reload and tap Start. Reloading restarts this run. Keyboard controls still work.",
    mapSwitchHelp:
      "After Start, load any map as a fresh run. Controls and preferences stay unchanged.",
    help: {
      title: "Controls & map",
      movement: "Tilt your phone to steer. On desktop, use arrows or WASD.",
      camera:
        "Pinch to zoom. Drag with two fingers to pan. Or open Camera to zoom, pan nearby, or center on the marble.",
      goal: "Kill all kitchen ants, then choose Next room when ready. Defeat the living-room mouse and reach its exit, or hold inside the green goal. Your current objective is shown above. The Mouse arrow points from your marble toward a distant mouse automatically.",
    },
    sections: {
      gameplay: "Gameplay",
      device: "Device",
      diagnostics: "Diagnostics",
    },
    labels: {
      mapSelect: "test map",
      speedSetting: "top speed",
      sensitivitySetting: "tilt response",
      hapticsSetting: "haptics",
      trailSetting: "trail",
      fullscreenSetting: "fullscreen",
      goalIndicatorSetting: "exit / goal arrow",
      hitboxOverlaySetting: "hitboxes",
      fpsSetting: "fps",
      statsSetting: "stats",
    },
  },
  camera: {
    title: "Camera",
    buttons: {
      zoomOut: { text: "−", label: "Zoom out" },
      zoomIn: { text: "+", label: "Zoom in" },
      centerCamera: { text: "Center", label: "Center on marble" },
      cameraLeft: { text: "←", label: "Pan left" },
      cameraUp: { text: "↑", label: "Pan up" },
      cameraDown: { text: "↓", label: "Pan down" },
      cameraRight: { text: "→", label: "Pan right" },
    },
  },
  debugFallback: "waiting for sensors...",
};

export function applyDocumentCopy({ document, els }) {
  document.title = copy.title;

  els.hint.textContent = copy.initialHint;
  els.startBtn.textContent = copy.buttons.start;
  els.startHelp.textContent = copy.startHelp;
  els.settingsToggle.setAttribute("aria-label", copy.settings.toggleLabel);
  els.settingsToggle.title = copy.settings.title;
  els.settingsTitle.textContent = copy.settings.title;
  els.controlsHelpTitle.textContent = copy.settings.help.title;
  els.movementHelp.textContent = copy.settings.help.movement;
  els.cameraHelp.textContent = copy.settings.help.camera;
  els.cameraControlsTitle.textContent = copy.camera.title;
  for (const [id, button] of Object.entries(copy.camera.buttons)) {
    els[id].textContent = button.text;
    els[id].setAttribute("aria-label", button.label);
  }
  els.goalHelp.textContent = copy.settings.help.goal;
  els.gameplaySettingsTitle.textContent = copy.settings.sections.gameplay;
  els.deviceSettingsTitle.textContent = copy.settings.sections.device;
  els.diagnosticsSettingsTitle.textContent = copy.settings.sections.diagnostics;
  els.closeSettings.setAttribute("aria-label", copy.settings.closeLabel);
  els.closeSettings.textContent = copy.buttons.closeSettings;
  els.installApp.textContent = copy.buttons.installApp;
  els.checkAppUpdates.textContent = copy.buttons.checkAppUpdates;
  els.updateApp.textContent = copy.buttons.updateApp;
  els.pwaUpdateHelp.textContent = copy.pwa.updateHelp;
  els.retryMap.textContent = copy.buttons.retryMap;
  els.retryMotion.textContent = copy.buttons.retryMotion;
  els.nextRoom.textContent = copy.buttons.nextRoom;
  els.loadMap.textContent = copy.buttons.loadMap;
  els.mapSwitchHelp.textContent = copy.settings.mapSwitchHelp;
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

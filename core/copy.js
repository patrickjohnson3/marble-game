export const copy = {
  bootError: "game failed to load. refresh and try again.",
  title: "marble tilt",
  initialHint: "click or tap start. tilt or use arrows/WASD.",
  hints: {
    mapOpen: "map open. pinch to zoom and explore.",
    noMotionSensor: "no motion sensor yet. use arrows/WASD here, or try HTTPS on your phone.",
    neutralSet: "neutral set. tilt from your normal holding angle.",
    motionDenied: "motion permission denied. check chrome site settings.",
	    calibrating: "keep holding normally for half a sec...",
	    neutralReset: "neutral reset to current hand position.",
	    goalNoNextMap: "goal reached. no next map available.",
	    goalNextMapInvalid: "goal reached. next map invalid.",
	    goalNextMap: (variantId) => "goal reached. next map: " + variantId + "."
  },
  intro: {
    countdown: "map opens in"
  },
  buttons: {
    start: "start",
    closeSettings: "×",
    neutral: "set neutral",
    resume: "resume"
  },
  settings: {
    toggleLabel: "settings",
    title: "Settings",
    closeLabel: "close settings",
    labels: {
      speedSetting: "speed",
      sensitivitySetting: "sensitivity",
      rotationSetting: "rotation",
      hapticsSetting: "haptics",
      trailSetting: "trail",
      fullscreenSetting: "fullscreen",
      fpsSetting: "fps",
      cameraModeSetting: "camera"
    },
    cameraModes: {
      follow: "follow",
      lockedCenter: "locked center",
      predictiveLookAhead: "look-ahead"
    }
  },
  debugFallback: "waiting for sensors..."
};

export function applyDocumentCopy({
  document,
  els
}) {
  document.title = copy.title;

  els.hint.textContent = copy.initialHint;
  els.startBtn.textContent = copy.buttons.start;
  els.settingsToggle.setAttribute("aria-label", copy.settings.toggleLabel);
  els.settingsToggle.title = copy.settings.title;
  els.settingsTitle.textContent = copy.settings.title;
  els.closeSettings.setAttribute("aria-label", copy.settings.closeLabel);
  els.closeSettings.textContent = copy.buttons.closeSettings;
  els.neutralBtn.textContent = copy.buttons.neutral;
  els.resumeGame.textContent = copy.buttons.resume;
  els.debug.textContent = copy.debugFallback;

  for (const [controlId, label] of Object.entries(copy.settings.labels)) {
    const labelEl = document.querySelector('label[for="' + controlId + '"] span');
    if (labelEl) labelEl.textContent = label;
  }

  for (const [mode, label] of Object.entries(copy.settings.cameraModes)) {
    const optionEl = els.cameraModeSetting.querySelector('option[value="' + mode + '"]');
    if (optionEl) optionEl.textContent = label;
  }
}

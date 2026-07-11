export function createUi({ hint, fpsCounter, debug, settings, settingsOverlay, debugLines, state }) {
  const fps = {
    lastTime: null,
    sampleElapsed: 0,
    sampleFrames: 0
  };

  function setHint(message) {
    hint.textContent = message;
  }

  function isSettingsOpen() {
    return settingsOverlay.classList.contains("open");
  }

  function updateDebugPanel() {
    if (!isSettingsOpen()) return;

    debug.textContent = debugLines(state).join("\n");
  }

  function resetFpsSample() {
    fps.lastTime = null;
    fps.sampleElapsed = 0;
    fps.sampleFrames = 0;
  }

  function updateFps(now) {
    fpsCounter.hidden = !settings.fpsEnabled;
    if (!settings.fpsEnabled) {
      resetFpsSample();
      return;
    }

    if (fps.lastTime === null) {
      fps.lastTime = now;
      fpsCounter.textContent = "fps --";
      return;
    }

    fps.sampleElapsed += now - fps.lastTime;
    fps.sampleFrames++;
    fps.lastTime = now;

    if (fps.sampleElapsed < 500) return;

    const framesPerSecond = Math.round(fps.sampleFrames * 1000 / fps.sampleElapsed);
    fpsCounter.textContent = "fps " + framesPerSecond;
    fps.sampleElapsed = 0;
    fps.sampleFrames = 0;
  }

  function openSettingsModal() {
    settingsOverlay.classList.add("open");
    settingsOverlay.setAttribute("aria-hidden", "false");
    updateDebugPanel();
  }

  function closeSettingsModal() {
    settingsOverlay.classList.remove("open");
    settingsOverlay.setAttribute("aria-hidden", "true");
  }

  return {
    closeSettingsModal,
    isSettingsOpen,
    openSettingsModal,
    setHint,
    updateDebugPanel,
    updateFps
  };
}

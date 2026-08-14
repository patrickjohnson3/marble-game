export function createUi({
  controls,
  gameStatus,
  goalIndicator,
  hint,
  levelLabel,
  fpsCounter,
  debug,
  installApp,
  mapObjectsStatus,
  pwaStatus,
  settings,
  settingsOverlay,
  startBtn,
  debugLines,
  state,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
}) {
  const fps = {
    lastTime: null,
    sampleElapsed: 0,
    sampleFrames: 0,
  };
  const goalIndicatorState = {
    angleKey: null,
    visible: null,
  };
  const debugLineBuffer = [];
  const debugUpdateIntervalMs = 250;
  let lastDebugText = "";
  let lastDebugUpdate = Number.NEGATIVE_INFINITY;
  let levelLabelTimer = 0;

  function setHint(message) {
    hint.textContent = message;
  }

  function setGameStatus(message) {
    if (!gameStatus) return;

    gameStatus.textContent = message;
    gameStatus.hidden = !message;
  }

  function setLevelLabel(message) {
    levelLabel.textContent = message;
    levelLabel.hidden = !message;
  }

  function showLevelLabel(message, durationMs) {
    clearTimeoutFn(levelLabelTimer);
    setLevelLabel(message);
    levelLabelTimer = setTimeoutFn(() => {
      levelLabelTimer = 0;
      setLevelLabel("");
    }, durationMs);
  }

  function setPwaStatus(message) {
    if (!pwaStatus) return;

    pwaStatus.textContent = message;
    pwaStatus.hidden = !message;
  }

  function setPwaInstallAvailable(available) {
    if (!installApp) return;

    installApp.hidden = !available;
  }

  function setMapObjects(message) {
    if (!mapObjectsStatus) return;

    mapObjectsStatus.textContent = message;
    mapObjectsStatus.hidden = !message;
  }

  function setGoalIndicator({ visible, angle = 0 }) {
    if (goalIndicatorState.visible !== visible) {
      goalIndicatorState.visible = visible;
      goalIndicator.classList.toggle("show", visible);
    }
    const angleKey = Math.round(angle * 1000);
    if (visible && goalIndicatorState.angleKey !== angleKey) {
      goalIndicatorState.angleKey = angleKey;
      goalIndicator.style.setProperty(
        "--goal-indicator-angle",
        angleKey / 1000 + "rad",
      );
    }
  }

  function setStartControls({ visible, disabled, label }) {
    if (visible !== undefined) controls.hidden = !visible;
    if (disabled !== undefined) startBtn.disabled = disabled;
    if (label !== undefined) startBtn.textContent = label;
  }

  function isSettingsOpen() {
    return settingsOverlay.classList.contains("open");
  }

  function updateDebugPanel({ force = false, now = performance.now() } = {}) {
    if (!settings.statsEnabled) return;
    if (!force && now - lastDebugUpdate < debugUpdateIntervalMs) return;

    lastDebugUpdate = now;
    const nextDebugText = debugLines(state, debugLineBuffer).join("\n");
    if (lastDebugText === nextDebugText) return;

    lastDebugText = nextDebugText;
    debug.textContent = nextDebugText;
  }

  function resetFpsSample() {
    fps.lastTime = null;
    fps.sampleElapsed = 0;
    fps.sampleFrames = 0;
  }

  function setFpsEnabled(enabled) {
    fpsCounter.hidden = !enabled;
    fpsCounter.setAttribute("aria-hidden", String(!enabled));
    if (!enabled) resetFpsSample();
  }

  function setStatsEnabled(enabled) {
    debug.hidden = !enabled;
    debug.setAttribute("aria-hidden", String(!enabled));
    if (!enabled) lastDebugText = "";
    if (enabled) updateDebugPanel({ force: true });
  }

  setFpsEnabled(settings.fpsEnabled);
  setStatsEnabled(settings.statsEnabled);

  function updateFps(now) {
    if (!settings.fpsEnabled) return;

    if (fps.lastTime === null) {
      fps.lastTime = now;
      fpsCounter.textContent = "fps --";
      return;
    }

    fps.sampleElapsed += now - fps.lastTime;
    fps.sampleFrames++;
    fps.lastTime = now;

    if (fps.sampleElapsed < 500) return;

    const framesPerSecond = Math.round(
      (fps.sampleFrames * 1000) / fps.sampleElapsed,
    );
    fpsCounter.textContent = "fps " + framesPerSecond;
    fps.sampleElapsed = 0;
    fps.sampleFrames = 0;
  }

  function openSettingsModal() {
    settingsOverlay.classList.add("open");
    settingsOverlay.setAttribute("aria-hidden", "false");
    updateDebugPanel({ force: true });
  }

  function closeSettingsModal() {
    settingsOverlay.classList.remove("open");
    settingsOverlay.setAttribute("aria-hidden", "true");
  }

  return {
    closeSettingsModal,
    isSettingsOpen,
    openSettingsModal,
    setFpsEnabled,
    setGameStatus,
    setGoalIndicator,
    setStatsEnabled,
    setHint,
    setLevelLabel,
    showLevelLabel,
    setMapObjects,
    setPwaInstallAvailable,
    setPwaStatus,
    setStartControls,
    updateDebugPanel,
    updateFps,
  };
}

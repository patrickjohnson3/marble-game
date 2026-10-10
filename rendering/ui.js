import { copy } from "../core/copy.js";
import { GAME_PHASES, SENSOR_MODES } from "../core/runtime-states.js";

const escapedCueFrames = 120; // Two seconds of active simulation time.
const cockroachDirections = [
  "right",
  "below-right",
  "below",
  "below-left",
  "left",
  "above-left",
  "above",
  "above-right",
];

export function createUi({
  controls,
  cameraControls,
  gameStatus,
  goalIndicator,
  cockroachCue,
  cockroachCueText,
  cockroachArrow,
  hint,
  levelLabel,
  objectiveStatus,
  nextRoom,
  fpsCounter,
  debug,
  installApp,
  mapObjectsStatus,
  pwaStatus,
  motionRecovery,
  motionRecoveryHelp,
  settings,
  settingsOverlay,
  settingsToggle,
  startBtn,
  debugLines,
  state,
  viewport,
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
    label: null,
  };
  const debugLineBuffer = [];
  const debugUpdateIntervalMs = 250;
  let lastDebugText = "";
  let lastDebugUpdate = Number.NEGATIVE_INFINITY;
  let levelLabelTimer = 0;
  // Disposable presentation history; gameplay remains owned by map runtime.
  let lastCockroach = null;
  let wasPursuing = false;
  let escapedFrames = 0;
  let cockroachArrowAngle = null;
  let cockroachArrowDirection = null;

  function setHint(message) {
    hint.textContent = message;
  }

  function updateMotionRecovery() {
    if (!motionRecovery) return;
    const { sensor } = state.input;
    motionRecovery.hidden =
      state.game.phase === GAME_PHASES.waiting ||
      sensor.using === SENSOR_MODES.orientation ||
      sensor.using === SENSOR_MODES.motion;
    motionRecoveryHelp.textContent =
      sensor.permission === "denied"
        ? copy.settings.motionDeniedHelp
        : copy.settings.motionMissingHelp;
  }

  function setGameStatus(message) {
    updateMotionRecovery();
    if (!gameStatus) return;

    gameStatus.textContent = message;
    gameStatus.hidden = !message;
  }

  function setObjectiveStatus(message) {
    if (!objectiveStatus || objectiveStatus.textContent === message) return;

    objectiveStatus.textContent = message;
    objectiveStatus.hidden = !message;
  }

  function setDepartureAvailable(available) {
    if (nextRoom) nextRoom.hidden = !available;
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

  function setGoalIndicator(visible, angle = 0, label = "") {
    if (goalIndicatorState.label !== label) {
      goalIndicatorState.label = label;
      goalIndicator.setAttribute("data-label", label);
    }
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

  function renderCockroachCue(cockroach, frameDelta) {
    if (!state.intro.released || state.game.phase === GAME_PHASES.waiting) {
      cockroach = null;
    }
    if (cockroach !== lastCockroach) {
      lastCockroach = cockroach;
      wasPursuing = false;
      escapedFrames = 0;
    }
    const pursuing = cockroach?.mode === "harass";
    if (wasPursuing && !pursuing && cockroach.harassmentIn > 0) {
      // Sustained escape, failed approach, or a counter-hit earns quiet time.
      escapedFrames = escapedCueFrames;
    } else {
      escapedFrames = Math.max(0, escapedFrames - frameDelta);
    }
    wasPursuing = pursuing;
    const text = pursuing
      ? copy.cockroach.pursuit
      : escapedFrames > 0
        ? copy.cockroach.escaped
        : "";
    if (cockroachCueText.textContent !== text)
      cockroachCueText.textContent = text;
    cockroachCue.hidden = !text;
    if (!pursuing) {
      cockroachArrow.hidden = true;
      return;
    }

    const { camera, marble } = state;
    const x = cockroach.x * camera.scale + camera.x;
    const y = cockroach.y * camera.scale + camera.y;
    const radius = cockroach.r * camera.scale;
    const offscreen =
      x + radius < 0 ||
      x - radius > viewport.width() ||
      y + radius < 0 ||
      y - radius > viewport.height();
    cockroachArrow.hidden = !offscreen;
    if (!offscreen) return;

    // Positive world Y points down, like CSS rotation. Pan and uniform zoom
    // affect visibility, but not the direction from marble to insect.
    const angle = Math.atan2(cockroach.y - marble.y, cockroach.x - marble.x);
    const angleKey = Math.round(angle * 1000);
    if (cockroachArrowAngle !== angleKey) {
      cockroachArrowAngle = angleKey;
      cockroachArrow.style.transform = "rotate(" + angleKey / 1000 + "rad)";
    }
    const direction =
      cockroachDirections[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
    if (cockroachArrowDirection !== direction) {
      cockroachArrowDirection = direction;
      cockroachArrow.setAttribute("aria-label", "Roach offscreen " + direction);
    }
  }

  function setStartControls({ visible, disabled, label }) {
    if (visible !== undefined) {
      controls.hidden = !visible;
      if (cameraControls) {
        cameraControls.hidden = visible;
        if (visible) cameraControls.open = false;
      }
    }
    if (disabled !== undefined) startBtn.disabled = disabled;
    if (label !== undefined) startBtn.textContent = label;
  }

  function isSettingsOpen() {
    return settingsOverlay.open;
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
    updateMotionRecovery();
    settingsOverlay.showModal();
    updateDebugPanel({ force: true });
  }

  function closeSettingsModal() {
    if (!settingsOverlay.open) return;
    settingsOverlay.close();
    settingsToggle.focus();
  }

  return {
    closeSettingsModal,
    isSettingsOpen,
    openSettingsModal,
    renderCockroachCue,
    setFpsEnabled,
    setGameStatus,
    setGoalIndicator,
    setStatsEnabled,
    setHint,
    setLevelLabel,
    showLevelLabel,
    setMapObjects,
    setObjectiveStatus,
    setDepartureAvailable,
    setPwaInstallAvailable,
    setPwaStatus,
    setStartControls,
    updateDebugPanel,
    updateFps,
  };
}

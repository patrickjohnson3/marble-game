import { copy } from "./copy.js";
import { createGameController } from "./game-controller.js";
import {
  resetIntroTimerState,
  shouldPauseGame
} from "./intro-timers.js";
import {
  exitFullscreenMode,
  requestFullscreenMode,
  requestMotionPermissionIfNeeded,
  requestWakeLock
} from "../platform/platform.js";

export function createLifecycleController({
  cameraController,
  calibration,
  controlsEl,
  effectsRenderer,
  frameLoop,
  game,
  haptics,
  intro,
  introSequence,
  keyboard,
  mapRenderer,
  marble,
  resetMap = () => {},
  resetCalibration,
  scheduleFrame,
  sensor,
  sensorWatchdog,
  settings,
  startBtn,
  tilt,
  timing,
	  trailRenderer,
	  ui,
	  spawn,
  enableMotion,
  requestFullscreen = requestFullscreenMode,
  exitFullscreen = exitFullscreenMode,
  requestMotionPermission = requestMotionPermissionIfNeeded,
  keepDisplayAwake = requestWakeLock,
  now = () => performance.now(),
  tick
}) {
  let settingsPausedGame = false;
  let lastFrame = now();

  function pauseGame() {
    if (!shouldPauseGame(game)) return false;

    game.paused = true;
    keyboard.x = 0;
    keyboard.y = 0;
    cameraController.resetGesture();
    sensorWatchdog.pause();
    introSequence.pause();
    return true;
  }

  function resumeGame() {
    if (!game.paused) return;

    game.paused = false;
    lastFrame = now();
    sensorWatchdog.resume(() => game.phase === "calibrating" && sensor.using === "none");
    introSequence.resume();
    scheduleFrame();
  }

  function resetGameState() {
    sensorWatchdog.reset();
    introSequence.clearTimers();
    resetCalibration();
    resetMap();

    game.phase = "waiting";
    game.paused = false;
    settingsPausedGame = false;
    sensor.gotOrientation = false;
    sensor.gotMotion = false;
    sensor.using = "none";

    intro.started = false;
    intro.released = false;
    intro.countdownValue = Math.ceil(timing.introReleaseDelayMs / timing.countdownTickMs);
    resetIntroTimerState(intro);

    keyboard.x = 0;
    keyboard.y = 0;
    tilt.rawX = 0;
    tilt.rawY = 0;
    tilt.smoothX = 0;
    tilt.smoothY = 0;

    marble.x = spawn.x;
    marble.y = spawn.y;
    marble.vx = 0;
    marble.vy = 0;
    marble.roll = 0;
    marble.impactSquash = 0;

    const { camera } = cameraController;
    camera.x = 0;
    camera.y = 0;
    camera.scale = 1;
    camera.gestureCooldown = 0;
    cameraController.resetGesture();

    haptics.impact.lastPulse = 0;
    haptics.surface.lastPulse = 0;
    haptics.goal.lastHoldPulse = 0;
    trailRenderer.clear();
    effectsRenderer.clear();
    frameLoop.requestRender();

    controlsEl.hidden = false;
    startBtn.textContent = copy.buttons.start;
    startBtn.disabled = false;
    introSequence.hideMessage();
    mapRenderer.resetIntroPen();
    cameraController.centerOnMarble();
  }

  async function start() {
    startBtn.disabled = true;
    controlsEl.hidden = true;

    const fullscreenRequest = requestFullscreen({ fullscreenOnStart: settings.fullscreenEnabled });

    const ok = await requestMotionPermission();
    if (!ok) {
      await fullscreenRequest;
      if (settings.fullscreenEnabled) exitFullscreen();
      controlsEl.hidden = false;
      startBtn.disabled = false;
      ui.setHint(copy.hints.motionDenied);
      return;
    }

    keepDisplayAwake();
    gameController.reset();
    controlsEl.hidden = true;
    startBtn.disabled = true;
    enableMotion();
    game.phase = "calibrating";
    scheduleFrame();

    ui.setHint(copy.hints.calibrating);

    sensorWatchdog.schedule();
  }

  function openSettings() {
    if (ui.isSettingsOpen()) return;

    settingsPausedGame = gameController.pause();
    ui.openSettingsModal();
  }

  function closeSettingsModal() {
    ui.closeSettingsModal();
    if (settingsPausedGame) {
      settingsPausedGame = false;
      gameController.resume();
    }
  }

  const gameController = createGameController({
    start,
    reset: resetGameState,
    pause: pauseGame,
    resume: resumeGame,
    openSettings,
    closeSettings: closeSettingsModal,
    tick
  });

  return {
    gameController,
    getLastFrame: () => lastFrame,
    setLastFrame: (value) => {
      lastFrame = value;
    }
  };
}

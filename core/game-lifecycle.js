import { copy } from "./copy.js";
import { resetIntroTimerState, shouldPauseGame } from "./intro-timers.js";
import { startGameWithPermissions } from "./startup-flow.js";

export function createLifecycleController({
  cameraController,
  effectsRenderer,
  frameLoop,
  game,
  haptics,
  intro,
  introSequenceState,
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
  tilt,
  timing,
  trailRenderer,
  ui,
  getSpawn,
  enableMotion,
  requestFullscreen,
  requestMotionPermission,
  keepDisplayAwake,
  resetFrameClock = () => {},
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  tick,
}) {
  let settingsPausedGame = false;

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
    resetFrameClock();
    sensorWatchdog.resume(
      () => game.phase === "calibrating" && sensor.using === "none",
    );
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

    intro.released = false;
    introSequenceState.started = false;
    introSequenceState.countdownValue = Math.ceil(
      timing.introReleaseDelayMs / timing.countdownTickMs,
    );
    resetIntroTimerState(introSequenceState);

    keyboard.x = 0;
    keyboard.y = 0;
    tilt.rawX = 0;
    tilt.rawY = 0;
    tilt.smoothX = 0;
    tilt.smoothY = 0;

    const spawn = getSpawn();
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

    ui.setStartControls({
      visible: true,
      disabled: false,
      label: copy.buttons.start,
    });
    introSequence.hideMessage();
    mapRenderer.resetIntroPen();
    cameraController.centerOnMarble();
  }

  async function start() {
    await startGameWithPermissions({
      enableMotion,
      game,
      keepDisplayAwake,
      requestFullscreen,
      requestMotionPermission,
      resetGame: gameController.reset,
      scheduleFrame,
      sensorWatchdog,
      settings,
      timing,
      ui,
      setTimeoutFn,
      clearTimeoutFn,
    });
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

  const gameController = {
    start,
    reset: resetGameState,
    pause: pauseGame,
    resume: resumeGame,
    openSettings,
    closeSettings: closeSettingsModal,
    tick,
  };

  return {
    gameController,
  };
}

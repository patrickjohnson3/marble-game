import { copy } from "./copy.js";
import { GAME_PHASES, SENSOR_MODES } from "./runtime-states.js";

function requestMotionPermissionWithTimeout({
  requestMotionPermission,
  timeoutMs,
  setTimeoutFn,
  clearTimeoutFn,
}) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = 0;
    const finish = (allowed) => {
      if (settled) return;

      settled = true;
      clearTimeoutFn(timer);
      resolve(allowed);
    };
    timer = setTimeoutFn(() => finish("timeout"), timeoutMs);

    Promise.resolve()
      .then(requestMotionPermission)
      .then(finish, () => finish(false));
  });
}

export function createLifecycleController({
  state,
  cameraController,
  effectsRenderer,
  frameLoop,
  introSequence,
  mapRenderer,
  resetMap = () => {},
  resetCalibration,
  scheduleFrame,
  sensorWatchdog,
  settings,
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
}) {
  const { game, haptics, intro, marble } = state;
  const { keyboard, sensor, tilt } = state.input;
  let settingsPausedGame = false;

  function pauseGame() {
    if (game.paused || game.phase === GAME_PHASES.waiting) return false;

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
      () =>
        game.phase === GAME_PHASES.calibrating &&
        sensor.using === SENSOR_MODES.none,
    );
    introSequence.resume();
    scheduleFrame();
  }

  function resetGameState() {
    sensorWatchdog.reset();
    introSequence.reset();
    resetCalibration();
    resetMap();

    game.phase = GAME_PHASES.waiting;
    game.paused = false;
    settingsPausedGame = false;
    sensor.permission = "unknown";
    sensor.using = SENSOR_MODES.none;

    intro.released = false;
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
    ui.setStartControls({ visible: false, disabled: true });
    resetGameState();
    ui.setStartControls({ visible: false, disabled: true });
    requestFullscreen({ fullscreenOnStart: settings.fullscreenEnabled });
    keepDisplayAwake();
    enableMotion();
    game.phase = GAME_PHASES.calibrating;
    sensor.permission = "pending";
    scheduleFrame();
    ui.setHint(copy.hints.calibrating);
    ui.setGameStatus(copy.hints.calibrating);
    sensorWatchdog.schedule();

    const permission = await requestMotionPermissionWithTimeout({
      requestMotionPermission,
      timeoutMs: timing.motionPermissionTimeoutMs,
      setTimeoutFn,
      clearTimeoutFn,
    });
    sensor.permission =
      permission === "timeout" ? "timeout" : permission ? "granted" : "denied";

    if (permission === false) {
      ui.setHint(copy.hints.motionDenied);
      ui.setGameStatus(copy.hints.motionDenied);
    } else if (permission === "timeout") {
      ui.setHint(copy.hints.noMotionSensor);
      ui.setGameStatus(copy.hints.noMotionSensor);
    }
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
  };

  return {
    gameController,
  };
}

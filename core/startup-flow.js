import { copy } from "./copy.js";
import { GAME_PHASES } from "./runtime-states.js";

function requestMotionPermissionWithTimeout({
  requestMotionPermission,
  timeoutMs,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
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

export async function startGameWithPermissions({
  enableMotion,
  game,
  keepDisplayAwake,
  requestFullscreen,
  requestMotionPermission,
  resetGame,
  scheduleFrame,
  sensor,
  sensorWatchdog,
  settings,
  timing,
  ui,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  ui.setStartControls({ visible: false, disabled: true });
  resetGame();
  ui.setStartControls({ visible: false, disabled: true });
  requestFullscreen({ fullscreenOnStart: settings.fullscreenEnabled });
  keepDisplayAwake();
  enableMotion();
  game.phase = GAME_PHASES.calibrating;
  if (sensor) sensor.permission = "pending";
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
  if (sensor) {
    sensor.permission =
      permission === "timeout" ? "timeout" : permission ? "granted" : "denied";
  }

  if (permission === false) {
    ui.setHint(copy.hints.motionDenied);
    ui.setGameStatus(copy.hints.motionDenied);
    return;
  }

  if (permission === "timeout") {
    ui.setHint(copy.hints.noMotionSensor);
    ui.setGameStatus(copy.hints.noMotionSensor);
  }
}

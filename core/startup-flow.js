import { copy } from "./copy.js";
import {
  requestFullscreenMode,
  requestMotionPermissionIfNeeded,
  requestWakeLock,
} from "../platform/platform.js";

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
  controlsEl,
  enableMotion,
  game,
  keepDisplayAwake = requestWakeLock,
  requestFullscreen = requestFullscreenMode,
  requestMotionPermission = requestMotionPermissionIfNeeded,
  resetGame,
  scheduleFrame,
  sensorWatchdog,
  settings,
  startBtn,
  timing,
  ui,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  startBtn.disabled = true;
  controlsEl.hidden = true;

  const permission = await requestMotionPermissionWithTimeout({
    requestMotionPermission,
    timeoutMs: timing.motionPermissionTimeoutMs,
    setTimeoutFn,
    clearTimeoutFn,
  });
  if (permission === false) {
    controlsEl.hidden = false;
    startBtn.disabled = false;
    ui.setHint(copy.hints.motionDenied);
    return;
  }

  requestFullscreen({ fullscreenOnStart: settings.fullscreenEnabled });
  keepDisplayAwake();
  resetGame();
  controlsEl.hidden = true;
  startBtn.disabled = true;
  enableMotion();
  game.phase = "calibrating";
  scheduleFrame();

  ui.setHint(
    permission === "timeout"
      ? copy.hints.noMotionSensor
      : copy.hints.calibrating,
  );

  sensorWatchdog.schedule();
}

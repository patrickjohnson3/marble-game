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
  enableMotion,
  game,
  keepDisplayAwake = requestWakeLock,
  primeHaptics = () => {},
  requestFullscreen = requestFullscreenMode,
  requestMotionPermission = requestMotionPermissionIfNeeded,
  resetGame,
  scheduleFrame,
  sensorWatchdog,
  settings,
  timing,
  ui,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  ui.setStartControls({ visible: false, disabled: true });
  primeHaptics();

  const permission = await requestMotionPermissionWithTimeout({
    requestMotionPermission,
    timeoutMs: timing.motionPermissionTimeoutMs,
    setTimeoutFn,
    clearTimeoutFn,
  });
  if (permission === false) {
    ui.setStartControls({ visible: true, disabled: false });
    ui.setHint(copy.hints.motionDenied);
    return;
  }

  requestFullscreen({ fullscreenOnStart: settings.fullscreenEnabled });
  keepDisplayAwake();
  resetGame();
  ui.setStartControls({ visible: false, disabled: true });
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

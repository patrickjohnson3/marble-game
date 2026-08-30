import { SENSOR_MODES } from "../core/runtime-states.js";

export function createSensorWatchdog({
  delayMs,
  game,
  sensor,
  onFallback,
  now = () => performance.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  let timer = 0;
  let startedAt = 0;
  let remainingDelayMs = delayMs;

  function run() {
    timer = 0;
    startedAt = 0;
    remainingDelayMs = delayMs;
    if (game.paused || sensor.using !== SENSOR_MODES.none) return;

    onFallback();
  }

  function schedule(delay = delayMs) {
    clearTimeoutFn(timer);
    startedAt = now();
    remainingDelayMs = delay;
    timer = setTimeoutFn(run, delay);
  }

  function pause() {
    if (!timer) return;

    remainingDelayMs = Math.max(0, remainingDelayMs - (now() - startedAt));
    clearTimeoutFn(timer);
    timer = 0;
  }

  function resume(shouldResume) {
    if (!shouldResume() || timer) return;

    schedule(remainingDelayMs);
  }

  function reset() {
    clearTimeoutFn(timer);
    timer = 0;
    startedAt = 0;
    remainingDelayMs = delayMs;
  }

  return {
    pause,
    reset,
    resume,
    schedule,
  };
}

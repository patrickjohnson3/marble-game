import { GAME_PHASES, SENSOR_MODES } from "../core/runtime-states.js";

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
    if (
      game.paused ||
      game.phase === GAME_PHASES.waiting ||
      sensor.using === SENSOR_MODES.keyboard
    )
      return;
    const remaining = remainingDelayMs - (now() - startedAt);
    if (remaining > 0) {
      schedule(remaining);
      return;
    }
    startedAt = 0;
    remainingDelayMs = delayMs;

    onFallback();
  }

  function schedule(delay = delayMs) {
    clearTimeoutFn(timer);
    startedAt = now();
    remainingDelayMs = delay;
    timer = setTimeoutFn(run, delay);
  }

  function refresh() {
    startedAt = now();
    remainingDelayMs = delayMs;
    // Keep one pending timer rather than replacing it at sensor frequency.
    if (!timer && !game.paused) timer = setTimeoutFn(run, delayMs);
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
    refresh,
    resume,
    schedule,
  };
}

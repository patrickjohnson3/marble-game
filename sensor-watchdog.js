export function createSensorWatchdog({ delayMs, game, sensor, onFallback }) {
  let timer = 0;
  let startedAt = 0;
  let remainingDelayMs = delayMs;

  function run() {
    timer = 0;
    startedAt = 0;
    remainingDelayMs = delayMs;
    if (game.paused) return;
    if (sensor.using !== "none") return;

    onFallback();
  }

  function schedule(delay = delayMs) {
    clearTimeout(timer);
    startedAt = performance.now();
    remainingDelayMs = delay;
    timer = setTimeout(run, delay);
  }

  function pause() {
    if (!timer) return;

    const elapsed = performance.now() - startedAt;
    remainingDelayMs = Math.max(0, remainingDelayMs - elapsed);
    clearTimeout(timer);
    timer = 0;
  }

  function resume(shouldResume) {
    if (!shouldResume() || timer) return;

    schedule(Math.max(0, remainingDelayMs));
  }

  function reset() {
    clearTimeout(timer);
    timer = 0;
    startedAt = 0;
    remainingDelayMs = delayMs;
  }

  return { pause, reset, resume, schedule };
}
